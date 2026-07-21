import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getTodayFocus } from '@/lib/focus'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const auth = requireAuth(request)
    if (!auth.success) {
      return auth.response
    }

    const summary = await getTodayFocus(auth.userId)

    return NextResponse.json({
      success: true,
      ...summary,
    })
  } catch (error) {
    console.error('Focus today error:', error)
    return NextResponse.json(
      { error: '获取今日专注数据失败' },
      { status: 500 }
    )
  }
}
