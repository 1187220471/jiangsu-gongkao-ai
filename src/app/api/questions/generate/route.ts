import { NextResponse } from 'next/server'
import { generateQuestion } from '@/lib/ai'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { checkQuota, deductQuota } from '@/lib/quota'

// 每个用户保留最近使用过的主题数量（FIFO队列）
// 增大到25以减少短周期内重复（原为10，社会现象类主题池有40+个）
const RECENT_TOPICS_LIMIT = 25

export async function POST(request: Request) {
  try {
    const auth = requireAuth(request)
    if (!auth.success) {
      return auth.response
    }

    const { type } = await request.json()

    if (!type) {
      return NextResponse.json(
        { error: '请选择题型' },
        { status: 400 }
      )
    }

    // 检查额度（出题消耗1点=0.5次）
    const quota = await checkQuota(auth.userId, 1)
    if (!quota.allowed) {
      return NextResponse.json(
        { error: quota.message },
        { status: 403 }
      )
    }

    // 原子事务：读取 → 出题 → 更新去重缓存
    // 用事务保证在并发请求下不会丢失更新
    const result = await prisma.$transaction(async (tx) => {
      // 1. 读取当前缓存
      const user = await tx.user.findUnique({
        where: { id: auth.userId },
        select: { recentTopics: true },
      })

      const recentTopics: string[] = user?.recentTopics ?? []

      // 2. 出题（传入排除主题）
      const { question, topic } = await generateQuestion(type, recentTopics)

      // 3. 更新 FIFO 队列
      const filtered = recentTopics.filter((t: string) => t !== topic)
      const updatedTopics = [topic, ...filtered].slice(0, RECENT_TOPICS_LIMIT)

      await tx.user.update({
        where: { id: auth.userId },
        data: { recentTopics: updatedTopics },
      })

      return { question, topic }
    })

    // 扣除额度（出题消耗1点=0.5次）
    await deductQuota(auth.userId, 1)

    return NextResponse.json({
      question: result.question,
      type,
    })
  } catch (error) {
    console.error('Generate question error:', error)
    return NextResponse.json(
      { error: '生成题目失败，请稍后重试' },
      { status: 500 }
    )
  }
}
