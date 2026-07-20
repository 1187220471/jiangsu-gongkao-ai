import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { equipItem } from '@/lib/supply'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const auth = requireAuth(request)
    if (!auth.success) {
      return auth.response
    }

    const body = await request.json()
    const { itemId } = body

    if (itemId !== null && (!Number.isInteger(itemId) || itemId <= 0)) {
      return NextResponse.json(
        { error: 'itemId 无效' },
        { status: 400 }
      )
    }

    const result = await equipItem(auth.userId, itemId ?? null)

    return NextResponse.json({
      success: true,
      equippedItemId: result.equippedItemId,
    })
  } catch (error) {
    console.error('Supply equip error:', error)
    const message = error instanceof Error ? error.message : '装备失败'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
