import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const { username, password, nickname, inviteCode } = await request.json()

    if (!username || !password) {
      return NextResponse.json(
        { error: '用户名和密码不能为空' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: '密码长度至少6位' },
        { status: 400 }
      )
    }

    const existingUser = await prisma.user.findUnique({
      where: { username },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: '用户名已存在' },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    // 准备用户数据
    const userData: any = {
      username,
      password: hashedPassword,
      nickname: nickname || username,
    }

    // 如果有邀请码，校验并设置邀请权限
    let accessInfo = null
    if (inviteCode && typeof inviteCode === 'string' && inviteCode.trim()) {
      const code = inviteCode.trim().toUpperCase()
      const invite = await prisma.invitationCode.findUnique({
        where: { code },
      })

      if (invite && !invite.used) {
        const now = new Date()
        const expireDate = new Date(now)
        expireDate.setDate(expireDate.getDate() + 30)

        userData.accessLevel = 'month'
        userData.accessExpire = expireDate

        // 标记邀请码为已使用
        await prisma.invitationCode.update({
          where: { id: invite.id },
          data: {
            used: true,
            usedAt: now,
          },
        })

        accessInfo = {
          accessLevel: 'month',
          accessExpire: expireDate.toISOString().split('T')[0],
        }
      }
    }

    const user = await prisma.user.create({
      data: userData,
      select: {
        id: true,
        username: true,
        nickname: true,
      },
    })

    return NextResponse.json({
      message: accessInfo ? '注册成功，邀请权限已激活！' : '注册成功',
      user,
      accessInfo,
    })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json(
      { error: '注册失败，请稍后重试' },
      { status: 500 }
    )
  }
}
