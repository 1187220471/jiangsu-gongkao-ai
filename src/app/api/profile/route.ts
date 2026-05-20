import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken, getTokenFromRequest } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const token = getTokenFromRequest(request)
    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: '登录已过期' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        username: true,
        nickname: true,
        createdAt: true,
        vipType: true,
        vipExpire: true,
        dailyFreeCount: true,
        freeCountResetAt: true,
        coins: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    const now = new Date()
    const resetAt = new Date(user.freeCountResetAt)
    const isSameDay =
      resetAt.getFullYear() === now.getFullYear() &&
      resetAt.getMonth() === now.getMonth() &&
      resetAt.getDate() === now.getDate()

    let remainingFree = user.dailyFreeCount
    if (!isSameDay) {
      remainingFree = 3
    }

    const isVip = user.vipType !== 'none' && user.vipExpire && user.vipExpire > now

    // 获取使用统计
    const totalPractices = await prisma.record.count({
      where: { userId: user.id },
    })

    const avgScoreResult = await prisma.record.aggregate({
      where: {
        userId: user.id,
        score: { not: null },
      },
      _avg: {
        score: true,
      },
    })

    const avgScore = avgScoreResult._avg.score
      ? Math.round(avgScoreResult._avg.score)
      : null

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        createdAt: user.createdAt.toISOString().split('T')[0],
      },
      membership: {
        isVip,
        vipType: user.vipType,
        vipExpire: user.vipExpire ? user.vipExpire.toISOString().split('T')[0] : null,
        remainingFree: isVip ? 999 : remainingFree,
      },
      stats: {
        totalPractices,
        avgScore,
      },
    })
  } catch (error) {
    console.error('Get profile error:', error)
    return NextResponse.json(
      { error: '获取个人信息失败' },
      { status: 500 }
    )
  }
}
