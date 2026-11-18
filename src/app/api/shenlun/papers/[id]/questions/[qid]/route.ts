import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { normalizeQuestionType } from '@/lib/shenlunTypes'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; qid: string } }
) {
  try {
    const auth = requireAuth(request)
    if (!auth.success) return auth.response

    const existing = await prisma.shenlunPaperQuestion.findFirst({
      where: { id: params.qid, paperId: params.id, paper: { userId: auth.userId } },
      select: { id: true, questionText: true, questionType: true, wordLimit: true },
    })
    if (!existing) {
      return NextResponse.json({ error: '题目不存在' }, { status: 404 })
    }

    const body = await request.json()
    const data: Record<string, unknown> = {}
    let answerInvalidated = false

    if (typeof body.questionText === 'string') {
      const text = body.questionText.trim()
      if (!text) {
        return NextResponse.json({ error: '题干不能为空' }, { status: 400 })
      }
      if (text.length > 5000) {
        return NextResponse.json({ error: '题干过长' }, { status: 400 })
      }
      if (text !== existing.questionText) {
        data.questionText = text
        answerInvalidated = true
      }
    }

    if (typeof body.questionType === 'string') {
      const type = normalizeQuestionType(body.questionType)
      if (type !== existing.questionType) {
        data.questionType = type
        answerInvalidated = true
      }
    }

    if (body.wordLimit === null || body.wordLimit === '') {
      if (existing.wordLimit) {
        data.wordLimit = null
        answerInvalidated = true
      }
    } else if (typeof body.wordLimit === 'string') {
      const limit = body.wordLimit.trim().slice(0, 40)
      if (limit !== existing.wordLimit) {
        data.wordLimit = limit
        answerInvalidated = true
      }
    }

    if (body.score === null) {
      data.score = null
    } else if (body.score !== undefined) {
      const score = Number(body.score)
      if (!Number.isInteger(score) || score < 1 || score > 100) {
        return NextResponse.json({ error: '分值不合法' }, { status: 400 })
      }
      data.score = score
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: '没有可更新的字段' }, { status: 400 })
    }

    if (answerInvalidated) {
      data.answerText = null
      data.answerCharCount = 0
      data.answerStatus = 'pending'
      data.answerError = null
      data.generatedAt = null
    }

    const question = await prisma.shenlunPaperQuestion.update({
      where: { id: existing.id },
      data,
    })

    return NextResponse.json({ question })
  } catch (error) {
    console.error('Update shenlun paper question error:', error)
    return NextResponse.json({ error: '更新题目失败' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; qid: string } }
) {
  try {
    const auth = requireAuth(request)
    if (!auth.success) return auth.response

    const result = await prisma.shenlunPaperQuestion.deleteMany({
      where: { id: params.qid, paperId: params.id, paper: { userId: auth.userId } },
    })

    if (result.count === 0) {
      return NextResponse.json({ error: '题目不存在' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete shenlun paper question error:', error)
    return NextResponse.json({ error: '删除题目失败' }, { status: 500 })
  }
}
