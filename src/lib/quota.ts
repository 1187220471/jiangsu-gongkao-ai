import { prisma } from './db'

export interface QuotaCheckResult {
  allowed: boolean
  remainingFree: number
  message: string
}

/**
 * 检查用户是否有额度调用AI服务
 * - 邀请用户：无限次（在有效期内）
 * - 普通用户：每日5次免费
 */
export async function checkQuota(userId: string): Promise<QuotaCheckResult> {
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

  // 2. 检查是否需要重置每日免费次数（跨天了）
  const resetAt = new Date(user.freeCountResetAt)
  const isSameDay = resetAt.toDateString() === now.toDateString()

  if (!isSameDay) {
    // 重置免费次数
    await prisma.user.update({
      where: { id: userId },
      data: {
        dailyFreeCount: 5,
        freeCountResetAt: now,
      },
    })
    return { allowed: true, remainingFree: 5, message: '今日免费额度已重置（5次）' }
  }

  // 3. 检查免费次数
  if (user.dailyFreeCount > 0) {
    return {
      allowed: true,
      remainingFree: user.dailyFreeCount,
      message: `今日剩余免费次数：${user.dailyFreeCount}次`,
    }
  }

  // 4. 免费次数用完了，检查是否有练习币
  if (user.coins > 0) {
    return {
      allowed: true,
      remainingFree: 0,
      message: `免费次数已用完，将扣除练习币（剩余${user.coins}币）`,
    }
  }

  // 5. 完全没额度了
  return {
    allowed: false,
    remainingFree: 0,
    message: '本日额度已用完。每日5次，明日自动恢复。',
  }
}

/**
 * 扣除用户额度（免费次数或练习币）
 */
export async function deductQuota(userId: string): Promise<void> {
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

  // 有免费次数先扣免费次数
  if (user.dailyFreeCount > 0) {
    await prisma.user.update({
      where: { id: userId },
      data: { dailyFreeCount: { decrement: 1 } },
    })
    return
  }

  // 免费次数用完了扣练习币
  if (user.coins > 0) {
    await prisma.user.update({
      where: { id: userId },
      data: { coins: { decrement: 1 } },
    })
    return
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
    remainingFree = 5 // 跨天了，还没重置，前端显示5次
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
