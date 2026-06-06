import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET(request: NextRequest) {
  try {
    // 获取要检查的日期，默认昨天
    const url = new URL(request.url)
    const dateParam = url.searchParams.get('date')
    
    let checkDate: string
    if (dateParam === 'yesterday') {
      const now = new Date()
      const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000)
      beijingTime.setDate(beijingTime.getDate() - 1)
      checkDate = beijingTime.toISOString().split('T')[0]
    } else if (dateParam) {
      checkDate = dateParam
    } else {
      const now = new Date()
      const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000)
      checkDate = beijingTime.toISOString().split('T')[0]
    }

    // 检查指定日期的新闻是否存在
    const news = await prisma.dailyNews.findUnique({
      where: { date: checkDate },
    })

    // 检查最近7天的执行日志
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    const logs = await prisma.cronExecutionLog.findMany({
      where: {
        jobName: 'fetch-news',
        createdAt: { gte: sevenDaysAgo },
      },
      orderBy: { createdAt: 'desc' },
      take: 14,
    })

    const hasNews = !!news
    const topCount = news ? JSON.parse(news.topNews).length : 0

    // 如果指定日期没有数据，返回错误状态（方便 cron-job.org 告警）
    if (!hasNews) {
      return NextResponse.json({
        status: 'missing',
        date: checkDate,
        hasNews: false,
        topCount: 0,
        message: `${checkDate} 的新闻数据缺失，需要手动补录`,
        recentLogs: logs.map(l => ({
          status: l.status,
          message: l.message,
          createdAt: l.createdAt,
        })),
      }, { status: 503 }) // 503 Service Unavailable，cron-job.org 会在非2xx时告警
    }

    return NextResponse.json({
      status: 'ok',
      date: checkDate,
      hasNews: true,
      topCount,
      message: `${checkDate} 新闻数据正常 (${topCount} 条精选)`,
      recentLogs: logs.map(l => ({
        status: l.status,
        message: l.message,
        createdAt: l.createdAt,
      })),
    })
  } catch (error: any) {
    console.error('检查新闻状态失败:', error)
    return NextResponse.json(
      { status: 'error', message: error.message || '检查失败' },
      { status: 500 }
    )
  }
}
