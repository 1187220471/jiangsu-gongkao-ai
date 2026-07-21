import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { endFocusSession, abandonFocusSession } from '@/lib/focus'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const auth = requireAuth(request)
    if (!auth.success) {
      return auth.response
    }

    const body = await request.json()
    const { sessionId, action, clientNow } = body

    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      return NextResponse.json(
        { error: 'sessionId 无效' },
        { status: 400 }
      )
    }

    // action: 'complete' (倒计时归零) | 'abandon' (用户主动放弃)
    if (action === 'abandon') {
      const result = await abandonFocusSession({
        userId: auth.userId,
        sessionId,
      })
      return NextResponse.json({ success: true, ...result })
    }

    const result = await endFocusSession({
      userId: auth.userId,
      sessionId,
      clientNow,
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('Focus end error:', error)
    const message = error instanceof Error ? error.message : '结束专注失败'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
