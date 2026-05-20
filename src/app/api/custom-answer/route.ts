import { NextResponse } from 'next/server'
import { generateReferenceAnswer } from '@/lib/ai'
import { verifyToken, getTokenFromRequest } from '@/lib/auth'
import { checkQuota, deductQuota } from '@/lib/quota'

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

    const { question } = await request.json()

    if (!question || question.trim().length < 10) {
      return NextResponse.json(
        { error: '题目不能为空，至少输入10个字' },
        { status: 400 }
      )
    }

    // 检查额度
    const quota = await checkQuota(payload.userId)
    if (!quota.allowed) {
      return NextResponse.json(
        { error: quota.message },
        { status: 403 }
      )
    }

    // 扣除额度
    await deductQuota(payload.userId)

    const answer = await generateReferenceAnswer(question)

    return NextResponse.json({
      answer,
      remainingFree: Math.max(0, quota.remainingFree - 1),
    })
  } catch (error) {
    console.error('Custom answer error:', error)
    return NextResponse.json(
      { error: '生成答案失败，请稍后重试' },
      { status: 500 }
    )
  }
}
