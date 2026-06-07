import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = requireAuth(request)
    if (!auth.success) {
      return auth.response
    }

    const id = parseInt(params.id)
    if (isNaN(id)) {
      return NextResponse.json({ error: '参数错误' }, { status: 400 })
    }

    const question = await prisma.zhentiQuestion.findUnique({
      where: { id },
    })

    if (!question) {
      return NextResponse.json({ error: '题目不存在' }, { status: 404 })
    }

    // 并行获取收藏状态和同场次题目
    const [bookmark, siblings] = await Promise.all([
      prisma.zhentiBookmark.findUnique({
        where: { userId_questionId: { userId: auth.userId, questionId: id } },
      }),
      prisma.zhentiQuestion.findMany({
        where: { examDate: question.examDate, examCategory: question.examCategory },
        select: { id: true, questionNumber: true },
        orderBy: { questionNumber: 'asc' },
      }),
    ])

    // 安全解析 comparison JSON
    let parsedComparison = {}
    try {
      parsedComparison = JSON.parse(question.comparison || '{}')
    } catch {
      console.warn(`题目 ${id} 的 comparison 字段 JSON 解析失败`)
      parsedComparison = {}
    }

    return NextResponse.json({
      question: {
        ...question,
        comparison: parsedComparison,
      },
      bookmark: bookmark
        ? { proficiency: bookmark.proficiency, notes: bookmark.notes }
        : null,
      siblings,
    })
  } catch (error) {
    console.error('Zhenti detail error:', error)
    return NextResponse.json({ error: '获取题目详情失败' }, { status: 500 })
  }
}
