import { NextResponse } from 'next/server'
import { evaluateAnswer } from '@/lib/ai'
import { prisma } from '@/lib/db'
import { verifyToken, getTokenFromRequest } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const token = getTokenFromRequest(request)
    if (!token) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      )
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json(
        { error: '登录已过期' },
        { status: 401 }
      )
    }

    const { question, referenceAnswer, userAnswer, type } = await request.json()

    if (!question || !userAnswer) {
      return NextResponse.json(
        { error: '题目和答案不能为空' },
        { status: 400 }
      )
    }

    const result = await evaluateAnswer(question, referenceAnswer || '', userAnswer)

    // 保存记录
    const record = await prisma.record.create({
      data: {
        userId: payload.userId,
        questionType: type || 'social',
        question,
        referenceAnswer,
        userAnswer,
        evaluation: result.evaluation,
        score: result.score,
      },
    })

    return NextResponse.json({
      ...result,
      recordId: record.id,
    })
  } catch (error) {
    console.error('Evaluate error:', error)
    return NextResponse.json(
      { error: '批改失败，请稍后重试' },
      { status: 500 }
    )
  }
}
