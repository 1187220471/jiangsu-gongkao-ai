import { prisma } from './db'
import { earnPoints } from './supply'
import type { PointsType } from './supply'

const VALID_DURATIONS = [30, 60] as const
type FocusDuration = (typeof VALID_DURATIONS)[number]
const TOLERANCE_MS = 5000

export interface StartFocusInput {
  userId: string
  duration: number
}

export async function startFocusSession({ userId, duration }: StartFocusInput) {
  if (!VALID_DURATIONS.includes(duration as FocusDuration)) {
    throw new Error('时长仅支持 30 或 60 分钟')
  }

  // 检查是否有进行中的 session
  const active = await prisma.focusSession.findFirst({
    where: { userId, status: 'active' },
  })
  if (active) {
    throw new Error('已有专注进行中')
  }

  const session = await prisma.focusSession.create({
    data: {
      userId,
      duration,
      status: 'active',
      startedAt: new Date(),
    },
  })

  return {
    sessionId: session.id,
    startedAt: session.startedAt,
    duration: session.duration,
  }
}

export interface EndFocusInput {
  userId: string
  sessionId: number
  clientNow?: number
}

export interface EndFocusResult {
  status: 'completed' | 'abandoned' | 'cheated'
  pointsAwarded: number
  balance: number
}

export async function endFocusSession({ userId, sessionId, clientNow }: EndFocusInput): Promise<EndFocusResult> {
  const session = await prisma.focusSession.findUnique({
    where: { id: sessionId },
  })

  if (!session) {
    throw new Error('专注记录不存在')
  }
  if (session.userId !== userId) {
    throw new Error('无权操作该专注记录')
  }
  if (session.status !== 'active') {
    throw new Error('该专注已结束')
  }

  const requiredMs = session.duration * 60 * 1000
  const now = clientNow ? new Date(clientNow) : new Date()
  const elapsed = now.getTime() - session.startedAt.getTime()

  // 容差：服务端要求 elapsed >= required - 5s 才算有效
  const valid = elapsed + TOLERANCE_MS >= requiredMs

  if (!valid) {
    // 作弊：客户端在时长未到时尝试结束
    const updated = await prisma.focusSession.update({
      where: { id: sessionId },
      data: {
        status: 'cheated',
        endedAt: now,
      },
    })
    return {
      status: 'cheated',
      pointsAwarded: 0,
      balance: await getBalance(userId),
    }
  }

  // 完成：发放学习点
  const pointsType: PointsType = session.duration === 60 ? 'focus60' : 'focus30'
  const result = await earnPoints({
    userId,
    type: pointsType,
    refId: `focus:${sessionId}`,
  })

  await prisma.focusSession.update({
    where: { id: sessionId },
    data: {
      status: 'completed',
      endedAt: now,
      pointsAwarded: result.alreadyEarned ? 0 : session.duration === 60 ? 4 : 2,
    },
  })

  return {
    status: 'completed',
    pointsAwarded: result.alreadyEarned ? 0 : session.duration === 60 ? 4 : 2,
    balance: result.balance,
  }
}

/**
 * 用户主动放弃（不发放学习点）
 */
export async function abandonFocusSession({ userId, sessionId }: { userId: string; sessionId: number }) {
  const session = await prisma.focusSession.findUnique({ where: { id: sessionId } })
  if (!session) throw new Error('专注记录不存在')
  if (session.userId !== userId) throw new Error('无权操作该专注记录')
  if (session.status !== 'active') throw new Error('该专注已结束')

  await prisma.focusSession.update({
    where: { id: sessionId },
    data: { status: 'abandoned', endedAt: new Date() },
  })

  return { status: 'abandoned' as const, pointsAwarded: 0, balance: await getBalance(userId) }
}

async function getBalance(userId: string) {
  const points = await prisma.userPoints.findUnique({ where: { userId } })
  return points?.balance ?? 0
}

export interface TodayFocusSummary {
  totalMinutes: number
  completedMinutes: number
  sessions: Array<{
    id: number
    duration: number
    status: string
    pointsAwarded: number
    startedAt: string
    endedAt: string | null
  }>
}

export async function getTodayFocus(userId: string): Promise<TodayFocusSummary> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const sessions = await prisma.focusSession.findMany({
    where: { userId, startedAt: { gte: today } },
    orderBy: { startedAt: 'asc' },
  })

  const totalMinutes = sessions
    .filter((s) => s.status === 'completed')
    .reduce((sum, s) => sum + s.duration, 0)

  return {
    totalMinutes,
    completedMinutes: totalMinutes,
    sessions: sessions.map((s) => ({
      id: s.id,
      duration: s.duration,
      status: s.status,
      pointsAwarded: s.pointsAwarded,
      startedAt: s.startedAt.toISOString(),
      endedAt: s.endedAt ? s.endedAt.toISOString() : null,
    })),
  }
}
