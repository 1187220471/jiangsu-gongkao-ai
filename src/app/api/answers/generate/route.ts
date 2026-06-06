import { NextResponse } from 'next/server'
import { generateReferenceAnswer } from '@/lib/ai'
import { requireAuth } from '@/lib/auth'
import { checkQuota, deductQuota } from '@/lib/quota'

export async function POST(request: Request) {
  try {
    const auth = requireAuth(request)
    if (!auth.success) {
      return auth.response
    }

    const { question } = await request.json()

    if (!question || typeof question !== 'string' || question.trim().length < 5) {
      return NextResponse.json(
        { error: '题目不能为空，至少输入5个字' },
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

    // 扣除额度
    await deductQuota(auth.userId)

    const answer = await generateReferenceAnswer(question)

    return NextResponse.json({
      answer,
      remainingFree: Math.max(0, quota.remainingFree - 1),
    })
  } catch (error) {
    console.error('Generate answer error:', error)
    return NextResponse.json(
      { error: '生成答案失败，请稍后重试' },
      { status: 500 }
    )
  }
}
