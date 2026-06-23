import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'

const prisma = new PrismaClient()

const JWT_SECRET = process.env.JWT_SECRET || ''
const WECHAT_APPID = process.env.WECHAT_APPID || ''
const WECHAT_SECRET = process.env.WECHAT_SECRET || ''

export async function POST(request: Request) {
  try {
    const { code } = await request.json()

    if (!code) {
      return NextResponse.json({ error: '缺少code参数' }, { status: 400 })
    }

    if (!WECHAT_APPID || !WECHAT_SECRET) {
      return NextResponse.json({ error: '微信配置未设置' }, { status: 500 })
    }

    console.log('微信登录请求:', { code: code?.slice(0, 10) + '...', WECHAT_APPID: WECHAT_APPID?.slice(0, 5) + '...' })

    // 1. 调用微信接口换取openid
    const wxUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${WECHAT_APPID}&secret=${WECHAT_SECRET}&js_code=${code}&grant_type=authorization_code`
    console.log('请求微信接口:', wxUrl.replace(WECHAT_SECRET, '***'))
    
    const wxRes = await fetch(wxUrl)
    const wxData = await wxRes.json()
    
    console.log('微信接口返回:', wxData)

    if (wxData.errcode) {
      return NextResponse.json(
        { error: `微信接口错误: ${wxData.errmsg}` },
        { status: 400 }
      )
    }

    const { openid } = wxData

    // 2. 查找或创建用户
    let user = await prisma.user.findUnique({ where: { openid } })

    if (!user) {
      // 创建新用户
      user = await prisma.user.create({
        data: {
          openid,
          username: `wx_${openid.slice(-8)}`,
          password: '', // 微信用户无密码
          nickname: '微信用户',
        },
      })
    }

    // 3. 生成JWT
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
      },
    })
  } catch (error) {
    console.error('微信登录失败:', error)
    return NextResponse.json({ error: '登录失败' }, { status: 500 })
  }
}
