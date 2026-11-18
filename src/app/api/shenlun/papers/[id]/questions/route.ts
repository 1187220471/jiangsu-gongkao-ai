import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { normalizeQuestionType } from '@/lib/shenlunTypes'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = requireAuth(request)
    if (!auth.success) return auth.response

    const paper = await prisma.shenlunPaper.findFirst({
      where: { id: params.id, userId: auth.userId },
      select: { id: true },
    })
    if (!paper) {
      return NextResponse.json({ error: '试卷不存在' }, { status: 404 })
    }

    const body = await request.json()
    const questionText = typeof body.questionText === 'string' ? body.questionText.trim() : ''
    if (!questionText) {
      return NextResponse.json({ error: '题干不能为空' }, { status: 400 })
    }
    if (questionText.length > 5000) {
      return NextResponse.json({ error: '题干过长' }, { status: 400 })
    }

    const last = await prisma.shenlunPaperQuestion.findFirst({
      where: { paperId: paper.id },
      orderBy: { questionNumber: 'desc' },
      select: { questionNumber: true },
    })

    const question = await prisma.shenlunPaperQuestion.create({
      data: {
        paperId: paper.id,
        questionNumber: (last?.questionNumber || 0) + 1,
        questionText,
        questionType: normalizeQuestionType(body.questionType || ''),
        score:
          Number.isInteger(body.score) && body.score >= 1 && body.score <= 100
            ? Number(body.score)
            : null,
        wordLimit:
          typeof body.wordLimit === 'string' && body.wordLimit.trim()
            ? body.wordLimit.trim().slice(0, 40)
            : null,
      },
    })

    return NextResponse.json({ question })
  } catch (error) {
    console.error('Add shenlun paper question error:', error)
    return NextResponse.json({ error: '添加题目失败' }, { status: 500 })
  }
}
