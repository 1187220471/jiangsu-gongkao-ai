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

    const question = await prisma.shenlunQuestion.findUnique({
      where: { id },
      include: {
        materials: {
          orderBy: { materialOrder: 'asc' },
          select: { materialNum: true, content: true },
        },
        answers: {
          orderBy: [
            { answerOrder: 'asc' },
          ],
          select: { id: true, teacherName: true, answerText: true, answerOrder: true },
        },
      },
    })

    if (!question) {
      return NextResponse.json({ error: '题目不存在' }, { status: 404 })
    }

    // 并行获取收藏状态和同场次题目
    const [bookmark, siblings] = await Promise.all([
      prisma.shenlunBookmark.findUnique({
        where: { userId_questionId: { userId: auth.userId, questionId: id } },
      }),
      prisma.shenlunQuestion.findMany({
        where: { examDate: question.examDate, examCategory: question.examCategory },
        select: { id: true, questionNumber: true, questionType: true },
        orderBy: { questionNumber: 'asc' },
      }),
    ])

    // 让 AI参考答案 排在最前面
    const sortedAnswers = [...question.answers].sort((a, b) => {
      if (a.teacherName === 'AI参考答案' && b.teacherName !== 'AI参考答案') return -1
      if (a.teacherName !== 'AI参考答案' && b.teacherName === 'AI参考答案') return 1
      return (a.answerOrder ?? 0) - (b.answerOrder ?? 0)
    })

    return NextResponse.json({
      question: {
        ...question,
        answers: sortedAnswers,
      },
      bookmark: bookmark
        ? { proficiency: bookmark.proficiency, notes: bookmark.notes }
        : null,
      siblings,
    })
  } catch (error) {
    console.error('Shenlun detail error:', error)
    return NextResponse.json({ error: '获取申论题目详情失败' }, { status: 500 })
  }
}
