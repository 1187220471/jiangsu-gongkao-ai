import { NextResponse } from 'next/server'
import { generateReferenceAnswer } from '@/lib/ai'
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

    const { question } = await request.json()

    if (!question) {
      return NextResponse.json(
        { error: '题目不能为空' },
        { status: 400 }
      )
    }

    const answer = await generateReferenceAnswer(question)

    return NextResponse.json({
      answer,
    })
  } catch (error) {
    console.error('Generate answer error:', error)
    return NextResponse.json(
      { error: '生成答案失败，请稍后重试' },
      { status: 500 }
    )
  }
}
