import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken, getTokenFromRequest } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const token = getTokenFromRequest(request)
    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: '登录已过期' }, { status: 401 })
    }

    const { content, type } = await request.json()

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: '请输入反馈内容' }, { status: 400 })
    }

    if (content.trim().length > 2000) {
      return NextResponse.json({ error: '反馈内容不能超过2000字' }, { status: 400 })
    }

    const validTypes = ['BUG', '建议', '其他']
    const feedbackType = validTypes.includes(type) ? type : '其他'

    await prisma.feedback.create({
      data: {
        userId: payload.userId,
        content: content.trim(),
        type: feedbackType,
      },
    })

    return NextResponse.json({ message: '反馈提交成功，感谢您的建议！' })
  } catch (error) {
    console.error('Submit feedback error:', error)
    return NextResponse.json(
      { error: '提交反馈失败，请稍后重试' },
      { status: 500 }
    )
  }
}
