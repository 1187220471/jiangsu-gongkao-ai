import { prisma } from './db'

export type PointsType =
  | 'answer'
  | 'set'
  | 'zhenti'
  | 'shenlun'
  | 'focus30'
  | 'focus60'
  | 'dailySign'
  | 'share'
  | 'draw'
  | 'drawRepeat'
  | 'achievement'

export const POINTS_REWARDS: Record<PointsType, number> = {
  answer: 1,
  set: 3,
  zhenti: 1,
  shenlun: 1,
  focus30: 2,
  focus60: 4,
  dailySign: 1,
  share: 1,
  draw: -3,
  drawRepeat: 2,
  achievement: 30,
}

export const DRAW_COST = 3
export const FREE_DRAW_PER_DAY = 1

export const RARITY_WEIGHTS = [
  { rarity: 'common', weight: 80 },
  { rarity: 'rare', weight: 20 },
]

export interface EarnPointsInput {
  userId: string
  type: PointsType
  refId?: string
}

export async function earnPoints({ userId, type, refId }: EarnPointsInput) {
  const amount = POINTS_REWARDS[type]
  if (amount <= 0) {
    throw new Error(`类型 ${type} 不是奖励类型`)
  }

  // 幂等：同一 refId + type 只发一次
  if (refId) {
    const existing = await prisma.pointsLog.findFirst({
      where: { userId, type, refId },
    })
    if (existing) {
      return { balance: await getBalance(userId), alreadyEarned: true }
    }
  }

  await prisma.$transaction([
    prisma.userPoints.upsert({
      where: { userId },
      update: {
        balance: { increment: amount },
        totalEarned: { increment: amount },
      },
      create: {
        userId,
        balance: amount,
        totalEarned: amount,
      },
    }),
    prisma.pointsLog.create({
      data: { userId, amount, type, refId: refId ?? null },
    }),
  ])

  return { balance: await getBalance(userId), alreadyEarned: false }
}

export async function spendPoints(userId: string, amount: number, type: PointsType, refId?: string) {
  return prisma.$transaction(async (tx) => {
    const points = await tx.userPoints.findUnique({ where: { userId } })
    if (!points || points.balance < amount) {
      throw new Error('学习点不足')
    }

    await tx.userPoints.update({
      where: { userId },
      data: {
        balance: { decrement: amount },
        totalSpent: { increment: amount },
      },
    })

    await tx.pointsLog.create({
      data: { userId, amount: -amount, type, refId: refId ?? null },
    })

    return { balance: points.balance - amount }
  })
}

export async function getBalance(userId: string) {
  const points = await prisma.userPoints.findUnique({ where: { userId } })
  return points?.balance ?? 0
}

/**
 * 检查今日免费抽是否已使用（与 drawItem 内的判定逻辑保持一致）
 */
export async function hasFreeDrawToday(userId: string): Promise<boolean> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const freeDrawsToday = await prisma.pointsLog.count({
    where: {
      userId,
      type: 'draw',
      refId: { startsWith: 'free:' },
      createdAt: { gte: today },
    },
  })
  return freeDrawsToday >= FREE_DRAW_PER_DAY
}

export async function getCollection(userId: string) {
  const items = await prisma.supplyItem.findMany({
    orderBy: { id: 'asc' },
  })

  const userItems = await prisma.userCollection.findMany({
    where: { userId },
    include: { item: true },
  })

  const userMap = new Map(userItems.map((u) => [u.itemId, u]))

  return items.map((item) => ({
    ...item,
    obtainedAt: userMap.get(item.id)?.obtainedAt ?? null,
    isEquipped: userMap.get(item.id)?.isEquipped ?? false,
    collected: userMap.has(item.id),
  }))
}

