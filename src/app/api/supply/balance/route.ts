import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getBalance, getEquippedItem, hasFreeDrawToday } from '@/lib/supply'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const auth = requireAuth(request)
    if (!auth.success) {
      return auth.response
    }

    const [balance, equipped, freeDrawUsedToday] = await Promise.all([
      getBalance(auth.userId),
      getEquippedItem(auth.userId),
      hasFreeDrawToday(auth.userId),
    ])

    return NextResponse.json({
      balance,
      freeDrawUsedToday,
      equippedItem: equipped
        ? {
                id: equipped.item.id,
                name: equipped.item.name,
                imageUrl: equipped.item.imageUrl,
                rarity: equipped.item.rarity,
              }
        : null,
    })
  } catch (error) {
    console.error('Supply balance error:', error)
    return NextResponse.json(
      { error: '获取学习点余额失败' },
      { status: 500 }
    )
  }
}
