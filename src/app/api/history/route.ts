import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken, getTokenFromRequest } from '@/lib/auth'

export async function GET(request: Request) {
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

    const records = await prisma.record.findMany({
      where: { userId: payload.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json({ records })
  } catch (error) {
    console.error('Get history error:', error)
    return NextResponse.json(
      { error: '获取历史记录失败' },
      { status: 500 }
    )
  }
}
