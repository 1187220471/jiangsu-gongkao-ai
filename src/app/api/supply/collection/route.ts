import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getCollection, getAllCollection, type SupplyCategory } from '@/lib/supply'

export const dynamic = 'force-dynamic'

const VALID_CATEGORIES: SupplyCategory[] = ['pixelPet', 'nbaStar']

export async function GET(request: Request) {
  try {
    const auth = requireAuth(request)
    if (!auth.success) {
      return auth.response
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    const items = category === 'all'
      ? await getAllCollection(auth.userId)
      : await getCollection(auth.userId, (VALID_CATEGORIES.includes(category as SupplyCategory) ? category : 'pixelPet') as SupplyCategory)

    return NextResponse.json({
      items,
      total: items.length,
      collected: items.filter((i) => i.collected).length,
    })
  } catch (error) {
    console.error('Supply collection error:', error)
    return NextResponse.json(
      { error: '获取图鉴失败' },
      { status: 500 }
    )
  }
}
