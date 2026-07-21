import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { startFocusSession } from '@/lib/focus'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const auth = requireAuth(request)
    if (!auth.success) {
      return auth.response
    }

    const body = await request.json()
    const { duration } = body

    if (duration !== 30 && duration !== 60) {
      return NextResponse.json(
        { error: 'duration 必须是 30 或 60' },
        { status: 400 }
      )
    }

    const result = await startFocusSession({ userId: auth.userId, duration })

    return NextResponse.json({
      success: true,
      sessionId: result.sessionId,
      startedAt: result.startedAt.toISOString(),
      duration: result.duration,
    })
  } catch (error) {
    console.error('Focus start error:', error)
    const message = error instanceof Error ? error.message : '开始专注失败'
    return NextResponse.json(
      { error: message },
      { status: message.includes('进行中') ? 400 : 500 }
    )
  }
}
