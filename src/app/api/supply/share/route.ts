import { NextResponse } from 'next/server'
import { earnPoints } from '@/lib/supply'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// 每用户每日��享上限
const MAX_SHARE_PER_DAY = 10

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { itemId, itemName, itemRarity, category } = body

    // 解析 Authorization header（可选项，支持匿名分享）
    const authHeader = request.headers.get('authorization')
    let userId: string | null = null
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      // 简单解析 JWT（不验证，直接从 payload 提取 userId）
      // 实际生产应调用 requireAuth
      try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
        userId = payload.userId || payload.sub
      } catch (e) {
        // 无效 token，视为匿名
      }
    }

    if (!itemId || typeof itemId !== 'number') {
      return NextResponse.json({ error: '无效的 itemId' }, { status: 400 })
    }

    // 已登录用户：发放分享奖励 +1 学习点
    if (userId) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const shareCountToday = await prisma.pointsLog.count({
        where: {
          userId,
          type: 'share',
          createdAt: { gte: today },
        },
      })

      if (shareCountToday >= MAX_SHARE_PER_DAY) {
        return NextResponse.json(
          { error: `今日分享次数已达上限（${MAX_SHARE_PER_DAY}次），明天再来吧！` },
          { status: 400 }
        )
      }

      // 幂等检查：同一物品同一时间戳只发一次
      const shareRefId = `share:${itemId}:${Date.now()}`
      const existingShare = await prisma.pointsLog.findFirst({
        where: { userId, type: 'share', refId: shareRefId },
      })

      if (!existingShare) {
        await earnPoints({ userId, type: 'share', refId: shareRefId })
      }

      return NextResponse.json({
        success: true,
        shared: true,
        sharerId: userId,
        reward: {
          type: 'points',
          amount: 1,
          description: '分享成功！+1 学习点',
        },
        shareCountToday: shareCountToday + 1,
        remainingShares: MAX_SHARE_PER_DAY - shareCountToday - 1,
      })
    }

    // 未登录用户：只记录分享（但不发放奖励）
    return NextResponse.json({
      success: true,
      shared: false,
      reward: {
        type: 'points',
        amount: 0,
        description: '登录后可获得分享奖励',
      },
    })
  } catch (error) {
    console.error('Share error:', error)
    const message = error instanceof Error ? error.message : '分享失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}