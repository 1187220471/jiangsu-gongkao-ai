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

    if (!question || !userAnswer) {
      return NextResponse.json(
        { error: '题目和答案不能为空' },
        { status: 400 }
      )
    }

    // 检查额度
    const quota = await checkQuota(auth.userId)
    if (!quota.allowed) {
      return NextResponse.json(
        { error: quota.message },
        { status: 403 }
      )
    }

    // 扣除额度（仅批改扣次，查看参考答案不扣次）
    await deductQuota(auth.userId)

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
    console.error('Evaluate error:', error)
    return NextResponse.json(
      { error: '批改失败，请稍后重试' },
      { status: 500 }
    )
  }
}
