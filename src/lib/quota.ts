import { prisma } from './db'

export interface QuotaCheckResult {
  allowed: boolean
  remainingFree: number
  message: string
}

// 内部存储倍数：0.5点 = 1个存储单位
const SCALE = 2
// 每日免费额度：5点 = 10个存储单位
const DAILY_FREE_POINTS = 5
const DAILY_FREE_STORAGE = DAILY_FREE_POINTS * SCALE

/**
 * 检查用户是否有额度调用AI服务
 * - 邀请用户：无限次（在有效期内）
 * - 普通用户：每日5点免费（1次出题=0.5点，1次批改=1点）
 */
export async function checkQuota(userId: string, costInPoints: number = 1): Promise<QuotaCheckResult> {
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
    // 重置免费额度为5点（存储为10）
    await prisma.user.update({
      where: { id: userId },
      data: {
        dailyFreeCount: DAILY_FREE_STORAGE,
        freeCountResetAt: now,
      },
    })
    return { allowed: true, remainingFree: DAILY_FREE_POINTS, message: '今日免费额度已重置（5点）' }
  }

  // 将存储单位转换为显示点数
  const remainingPoints = user.dailyFreeCount / SCALE
  const costStorage = costInPoints * SCALE

  // 3. 检查免费点数是否足够
  if (user.dailyFreeCount >= costStorage) {
    return {
      allowed: true,
      remainingFree: remainingPoints,
      message: `今日剩余额度：${remainingPoints}点`,
    }
  }

  // 4. 免费点数不够，检查是否有练习币（1币=1点=2存储单位）
  const totalStorage = user.dailyFreeCount + user.coins * SCALE
  if (totalStorage >= costStorage) {
    return {
      allowed: true,
      remainingFree: remainingPoints,
      message: `免费点数不足，将扣除练习币（剩余${user.coins}币）`,
    }
  }

  // 5. 完全没额度了
  return {
    allowed: false,
    remainingFree: 0,
    message: '当日额度已用完，请等待0点刷新额度。',
  }
}

/**
 * 扣除用户额度（免费次数或练习币）
 * @param costInPoints 消耗点数，0.5点=出题，1点=批改。默认1点
 */
export async function deductQuota(userId: string, costInPoints: number = 1): Promise<void> {
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

  const costStorage = costInPoints * SCALE

  // 有免费点数先扣免费点数
  if (user.dailyFreeCount >= costStorage) {
    await prisma.user.update({
      where: { id: userId },
      data: { dailyFreeCount: { decrement: costStorage } },
    })
    return
  }

  // 免费点数不够，先扣完剩余点数，再扣练习币（1币=1点=2存储单位）
  const remainingStorage = user.dailyFreeCount
  const storageNeeded = costStorage - remainingStorage
  const coinsNeeded = Math.ceil(storageNeeded / SCALE)

  if (remainingStorage > 0) {
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

  let remainingFree = user.dailyFreeCount / SCALE
  if (!isSameDay) {
    remainingFree = DAILY_FREE_POINTS // 跨天了，还没重置，前端显示5点
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
