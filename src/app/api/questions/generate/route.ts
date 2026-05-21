import { NextResponse } from 'next/server'
import { generateQuestion } from '@/lib/ai'
import { prisma } from '@/lib/db'
import { verifyToken, getTokenFromRequest } from '@/lib/auth'
import { checkQuota } from '@/lib/quota'

// 去重缓存：每个用户保留最近使用过的主题数量
const RECENT_TOPICS_LIMIT = 10

export async function POST(request: Request) {
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

    const { type } = await request.json()

    if (!type) {
      return NextResponse.json(
        { error: '请选择题型' },
        { status: 400 }
      )
    }

    // 检查额度
    const quota = await checkQuota(payload.userId)
    if (!quota.allowed) {
      return NextResponse.json(
        { error: quota.message },
        { status: 403 }
      )
    }

    // 读取用户最近使用过的主题（去重缓存）
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { recentTopics: true },
    })

    const recentTopics = JSON.parse(user?.recentTopics || '[]') as string[]

    // 出题不扣次数，传入排除主题以实现去重
    const { question, topic } = await generateQuestion(type, recentTopics)

    // 更新去重缓存：将新主题加入队列，保持最近 N 个（FIFO）
    const updatedTopics = [...recentTopics.filter(t => t !== topic), topic]
    if (updatedTopics.length > RECENT_TOPICS_LIMIT) {
      updatedTopics.shift() // 移除最旧的主题
    }

    await prisma.user.update({
      where: { id: payload.userId },
      data: { recentTopics: updatedTopics },
    })

    return NextResponse.json({
      question,
      type,
      remainingFree: quota.remainingFree,
    })
  } catch (error) {
    console.error('Generate question error:', error)
    return NextResponse.json(
      { error: '生成题目失败，请稍后重试' },
      { status: 500 }
    )
  }
}
