import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

const MAX_SHARE_PER_DAY = 10

export async function POST(request: Request) {
  try {
    const auth = requireAuth(request)
    if (!auth.success) {
      return auth.response
    }

    const body = await request.json()
    const { itemId } = body
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json({ error: '无效的 itemId' }, { status: 400 })
    }

    const item = await prisma.supplyItem.findUnique({
      where: { id: itemId },
      select: { id: true, name: true, category: true },
    })
    if (!item) {
      return NextResponse.json({ error: '物品不存在' }, { status: 404 })
    }

    const owned = await prisma.userCollection.findUnique({
      where: { userId_itemId: { userId: auth.userId, itemId } },
      select: { id: true },
    })
    if (!owned) {
      return NextResponse.json({ error: '只能分享已收集的物品' }, { status: 403 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const shareCountToday = await prisma.shareReward.count({
      where: { sharerId: auth.userId, createdAt: { gte: today } },
    })
    if (shareCountToday >= MAX_SHARE_PER_DAY) {
      return NextResponse.json(
        { error: `今日可分享次数已达上限（${MAX_SHARE_PER_DAY}次）` },
        { status: 400 }
      )
    }

    const shareToken = crypto.randomUUID().replace(/-/g, '')
    await prisma.shareReward.create({
      data: {
        sharerId: auth.userId,
        itemId: item.id,
        token: shareToken,
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      },
    })

    return NextResponse.json({
      success: true,
      token: shareToken,
      item,
      shareCountToday: shareCountToday + 1,
      remainingShares: MAX_SHARE_PER_DAY - shareCountToday - 1,
    })
  } catch (error) {
    console.error('Create share link error:', error)
    return NextResponse.json({ error: '创建分享链接失败' }, { status: 500 })
  }
}