import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getCollection } from '@/lib/supply'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const auth = requireAuth(request)
    if (!auth.success) {
      return auth.response
    }

    const items = await getCollection(auth.userId)

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
