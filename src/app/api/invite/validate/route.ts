import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken, getTokenFromRequest } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const token = getTokenFromRequest(request)
    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: '登录已过期' }, { status: 401 })
    }

    const { code } = await request.json()

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: '请输入邀请码' }, { status: 400 })
    }

    // 查找邀请码
    const inviteCode = await prisma.invitationCode.findUnique({
      where: { code: code.trim().toUpperCase() },
    })

    if (!inviteCode) {
      return NextResponse.json({ error: '邀请码不存在' }, { status: 400 })
    }

    if (inviteCode.used) {
      return NextResponse.json({ error: '邀请码已被使用' }, { status: 400 })
    }

    // 获取当前用户信息
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        vipType: true,
        vipExpire: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    const now = new Date()
    let newExpireDate: Date

    // 续费逻辑：已过期从当天起算，未过期则顺延
    if (user.vipExpire && user.vipExpire > now) {
      // 未过期，在现有到期日基础上顺延30天
      newExpireDate = new Date(user.vipExpire)
      newExpireDate.setDate(newExpireDate.getDate() + 30)
    } else {
      // 已过期或从未开过，从当天起算30天
      newExpireDate = new Date(now)
      newExpireDate.setDate(newExpireDate.getDate() + 30)
    }

    // 事务：更新邀请码状态 + 更新用户会员信息
    await prisma.$transaction([
      prisma.invitationCode.update({
        where: { id: inviteCode.id },
        data: {
          used: true,
          usedBy: user.id,
          usedAt: now,
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          vipType: 'month',
          vipExpire: newExpireDate,
        },
      }),
    ])

    return NextResponse.json({
      message: '会员开通成功',
      vipType: 'month',
      vipExpire: newExpireDate.toISOString().split('T')[0],
    })
  } catch (error) {
    console.error('Validate invite code error:', error)
    return NextResponse.json(
      { error: '验证邀请码失败，请稍后重试' },
      { status: 500 }
    )
  }
}
