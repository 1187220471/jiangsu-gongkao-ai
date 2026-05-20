import { NextResponse } from 'next/server'
import { generateQuestion } from '@/lib/ai'
import { verifyToken, getTokenFromRequest } from '@/lib/auth'
import { checkQuota } from '@/lib/quota'

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

    const { type } = await request.json()

    if (!type) {
      return NextResponse.json(
        { error: '请选择题型' },
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

    // 出题不扣次数，仅检查额度
    const question = await generateQuestion(type)

    return NextResponse.json({
      question,
      type,
      remainingFree: quota.remainingFree,
    })
  } catch (error) {
    console.error('Generate question error:', error)
    return NextResponse.json(
      { error: '生成题目失败，请稍后重试' },
      { status: 500 }
    )
  }
}
