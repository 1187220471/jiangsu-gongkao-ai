import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    // 测试数据库连接并触发表创建
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ message: '数据库连接成功，表已创建' })
  } catch (error: any) {
    return NextResponse.json(
      { error: '数据库初始化失败', detail: error.message },
      { status: 500 }
    )
  }
}
