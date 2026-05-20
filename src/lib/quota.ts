import { prisma } from './db'

export interface QuotaCheckResult {
  allowed: boolean
  remainingFree: number
  message: string
}

/**
 * 检查用户是否有额度调用AI服务
 * - VIP用户：无限次（在有效期内）
 * - 普通用户：每日3次免费，超出后需要付费
 */
export async function checkQuota(userId: string): Promise<QuotaCheckResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      dailyFreeCount: true,
      freeCountResetAt: true,
      coins: true,
      vipType: true,
      vipExpire: true,
    },
  })

  if (!user) {
    return { allowed: false, remainingFree: 0, message: '用户不存在' }
  }

  // 1. 检查是否是VIP且在有效期内
  const now = new Date()
  if (user.vipType !== 'none' && user.vipExpire && user.vipExpire > now) {
    return { allowed: true, remainingFree: 999, message: 'VIP会员，无限使用' }
  }

  // 2. 检查是否需要重置每日免费次数（跨天了）
  const resetAt = new Date(user.freeCountResetAt)
  const isSameDay =
    resetAt.getFullYear() === now.getFullYear() &&
    resetAt.getMonth() === now.getMonth() &&
    resetAt.getDate() === now.getDate()

  if (!isSameDay) {
    // 重置免费次数
    await prisma.user.update({
      where: { id: userId },
      data: {
        dailyFreeCount: 3,
        freeCountResetAt: now,
      },
    })
    return { allowed: true, remainingFree: 3, message: '今日免费额度已重置（3次）' }
  }

  // 3. 检查免费次数
  if (user.dailyFreeCount > 0) {
    return {
      allowed: true,
      remainingFree: user.dailyFreeCount,
      message: `今日剩余免费次数：${user.dailyFreeCount}次`,
    }
  }

  // 4. 免费次数用完了，检查是否有练习币（后续付费机制）
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
    message: '今日免费次数已用完（3次/天），请联系老师充值',
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
      vipType: true,
      vipExpire: true,
    },
  })

  if (!user) return

  const now = new Date()
  // VIP用户不扣额度
  if (user.vipType !== 'none' && user.vipExpire && user.vipExpire > now) {
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
      vipType: true,
      vipExpire: true,
    },
  })

  if (!user) return null

  const now = new Date()
  const resetAt = new Date(user.freeCountResetAt)
  const isSameDay =
    resetAt.getFullYear() === now.getFullYear() &&
    resetAt.getMonth() === now.getMonth() &&
    resetAt.getDate() === now.getDate()

  let remainingFree = user.dailyFreeCount
  if (!isSameDay) {
    remainingFree = 3 // 跨天了，还没重置，前端显示3次
  }

  const isVip = user.vipType !== 'none' && user.vipExpire && user.vipExpire > now

  return {
    isVip,
    vipType: user.vipType,
    vipExpire: user.vipExpire,
    remainingFree: isVip ? 999 : remainingFree,
    coins: user.coins,
  }
}
