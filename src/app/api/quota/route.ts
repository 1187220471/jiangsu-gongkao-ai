import { NextResponse } from 'next/server'
import { verifyToken, getTokenFromRequest } from '@/lib/auth'
import { getQuotaInfo } from '@/lib/quota'

export async function GET(request: Request) {
  try {
    const token = getTokenFromRequest(request)
    if (!token) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      )
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json(
        { error: '登录已过期' },
        { status: 401 }
      )
    }

    const info = await getQuotaInfo(payload.userId)

    if (!info) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json(info)
  } catch (error) {
    console.error('Quota error:', error)
    return NextResponse.json(
      { error: '获取额度信息失败' },
      { status: 500 }
    )
  }
}
