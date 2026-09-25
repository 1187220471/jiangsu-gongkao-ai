import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const week = searchParams.get('week')

    const row = week
      ? await prisma.weeklyMaterial.findUnique({ where: { week } })
      : await prisma.weeklyMaterial.findFirst({ orderBy: { week: 'desc' } })

    if (!row) {
      return NextResponse.json({ error: '暂无素材数据' }, { status: 404 })
    }

    let articles = []
    try {
      articles = JSON.parse(row.articles)
    } catch {
      articles = []
    }

    return NextResponse.json({
      week: row.week,
      articles,
      updatedAt: row.updatedAt,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '获取素材失败' }, { status: 500 })
  }
}
