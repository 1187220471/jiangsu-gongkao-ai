import { NextResponse } from 'next/server'
import { evaluateAnswer, generateReferenceAnswer } from '@/lib/ai'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { checkQuota, deductQuota } from '@/lib/quota'

// 强制动态：避免边缘缓存导致额度/记录异常
export const dynamic = 'force-dynamic'

// 真题 questionType 字符串 → 内部 enum 映射（供 evaluate prompt 使用）
const TYPE_MAP: Record<string, string> = {
  '社会现象类': 'social',
  '态度观点类': 'attitude',
  '组织管理类': 'organize',
  '应急应变类': 'emergency',
  '人际关系类': 'relationship',
  '自我认知类': 'self',
  '情景模拟类': 'situational',
}

function normalizeType(raw: string | null | undefined): string {
  if (!raw) return 'social'
  const trimmed = raw.trim()
  return TYPE_MAP[trimmed] || 'social'
}

export async function POST(request: Request) {
  try {
    const auth = requireAuth(request)
    if (!auth.success) {
      return auth.response
    }

    const body = await request.json().catch(() => ({}))
    const { questionId, questionText, referenceAnswer, userAnswer, questionType } = body || {}

    // 入参校验
    if (!questionText || typeof questionText !== 'string' || questionText.trim().length < 5) {
      return NextResponse.json(
        { error: '题目不能为空，至少输入5个字' },
        { status: 400 }
      )
    }
    if (!userAnswer || typeof userAnswer !== 'string' || userAnswer.trim().length === 0) {
      return NextResponse.json(
        { error: '答案不能为空' },
        { status: 400 }
      )
    }
    if (userAnswer.trim().length > 5000) {
      return NextResponse.json(
        { error: '答案字数不能超过5000字' },
        { status: 400 }
      )
    }

    // 额度校验（邀请用户在有效期内自动豁免）
    const quota = await checkQuota(auth.userId, 1)
    if (!quota.allowed) {
      return NextResponse.json(
        { error: quota.message },
        { status: 403 }
      )
    }

    // 扣额度（邀请用户自动跳过）
    await deductQuota(auth.userId, 1)

    // 真题自带 finalAnswer 作参考答案；为空时兜底生成（不额外扣次）
    let finalReferenceAnswer = (referenceAnswer || '').trim()
    if (!finalReferenceAnswer) {
      try {
        finalReferenceAnswer = await generateReferenceAnswer(questionText)
      } catch (genErr) {
        console.error('zhenti evaluate: 参考答案兜底生成失败', genErr)
      }
    }

    const result = await evaluateAnswer(questionText, finalReferenceAnswer, userAnswer)

    const typeKey = normalizeType(questionType)

    // 写练习记录（question 字段记真题文本 + 标识，方便 history 区分来源）
    const markedQuestion = questionId
      ? `[真题#${questionId}] ${questionText}`
      : questionText

    const record = await prisma.record.create({
      data: {
        userId: auth.userId,
        questionType: typeKey,
        question: markedQuestion,
        referenceAnswer: finalReferenceAnswer,
        userAnswer,
        evaluation: result.evaluation,
        improvedAnswer: result.improvedAnswer,
        score: result.score,
      },
    })

    return NextResponse.json({
      ...result,
      referenceAnswer: finalReferenceAnswer,
      recordId: record.id,
      remainingFree: Math.max(0, quota.remainingFree - 1),
    })
  } catch (error) {
    const errorId = `err_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
    console.error(`[${errorId}] zhenti evaluate error:`, error)
    return NextResponse.json(
      { error: '批改失败，请稍后重试', errorId },
      { status: 500 }
    )
  }
}
