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

    // 查找未过期的分享奖励
    const shareReward = await prisma.shareReward.findUnique({
      where: { token },
    })

    if (!shareReward) {
      return NextResponse.json({ error: '链接无效或已失效' }, { status: 404 })
    }

    if (shareReward.expiresAt < new Date()) {
      return NextResponse.json({ error: '链接已过期' }, { status: 400 })
    }

    if (shareReward.claimedAt) {
      return NextResponse.json({ error: '已被领取过啦～' }, { status: 400 })
    }

    // 标记已领取
    await prisma.shareReward.update({
      where: { id: shareReward.id },
      data: {
        claimedAt: new Date(),
        claimedBy: userId,
      },
    })

    // 获取分享的物品信息
    const item = await prisma.supplyItem.findUnique({
      where: { id: shareReward.itemId },
    })

    return NextResponse.json({
      success: true,
      reward: {
        type: 'freeDraw',
        description: `你获得了 ${item?.name || '神秘补给品'} 的免费���机会！`,
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