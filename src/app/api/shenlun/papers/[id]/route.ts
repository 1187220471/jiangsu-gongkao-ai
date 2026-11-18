import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = requireAuth(request)
    if (!auth.success) return auth.response

    const paper = await prisma.shenlunPaper.findFirst({
      where: { id: params.id, userId: auth.userId },
      select: {
        id: true,
        title: true,
        examYear: true,
        examCategory: true,
        pageCount: true,
        extractMode: true,
        materialsText: true,
        splitWarnings: true,
        createdAt: true,
        questions: {
          orderBy: { questionNumber: 'asc' },
          select: {
            id: true,
            questionNumber: true,
            questionText: true,
            questionType: true,
            score: true,
            wordLimit: true,
            answerText: true,
            answerCharCount: true,
            answerStatus: true,
            answerError: true,
            generatedAt: true,
            updatedAt: true,
          },
        },
      },
    })

    if (!paper) {
      return NextResponse.json({ error: '试卷不存在' }, { status: 404 })
    }

    const ready = paper.questions.filter((q) => q.answerStatus === 'ready').length

    return NextResponse.json({
      paper: {
        id: paper.id,
        title: paper.title,
        examYear: paper.examYear,
        examCategory: paper.examCategory,
        pageCount: paper.pageCount,
        extractMode: paper.extractMode,
        materialsText: paper.materialsText,
        splitWarnings: paper.splitWarnings,
        createdAt: paper.createdAt,
      },
      questions: paper.questions,
      stats: { total: paper.questions.length, ready },
    })
  } catch (error) {
    console.error('Get shenlun paper error:', error)
    return NextResponse.json({ error: '获取试卷失败' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = requireAuth(request)
    if (!auth.success) return auth.response

    const body = await request.json()
    const data: { title?: string; examYear?: number | null; examCategory?: string | null } = {}

    if (typeof body.title === 'string' && body.title.trim()) {
      data.title = body.title.trim().slice(0, 80)
    }
    if (body.examYear === null || body.examYear === '') {
      data.examYear = null
    } else if (body.examYear !== undefined) {
      const year = Number(body.examYear)
      if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        return NextResponse.json({ error: '年份不合法' }, { status: 400 })
      }
      data.examYear = year
    }
    if (body.examCategory === null || body.examCategory === '') {
      data.examCategory = null
    } else if (typeof body.examCategory === 'string') {
      data.examCategory = body.examCategory.trim().slice(0, 10)
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: '没有可更新的字段' }, { status: 400 })
    }

    const result = await prisma.shenlunPaper.updateMany({
      where: { id: params.id, userId: auth.userId },
      data,
    })

    if (result.count === 0) {
      return NextResponse.json({ error: '试卷不存在' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Update shenlun paper error:', error)
    return NextResponse.json({ error: '更新失败' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = requireAuth(request)
    if (!auth.success) return auth.response

    const result = await prisma.shenlunPaper.deleteMany({
      where: { id: params.id, userId: auth.userId },
    })

    if (result.count === 0) {
      return NextResponse.json({ error: '试卷不存在' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete shenlun paper error:', error)
    return NextResponse.json({ error: '删除失败' }, { status: 500 })
  }
}
