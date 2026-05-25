import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const auth = requireAuth(request)
    if (!auth.success) {
      return auth.response
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
      where: { id: auth.userId },
      select: {
        id: true,
        accessLevel: true,
        accessExpire: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    const now = new Date()

    // 根据邀请码类型确定续费天数
    const daysToAdd = inviteCode.type === 'year' ? 365 : 30
    const typeLabel = inviteCode.type === 'year' ? '365天邀请权限' : '30天邀请权限'

    // 续期逻辑：已过期从当天起算，未过期则顺延
    let newExpireDate: Date
    if (user.accessExpire && user.accessExpire > now) {
      // 未过期，在现有到期日基础上顺延
      newExpireDate = new Date(user.accessExpire)
      newExpireDate.setDate(newExpireDate.getDate() + daysToAdd)
    } else {
      // 已过期或从未激活过，从当天起算
      newExpireDate = new Date(now)
      newExpireDate.setDate(newExpireDate.getDate() + daysToAdd)
    }

    // 事务：更新邀请码状态 + 更新用户权限信息
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
          accessLevel: inviteCode.type,
          accessExpire: newExpireDate,
        },
      }),
    ])

    return NextResponse.json({
      message: `${typeLabel}激活成功`,
      accessLevel: inviteCode.type,
      accessExpire: newExpireDate.toISOString().split('T')[0],
    })
  } catch (error) {
    console.error('Validate invite code error:', error)
    return NextResponse.json(
      { error: '验证邀请码失败，请稍后重试' },
      { status: 500 }
    )
  }
}
