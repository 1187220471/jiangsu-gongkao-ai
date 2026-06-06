import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')

    // 如果没有指定日期，默认返回今天
    const targetDate = date || new Date().toISOString().split('T')[0]

    const news = await prisma.dailyNews.findUnique({
      where: { date: targetDate },
    })

    if (!news) {
      return NextResponse.json(
        { error: '当日新闻尚未生成，请稍后查看' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      date: news.date,
      topNews: JSON.parse(news.topNews),
      allNews: news.allNews ? JSON.parse(news.allNews) : [],
      createdAt: news.createdAt,
    })
  } catch (error) {
    console.error('查询每日新闻失败:', error)
    return NextResponse.json(
      { error: '查询失败' },
      { status: 500 }
    )
  }
}
