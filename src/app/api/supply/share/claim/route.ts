import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const auth = requireAuth(request)
    if (!auth.success) {
      return auth.response
    }

    const body = await request.json()
    const { token } = body

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: '无效的 token' }, { status: 400 })
    }

    const userId = auth.userId

    const shareReward = await prisma.shareReward.findUnique({
      where: { token },
    })

    if (!shareReward || shareReward.expiresAt < new Date()) {
      return NextResponse.json({ error: '链接无效或已过期' }, { status: 400 })
    }

    if (shareReward.sharerId === userId) {
      return NextResponse.json({ error: '不能领取自己的分享奖励' }, { status: 400 })
    }

    if (shareReward.redeemedAt) {
      return NextResponse.json({ error: '分享奖励已使用' }, { status: 400 })
    }

    const item = await prisma.supplyItem.findUnique({
      where: { id: shareReward.itemId },
    })
    if (!item) {
      return NextResponse.json({ error: '分享物品不存在' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      claimed: Boolean(shareReward.claimedBy),
      reward: {
        type: 'freeDraw',
        description: `你获得了 ${item.name} 的免费抽机会！`,
      },
      sharerId: shareReward.sharerId,
      item,
    })
  } catch (error) {
    console.error('Claim share reward error:', error)
    const message = error instanceof Error ? error.message : '领取失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}