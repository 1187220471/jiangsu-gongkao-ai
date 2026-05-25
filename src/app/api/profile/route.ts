import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { getQuotaInfo } from '@/lib/quota'

export async function GET(request: Request) {
  try {
    const auth = requireAuth(request)
    if (!auth.success) {
      return auth.response
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
        username: true,
        nickname: true,
        createdAt: true,
        accessLevel: true,
        accessExpire: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    // 使用统一的额度查询（避免重复计算逻辑）
    const quotaInfo = await getQuotaInfo(auth.userId)

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
      access: {
        hasAccess: quotaInfo?.hasAccess || false,
        accessLevel: user.accessLevel,
        accessExpire: user.accessExpire ? user.accessExpire.toISOString().split('T')[0] : null,
        remainingFree: quotaInfo?.remainingFree || 0,
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
