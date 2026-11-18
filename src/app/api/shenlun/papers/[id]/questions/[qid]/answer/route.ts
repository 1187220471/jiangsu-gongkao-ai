import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { checkQuota, deductQuota, refundQuota } from '@/lib/quota'
import { generateShenlunReferenceAnswer } from '@/lib/ai'
import { extractMaterialRefs, splitMaterials } from '@/lib/shenlunPaperSplit'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const COST = 0.5
const MAX_MATERIAL_CHARS = 8000
const GENERATING_STALE_MS = 2 * 60 * 1000

function truncateAtSentence(text: string, max: number): string {
  if (!text) return ''
  if (text.length <= max) return text
  const sliced = text.slice(0, max)
  const lastStop = Math.max(
    sliced.lastIndexOf('。'),
    sliced.lastIndexOf('！'),
    sliced.lastIndexOf('？')
  )
  return lastStop > max * 0.6 ? sliced.slice(0, lastStop + 1) : sliced
}

export async function POST(
  request: Request,
  { params }: { params: { id: string; qid: string } }
) {
  try {
    const auth = requireAuth(request)
    if (!auth.success) return auth.response

    const body = await request.json().catch(() => ({}))
    const regenerate = body?.regenerate === true

    const question = await prisma.shenlunPaperQuestion.findFirst({
      where: {
        id: params.qid,
        paperId: params.id,
        paper: { userId: auth.userId },
      },
      include: {
        paper: { select: { materialsText: true } },
      },
    })

    if (!question) {
      return NextResponse.json({ error: '题目不存在' }, { status: 404 })
    }

    // 已生成且非强制重生成 → 直接返回，不扣额度
    if (!regenerate && question.answerStatus === 'ready' && question.answerText) {
      return NextResponse.json({
        question: { id: question.id, answerStatus: question.answerStatus },
        answer: {
          answerText: question.answerText,
          answerCharCount: question.answerCharCount,
          generatedAt: question.generatedAt,
        },
        cost: 0,
        cached: true,
      })
    }

    // 并发闸：同一题只允许一个请求在生成
    const twoMinutesAgo = new Date(Date.now() - GENERATING_STALE_MS)
    const gate = await prisma.shenlunPaperQuestion.updateMany({
      where: {
        id: question.id,
        OR: [
          { answerStatus: { not: 'generating' } },
          { updatedAt: { lt: twoMinutesAgo } },
        ],
      },
      data: { answerStatus: 'generating', answerError: null },
    })

    if (gate.count === 0) {
      return NextResponse.json({ error: '该题正在生成中，请稍候' }, { status: 409 })
    }

    const quota = await checkQuota(auth.userId, COST)
    if (!quota.allowed) {
      await prisma.shenlunPaperQuestion.update({
        where: { id: question.id },
        data: { answerStatus: question.answerStatus === 'ready' ? 'ready' : 'pending' },
      })
      return NextResponse.json({ error: quota.message }, { status: 403 })
    }

    await deductQuota(auth.userId, COST)

    try {
      const allMaterials = splitMaterials(question.paper.materialsText || '')
      const refs = extractMaterialRefs(question.questionText, allMaterials.map((m) => m.num))
      const selected =
        refs.length > 0 ? allMaterials.filter((m) => refs.includes(m.num)) : allMaterials

      // 按总字数预算投喂，优先本题相关材料
      const materials: Array<{ materialNum: string; content: string }> = []
      let budget = MAX_MATERIAL_CHARS
      for (const m of selected.length > 0 ? selected : allMaterials) {
        if (budget <= 0) break
        const content = truncateAtSentence(m.content, budget)
        if (!content) continue
        materials.push({ materialNum: m.num, content })
        budget -= content.length
      }
      if (materials.length === 0) {
        materials.push({
          materialNum: '全文',
          content: truncateAtSentence(question.paper.materialsText || '', MAX_MATERIAL_CHARS),
        })
      }

      const answerText = await generateShenlunReferenceAnswer(
        question.questionText,
        materials,
        question.questionType,
        question.score || 20,
        question.wordLimit,
        [],
        {
          maxCalibrationRounds: 2,
          deadlineAt: Date.now() + 40000,
          maxTokens: 4000,
        }
      )

      const trimmed = (answerText || '').trim()
      if (!trimmed) {
        throw new Error('AI_EMPTY')
      }

      const updated = await prisma.shenlunPaperQuestion.update({
        where: { id: question.id },
        data: {
          answerText: trimmed,
          answerCharCount: trimmed.length,
          answerStatus: 'ready',
          answerError: null,
          generatedAt: new Date(),
        },
      })

      const remaining =
        quota.remainingFree >= 999 ? 999 : Math.max(0, quota.remainingFree - COST)

      return NextResponse.json({
        question: { id: updated.id, answerStatus: updated.answerStatus },
        answer: {
          answerText: updated.answerText,
          answerCharCount: updated.answerCharCount,
          generatedAt: updated.generatedAt,
        },
        cost: COST,
        quota: { remainingFree: remaining, isInvited: quota.remainingFree >= 999 },
      })
    } catch (aiError) {
      const message = aiError instanceof Error ? aiError.message : '生成失败'
      await refundQuota(auth.userId, COST)
      await prisma.shenlunPaperQuestion.update({
        where: { id: question.id },
        data: { answerStatus: 'failed', answerError: message.slice(0, 300) },
      })

      if (message === 'AI_TIMEOUT') {
        return NextResponse.json(
          { error: '生成超时，请重试（本次未扣除额度）' },
          { status: 504 }
        )
      }
      return NextResponse.json(
        { error: '生成参考答案失败，请重试（本次未扣除额度）' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Generate shenlun paper answer error:', error)
    return NextResponse.json({ error: '生成失败，请稍后重试' }, { status: 500 })
  }
}