export async function drawItem(userId: string, source: 'free' | 'paid') {
  return prisma.$transaction(async (tx) => {
    const drawRefId = `${source}:${Date.now()}`

    // 检查今日免费次数
    if (source === 'free') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const freeDrawsToday = await tx.pointsLog.count({
        where: {
          userId,
          type: 'draw',
          refId: { startsWith: 'free:' },
          createdAt: { gte: today },
        },
      })
      if (freeDrawsToday >= FREE_DRAW_PER_DAY) {
        throw new Error('今日免费抽取次数已用完')
      }
    }

    // 付费抽扣除学习点
    if (source === 'paid') {
      const points = await tx.userPoints.findUnique({ where: { userId } })
      if (!points || points.balance < DRAW_COST) {
        throw new Error('学习点不足')
      }
      await tx.userPoints.update({
        where: { userId },
        data: {
          balance: { decrement: DRAW_COST },
          totalSpent: { increment: DRAW_COST },
        },
      })
    }

    // 按稀有度抽奖
    const rarity = rollRarity(source)

    // 获取该稀有度下用户未拥有的物品
    const ownedIds = (
      await tx.userCollection.findMany({
        where: { userId },
        select: { itemId: true },
      })
    ).map((c) => c.itemId)

    const pool = await tx.supplyItem.findMany({
      where: { rarity, id: { notIn: ownedIds.length > 0 ? ownedIds : undefined } },
    })

    let item = pool.length > 0
      ? pool[Math.floor(Math.random() * pool.length)]
      : await tx.supplyItem.findFirst({ where: { rarity } })

    if (!item) {
      // fallback：任意稀有度物品
      const fallback = await tx.supplyItem.findMany()
      item = fallback[Math.floor(Math.random() * fallback.length)]
    }

    const isRepeat = ownedIds.includes(item.id)

    if (isRepeat) {
      // 重复抽到：自动兑换 +2 学习点
      await tx.userPoints.upsert({
        where: { userId },
        update: {
          balance: { increment: POINTS_REWARDS.drawRepeat },
          totalEarned: { increment: POINTS_REWARDS.drawRepeat },
        },
        create: {
          userId,
          balance: POINTS_REWARDS.drawRepeat,
          totalEarned: POINTS_REWARDS.drawRepeat,
        },
      })
      await tx.pointsLog.create({
        data: { userId, amount: POINTS_REWARDS.drawRepeat, type: 'drawRepeat', refId: drawRefId },
      })
    } else {
      await tx.userCollection.create({
        data: {
          userId,
          itemId: item.id,
          source: source === 'free' ? 'freeDraw' : 'paidDraw',
        },
      })
    }

    await tx.pointsLog.create({
      data: {
        userId,
        amount: source === 'paid' ? -DRAW_COST : 0,
        type: 'draw',
        refId: drawRefId,
      },
    })

    const pointsRecord = await tx.userPoints.findUnique({ where: { userId } })
    const balance = pointsRecord?.balance ?? 0

    return {
      item,
      isRepeat,
      repeatPoints: isRepeat ? POINTS_REWARDS.drawRepeat : 0,
      balance,
      source,
    }
  })
}

function rollRarity(source: 'free' | 'paid'): string {
  // 免费抽固定普通
  if (source === 'free') return 'common'

  const total = RARITY_WEIGHTS.reduce((sum, r) => sum + r.weight, 0)
  const rand = Math.random() * total
  let acc = 0
  for (const r of RARITY_WEIGHTS) {
    acc += r.weight
    if (rand <= acc) return r.rarity
  }
  return 'common'
}

export async function equipItem(userId: string, itemId: number | null) {
  return prisma.$transaction(async (tx) => {
    // 先取消所有装备
    await tx.userCollection.updateMany({
      where: { userId, isEquipped: true },
      data: { isEquipped: false },
    })

    if (itemId) {
      const collection = await tx.userCollection.findUnique({
        where: { userId_itemId: { userId, itemId } },
      })
      if (!collection) {
        throw new Error('未拥有该补给品')
      }
      await tx.userCollection.update({
        where: { userId_itemId: { userId, itemId } },
        data: { isEquipped: true },
      })
    }

    return { equippedItemId: itemId }
  })
}

export async function getEquippedItem(userId: string) {
  return prisma.userCollection.findFirst({
    where: { userId, isEquipped: true },
    include: { item: true },
  })
}
