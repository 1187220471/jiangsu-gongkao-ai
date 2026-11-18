import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

/**
 * 定时任务鉴权。
 *
 * 支持三种传法（cron-job.org 用 query 最省事，Vercel Cron 用 Bearer）：
 *   Authorization: Bearer <secret>
 *   x-cron-secret: <secret>
 *   ?secret=<secret>
 *
 * 未配置 CRON_SECRET 时 fail-closed（503）：宁可让调度端报错，
 * 也不让公网匿名请求随手触发 AI 调用与全表写库。
 */
export function requireCronSecret(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET

  if (!secret) {
    return NextResponse.json(
      {
        error: '定时任务未配置 CRON_SECRET，已拒绝执行',
        code: 'CRON_NOT_CONFIGURED',
        hint: '在部署平台添加 CRON_SECRET，并让调度端带上 ?secret=... 或 Authorization: Bearer ...',
      },
      { status: 503 }
    )
  }

  const authHeader = request.headers.get('authorization') || ''
  const bearer = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : ''
  const headerSecret = request.headers.get('x-cron-secret') || ''
  const querySecret = new URL(request.url).searchParams.get('secret') || ''

  const provided = bearer || headerSecret || querySecret

  if (!provided || !safeEqual(provided, secret)) {
    return NextResponse.json({ error: '未授权', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  return null
}
