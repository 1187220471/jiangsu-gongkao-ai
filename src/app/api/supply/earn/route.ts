import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { earnPoints, PointsType, POINTS_REWARDS } from '@/lib/supply'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const auth = requireAuth(request)
    if (!auth.success) {
      return auth.response
    }

    const body = await request.json()
    const { type, refId } = body

    if (!type || !(type in POINTS_REWARDS)) {
      return NextResponse.json(
        { error: '无效的学习点类型' },
        { status: 400 }
      )
    }

    if (POINTS_REWARDS[type as PointsType] <= 0) {
      return NextResponse.json(
        { error: '该类型不是奖励类型' },
        { status: 400 }
      )
    }

    const result = await earnPoints({
      userId: auth.userId,
      type: type as PointsType,
      refId,
    })

    return NextResponse.json({
      success: true,
      balance: result.balance,
      earned: POINTS_REWARDS[type as PointsType],
      alreadyEarned: result.alreadyEarned,
    })
  } catch (error) {
    console.error('Supply earn error:', error)
    return NextResponse.json(
      { error: '发放学习点失败' },
      { status: 500 }
    )
  }
}
