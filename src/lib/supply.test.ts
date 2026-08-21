import { mock } from 'node:test'

const { test } = require('node:test')
const assert = require('node:assert')

// ---- 状态化 mock prisma（./db）----
let state: {
  pointsLogs: any[]
  userPointsRecord: any
}

function resetState() {
  state = { pointsLogs: [], userPointsRecord: null }
}
resetState()

const fakePrisma: any = {
  pointsLog: {
    findFirst: async ({ where }: any) =>
      state.pointsLogs.find(
        (p) => p.userId === where.userId && p.type === where.type && p.refId === where.refId
      ) ?? null,
    count: async ({ where }: any) => {
      let n = state.pointsLogs.filter((p) => p.userId === where.userId && p.type === where.type)
      if (where.refId && where.refId.startsWith === 'free:') {
        n = n.filter((p) => String(p.refId).startsWith('free:'))
      }
      return n.length
    },
    create: async ({ data }: any) => {
      state.pointsLogs.push({ ...data })
      return data
    },
  },
  userPoints: {
    upsert: async ({ update }: any) => {
      const cur = state.userPointsRecord ?? { balance: 0, totalEarned: 0 }
      state.userPointsRecord = {
        ...cur,
        balance: cur.balance + (update?.balance?.increment ?? 0),
        totalEarned: cur.totalEarned + (update?.totalEarned?.increment ?? 0),
      }
      return state.userPointsRecord
    },
    findUnique: async () => state.userPointsRecord,
    update: async () => ({}),
  },
  supplyItem: { findMany: async () => [], findFirst: async () => null },
  userCollection: {
    findMany: async () => [],
    create: async () => ({}),
    update: async () => ({}),
    updateMany: async () => ({ count: 0 }),
  },
  shareReward: {
    findUnique: async () => null,
    update: async () => ({}),
    updateMany: async () => ({ count: 1 }),
  },
  $transaction: async (arg: any) => {
    if (typeof arg === 'function') return arg(fakePrisma)
    return Promise.all(arg)
  },
}

mock.module('./db', { namedExports: { prisma: fakePrisma } })

// ---- 测试 ----
test('常量：抽卡成本与免费次数', async () => {
  const { DRAW_COST, FREE_DRAW_PER_DAY, RARITY_WEIGHTS } = await import('./supply')
  assert.equal(DRAW_COST, 3)
  assert.equal(FREE_DRAW_PER_DAY, 1)
  const total = RARITY_WEIGHTS.reduce((s: number, r: any) => s + r.weight, 0)
  assert.equal(total, 100, '稀有度权重总和应为 100')
})

test('earnPoints：正常发放学习点（answer +1）', async () => {
  const { earnPoints } = await import('./supply')
  resetState()
  const r = await earnPoints({ userId: 'u1', type: 'answer', refId: 'q1' })
  assert.equal(r.alreadyEarned, false)
  assert.equal(state.userPointsRecord.balance, 1)
  assert.equal(r.balance, 1)
})

test('earnPoints：同一 refId 幂等，不重复发放', async () => {
  const { earnPoints } = await import('./supply')
  resetState()
  await earnPoints({ userId: 'u1', type: 'answer', refId: 'q1' })
  const r2 = await earnPoints({ userId: 'u1', type: 'answer', refId: 'q1' })
  assert.equal(r2.alreadyEarned, true)
  assert.equal(state.userPointsRecord.balance, 1, '重复调用不应再加分')
})

test('earnPoints：扣分类型（draw）传入抛错', async () => {
  const { earnPoints } = await import('./supply')
  resetState()
  await assert.rejects(() => earnPoints({ userId: 'u1', type: 'draw' }), /不是奖励类型/)
})

test('spendPoints：余额不足抛错', async () => {
  const { spendPoints } = await import('./supply')
  resetState()
  state.userPointsRecord = { balance: 1 }
  await assert.rejects(() => spendPoints('u1', 3, 'draw'), /学习点不足/)
})

test('spendPoints：正常扣减并返回新余额', async () => {
  const { spendPoints } = await import('./supply')
  resetState()
  state.userPointsRecord = { balance: 10 }
  const r = await spendPoints('u1', 3, 'draw')
  assert.equal(r.balance, 7)
})

test('getBalance：无记录时返回 0', async () => {
  const { getBalance } = await import('./supply')
  resetState()
  assert.equal(await getBalance('u1'), 0)
})

test('hasFreeDrawToday：今日已免费抽过返回 true', async () => {
  const { hasFreeDrawToday } = await import('./supply')
  resetState()
  assert.equal(await hasFreeDrawToday('u1'), false, '无记录应为 false')
  state.pointsLogs.push({
    userId: 'u1',
    type: 'draw',
    refId: 'free:1710000000000',
    amount: 0,
    createdAt: new Date(),
  })
  assert.equal(await hasFreeDrawToday('u1'), true, '已有免费抽记录应为 true')
})

test('drawItem：今日免费次数已用完时拒绝（防作弊）', async () => {
  const { drawItem } = await import('./supply')
  resetState()
  state.pointsLogs.push({
    userId: 'u1',
    type: 'draw',
    refId: 'free:1710000000000',
    amount: 0,
    createdAt: new Date(),
  })
  await assert.rejects(() => drawItem('u1', 'free'), /免费抽取次数已用完/)
})
