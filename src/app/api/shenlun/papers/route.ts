import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { splitShenlunPaper } from '@/lib/shenlunPaperSplit'

export const dynamic = 'force-dynamic'

const MAX_RAW_TEXT = 30000

function defaultTitle(sourceFileName?: string | null): string {
  if (sourceFileName) {
    const name = sourceFileName.replace(/\.pdf$/i, '').trim()
    if (name) return name
  }
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `我的申论试卷 ${mm}-${dd}`
}

export async function POST(request: Request) {
  try {
    const auth = requireAuth(request)
    if (!auth.success) return auth.response

    const body = await request.json()
    const rawText = typeof body.rawText === 'string' ? body.rawText.trim() : ''

    if (!rawText) {
      return NextResponse.json({ error: '试卷原文不能为空' }, { status: 400 })
    }
    if (rawText.length < 200) {
      return NextResponse.json({ error: '原文内容过短，请检查文件或 OCR 结果' }, { status: 400 })
    }
    if (rawText.length > MAX_RAW_TEXT) {
      return NextResponse.json(
        { error: `原文超过 ${MAX_RAW_TEXT} 字，请拆分后上传` },
        { status: 400 }
      )
    }

    const examYear =
      body.examYear !== undefined && body.examYear !== null && body.examYear !== ''
        ? Number(body.examYear)
        : null
    if (examYear !== null && (!Number.isInteger(examYear) || examYear < 2000 || examYear > 2100)) {
      return NextResponse.json({ error: '年份不合法' }, { status: 400 })
    }

    const examCategory =
      typeof body.examCategory === 'string' && body.examCategory.trim()
        ? body.examCategory.trim().slice(0, 10)
        : null

    const split = splitShenlunPaper(rawText)

    const paper = await prisma.shenlunPaper.create({
      data: {
        userId: auth.userId,
        title:
          typeof body.title === 'string' && body.title.trim()
            ? body.title.trim().slice(0, 80)
            : defaultTitle(body.sourceFileName),
        examYear,
        examCategory,
        sourceFileName:
          typeof body.sourceFileName === 'string' ? body.sourceFileName.slice(0, 200) : null,
        pageCount: Number.isInteger(body.pageCount) ? Math.max(0, Number(body.pageCount)) : 0,
        extractMode: body.extractMode === 'ocr' ? 'ocr' : 'text',
        rawText,
        materialsText: split.materialsText,
        splitWarnings: split.warnings,
        questions: {
          create: split.questions.map((q) => ({
            questionNumber: q.questionNumber,
            questionText: q.questionText,
            questionType: q.questionType,
            score: q.score,
            wordLimit: q.wordLimit,
          })),
        },
      },
      include: {
        questions: { orderBy: { questionNumber: 'asc' } },
      },
    })

    return NextResponse.json({
      paper: {
        id: paper.id,
        title: paper.title,
        examYear: paper.examYear,
        examCategory: paper.examCategory,
        pageCount: paper.pageCount,
        extractMode: paper.extractMode,
        createdAt: paper.createdAt,
      },
      materialsText: paper.materialsText,
      questions: paper.questions,
      warnings: split.warnings,
      cost: 0,
    })
  } catch (error) {
    console.error('Create shenlun paper error:', error)
    return NextResponse.json({ error: '保存试卷失败，请稍后重试' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const auth = requireAuth(request)
    if (!auth.success) return auth.response

    const url = new URL(request.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
    const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20')))

    const where = { userId: auth.userId }

    const [total, papers] = await Promise.all([
      prisma.shenlunPaper.count({ where }),
      prisma.shenlunPaper.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          title: true,
          examYear: true,
          examCategory: true,
          pageCount: true,
          extractMode: true,
          createdAt: true,
          questions: { select: { answerStatus: true } },
        },
      }),
    ])

    return NextResponse.json({
      papers: papers.map((p) => ({
        id: p.id,
        title: p.title,
        examYear: p.examYear,
        examCategory: p.examCategory,
        pageCount: p.pageCount,
        extractMode: p.extractMode,
        createdAt: p.createdAt,
        questionCount: p.questions.length,
        readyCount: p.questions.filter((q) => q.answerStatus === 'ready').length,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error('List shenlun papers error:', error)
    return NextResponse.json({ error: '获取试卷列表失败' }, { status: 500 })
  }
}
