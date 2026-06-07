import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const auth = requireAuth(request)
    if (!auth.success) {
      return auth.response
    }

    const url = new URL(request.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
    const pageSize = Math.min(20, Math.max(1, parseInt(url.searchParams.get('pageSize') || '10')))

    const [records, total] = await Promise.all([
      prisma.record.findMany({
        where: { userId: auth.userId },
        select: {
          id: true,
          questionType: true,
          question: true,
          score: true,
          createdAt: true,
          // 不返回大字段：userAnswer、evaluation、improvedAnswer
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.record.count({ where: { userId: auth.userId } }),
    ])

    return NextResponse.json({
      records,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error('Get history error:', error)
    return NextResponse.json(
      { error: '获取历史记录失败' },
      { status: 500 }
    )
  }
}
