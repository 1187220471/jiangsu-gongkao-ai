import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getBalance, getEquippedItem } from '@/lib/supply'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const auth = requireAuth(request)
    if (!auth.success) {
      return auth.response
    }

    const [balance, equipped] = await Promise.all([
      getBalance(auth.userId),
      getEquippedItem(auth.userId),
    ])

    return NextResponse.json({
      balance,
      equippedItem: equipped
        ? {
            id: equipped.item.id,
            name: equipped.item.name,
            imageUrl: equipped.item.imageUrl,
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
