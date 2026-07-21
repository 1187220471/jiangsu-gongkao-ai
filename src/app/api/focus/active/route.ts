import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getActiveFocusSession } from '@/lib/focus'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const auth = requireAuth(request)
    if (!auth.success) {
      return auth.response
    }

    const active = await getActiveFocusSession(auth.userId)

    return NextResponse.json({
      success: true,
      active,
    })
  } catch (error) {
    console.error('Focus active error:', error)
    return NextResponse.json(
      { error: '获取活跃专注失败' },
      { status: 500 }
    )
  }
}
