import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const week = searchParams.get('week')

    // 一次取全部周（量级为几十期，MB 级内），支持历史周查看
    const all = await prisma.weeklyMaterial.findMany({
      orderBy: { week: 'desc' },
      select: { week: true, articles: true, updatedAt: true },
    })

    if (all.length === 0) {
      return NextResponse.json({ error: '暂无素材数据' }, { status: 404 })
    }

    const availableWeeks = all.map((r) => {
      let count = 0
      try {
        count = JSON.parse(r.articles).length
      } catch {
        count = 0
      }
      return { week: r.week, count }
    })

    const row = week ? all.find((r) => r.week === week) : all[0]
    if (!row) {
      return NextResponse.json({ error: '该周素材不存在' }, { status: 404 })
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
      availableWeeks,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '获取素材失败' }, { status: 500 })
  }
}
