import { prisma } from './db'

export interface QuotaCheckResult {
  allowed: boolean
  remainingFree: number
  message: string
}

/**
 * 检查用户是否有额度调用AI服务
 * - 邀请用户：无限次（在有效期内）
 * - 普通用户：每日10点免费（1次出题=1点，1次批改=2点）
 */
export async function checkQuota(userId: string, cost: number = 2): Promise<QuotaCheckResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      dailyFreeCount: true,
      freeCountResetAt: true,
      coins: true,
      accessLevel: true,
      accessExpire: true,
    },
  })

  if (!user) {
    return { allowed: false, remainingFree: 0, message: '用户不存在' }
  }

  // 1. 检查是否是邀请用户且在有效期内
  const now = new Date()
  if (user.accessLevel !== 'none' && user.accessExpire && user.accessExpire > now) {
    return { allowed: true, remainingFree: 999, message: '邀请用户，无限使用' }
  }

  // 2. 检查是否需要重置每日免费点数（跨天了）
  const resetAt = new Date(user.freeCountResetAt)
  const isSameDay = resetAt.toDateString() === now.toDateString()

  if (!isSameDay) {
    // 重置免费点数为10点（=5次批改或10次出题）
    await prisma.user.update({
      where: { id: userId },
      data: {
        dailyFreeCount: 10,
        freeCountResetAt: now,
      },
    })
    return { allowed: true, remainingFree: 10, message: '今日免费额度已重置（10点）' }
  }

  // 3. 检查免费点数是否足够
  if (user.dailyFreeCount >= cost) {
    return {
      allowed: true,
      remainingFree: user.dailyFreeCount,
      message: `今日剩余额度：${user.dailyFreeCount}点`,
    }
  }

  // 4. 免费点数不够，检查是否有练习币（1币=2点）
  const totalPoints = user.dailyFreeCount + user.coins * 2
  if (totalPoints >= cost) {
    return {
      allowed: true,
      remainingFree: user.dailyFreeCount,
      message: `免费点数不足，将扣除练习币（剩余${user.coins}币）`,
    }
  }

  // 5. 完全没额度了
  return {
    allowed: false,
    remainingFree: 0,
    message: '本日额度已用完。每日10点（1次出题=1点，1次批改=2点），明日自动恢复。',
  }
}

/**
 * 扣除用户额度（免费次数或练习币）
 * @param cost 消耗点数，1点=0.5次。默认2点=1次批改
 */
export async function deductQuota(userId: string, cost: number = 2): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      dailyFreeCount: true,
      coins: true,
      accessLevel: true,
      accessExpire: true,
    },
  })

  if (!user) return

  const now = new Date()
  // 邀请用户不扣额度
  if (user.accessLevel !== 'none' && user.accessExpire && user.accessExpire > now) {
    return
  }

  // 有免费次数先扣免费次数（点数制）
  if (user.dailyFreeCount >= cost) {
    await prisma.user.update({
      where: { id: userId },
      data: { dailyFreeCount: { decrement: cost } },
    })
    return
  }

  // 免费点数不够，先扣完剩余点数，再扣练习币（1币=2点）
  const remainingPoints = user.dailyFreeCount
  const pointsNeeded = cost - remainingPoints
  const coinsNeeded = Math.ceil(pointsNeeded / 2)

  if (remainingPoints > 0) {
    if (user.coins >= coinsNeeded) {
      // 扣完剩余点数 + 扣币
      await prisma.user.update({
        where: { id: userId },
        data: {
          dailyFreeCount: 0,
          coins: { decrement: coinsNeeded },
        },
      })
      return
    }
  } else {
    // 没有免费点数了，直接扣币
    if (user.coins > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: { coins: { decrement: Math.max(1, coinsNeeded) } },
      })
      return
    }
  }
}

/**
 * 获取用户额度信息（用于前端展示）
 */
export async function getQuotaInfo(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      dailyFreeCount: true,
      freeCountResetAt: true,
      coins: true,
      accessLevel: true,
      accessExpire: true,
    },
  })

  if (!user) return null

  const now = new Date()
  const resetAt = new Date(user.freeCountResetAt)
  const isSameDay = resetAt.toDateString() === now.toDateString()

  let remainingFree = user.dailyFreeCount
  if (!isSameDay) {
    remainingFree = 10 // 跨天了，还没重置，前端显示10点
  }

  const hasAccess = user.accessLevel !== 'none' && user.accessExpire && user.accessExpire > now

  return {
    hasAccess,
    accessLevel: user.accessLevel,
    accessExpire: user.accessExpire,
    remainingFree: hasAccess ? 999 : remainingFree,
    coins: user.coins,
  }
}

/**
 * 检查用户是否为有效邀请用户
 * 用于邀请专享功能（如套题训练）
 */
export async function checkAccess(userId: string): Promise<{ hasAccess: boolean; message: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      accessLevel: true,
      accessExpire: true,
    },
  })

  if (!user) {
    return { hasAccess: false, message: '用户不存在' }
  }

  const now = new Date()
  const hasAccess = user.accessLevel !== 'none' && user.accessExpire && user.accessExpire > now

  if (hasAccess) {
    return { hasAccess: true, message: '邀请用户' }
  }

  return { hasAccess: false, message: '该功能为邀请用户专享' }
}
