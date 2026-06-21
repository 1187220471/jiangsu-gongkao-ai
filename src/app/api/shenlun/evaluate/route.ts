import { NextResponse } from 'next/server'
import { evaluateShenlunAnswer } from '@/lib/ai'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { checkQuota, deductQuota } from '@/lib/quota'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const auth = requireAuth(request)
    if (!auth.success) {
      return auth.response
    }

    const { questionId, userAnswer } = await request.json()

    if (!questionId || typeof questionId !== 'number') {
      return NextResponse.json({ error: '题目ID不能为空' }, { status: 400 })
    }

    if (!userAnswer || typeof userAnswer !== 'string' || userAnswer.trim().length === 0) {
      return NextResponse.json({ error: '答案不能为空' }, { status: 400 })
    }

    if (userAnswer.trim().length > 5000) {
      return NextResponse.json({ error: '答案字数不能超过5000字' }, { status: 400 })
    }

    const question = await prisma.shenlunQuestion.findUnique({
      where: { id: questionId },
      include: {
        materials: true,
        answers: true,
      },
    })

    const referenceAnswer = question?.answers.find(a => a.teacherName === 'AI参考答案')?.answerText

    if (!question) {
      return NextResponse.json({ error: '题目不存在' }, { status: 404 })
    }

    if (!referenceAnswer) {
      return NextResponse.json({ error: '该题目尚未生成参考答案，请联系管理员' }, { status: 500 })
    }

    const isBigEssay = question.questionType === '大作文'
    const cost = isBigEssay ? 2 : 1

    const quota = await checkQuota(auth.userId, cost)
    if (!quota.allowed) {
      return NextResponse.json({ error: quota.message }, { status: 403 })
    }

    await deductQuota(auth.userId, cost)

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { accessLevel: true, accessExpire: true },
    })
    const now = new Date()
    const isInvited = !!(user?.accessLevel && user.accessLevel !== 'none' && user.accessExpire && user.accessExpire > now)

    const result = await evaluateShenlunAnswer(
      question.questionText,
      question.materials.map(m => ({ materialNum: String(m.materialNum), content: m.content })),
      question.questionType,
      question.score || 20,
      question.wordLimit,
      referenceAnswer,
      question.answers.filter(a => a.teacherName !== 'AI参考答案').map(a => ({ teacherName: a.teacherName, answerText: a.answerText })),
      userAnswer
    )

    const record = await prisma.record.create({
      data: {
        userId: auth.userId,
        questionType: `shenlun-${question.questionType}`,
        question: question.questionText,
        referenceAnswer,
        userAnswer,
        evaluation: result.evaluation,
        improvedAnswer: result.improvedAnswer,
        score: result.score,
      },
    })

    return NextResponse.json({
      ...result,
      recordId: record.id,
      cost: isInvited ? 0 : cost,
      isInvited,
    })
  } catch (error) {
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    console.error(`[${errorId}] Shenlun evaluate error:`, error)
    return NextResponse.json(
      { error: '批改失败，请稍后重试', errorId },
      { status: 500 }
    )
  }
}
