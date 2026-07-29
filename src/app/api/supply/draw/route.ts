import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { drawItem, type SupplyCategory } from '@/lib/supply'

export const dynamic = 'force-dynamic'

const VALID_CATEGORIES: SupplyCategory[] = ['pixelPet', 'nbaStar']

export async function POST(request: Request) {
  try {
    const auth = requireAuth(request)
    if (!auth.success) {
      return auth.response
    }

    const body = await request.json()
    const { source, category = 'pixelPet' } = body

    if (!source || (source !== 'free' && source !== 'paid')) {
      return NextResponse.json(
        { error: 'source 必须是 free 或 paid' },
        { status: 400 }
      )
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: 'category 无效' },
        { status: 400 }
      )
    }

    const result = await drawItem(auth.userId, source, category)

    return NextResponse.json({
      success: true,
      item: {
        id: result.item.id,
        name: result.item.name,
        rarity: result.item.rarity,
        imageUrl: result.item.imageUrl,
        description: result.item.description,
      },
      isRepeat: result.isRepeat,
      repeatPoints: result.repeatPoints,
      balance: result.balance,
      source: result.source,
    })
  } catch (error) {
    console.error('Supply draw error:', error)
    const message = error instanceof Error ? error.message : '抽奖失败'
    return NextResponse.json(
      { error: message },
      { status: message.includes('不足') || message.includes('用完') ? 400 : 500 }
    )
  }
}
