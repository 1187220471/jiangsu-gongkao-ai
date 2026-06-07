import { NextResponse } from 'next/server'
import { evaluateAnswer, generateReferenceAnswer } from '@/lib/ai'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { checkQuota, deductQuota } from '@/lib/quota'

export async function POST(request: Request) {
  try {
    const auth = requireAuth(request)
    if (!auth.success) {
      return auth.response
    }

    const { question, referenceAnswer, userAnswer, type } = await request.json()

    if (!question || typeof question !== 'string' || question.trim().length < 5) {
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

    // 检查额度（批改消耗1点）
    const quota = await checkQuota(auth.userId, 1)
    if (!quota.allowed) {
      return NextResponse.json(
        { error: quota.message },
        { status: 403 }
      )
    }

    // 扣除额度（批改消耗1点）
    await deductQuota(auth.userId, 1)

    // 如果没有参考答案，并行生成（让用户在批改后直接看到，不额外消耗次数）
    let finalReferenceAnswer = referenceAnswer || ''
    if (!finalReferenceAnswer) {
      try {
        finalReferenceAnswer = await generateReferenceAnswer(question)
      } catch (genErr) {
        console.error('Generate reference answer during evaluate error:', genErr)
        // 生成失败不影响批改，继续用空字符串
      }
    }

    const result = await evaluateAnswer(question, finalReferenceAnswer, userAnswer)

    // 保存记录
    const record = await prisma.record.create({
      data: {
        userId: auth.userId,
        questionType: type || 'social',
        question,
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
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    console.error(`[${errorId}] Evaluate error:`, error)
    return NextResponse.json(
      { error: '批改失败，请稍后重试', errorId },
      { status: 500 }
    )
  }
}
