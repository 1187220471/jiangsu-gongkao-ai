import { beforeEach, mock } from 'node:test'

const { test } = require('node:test')
const assert = require('node:assert')

// ---- mock prisma（./db）----
// 用一个可变状态对象，模拟不同用户场景
let dbState: {
  user: any
  updateCalls: any[]
}

function resetDb() {
  dbState = {
    user: null,
    updateCalls: [],
  }
}
resetDb()

const fakePrisma = {
  user: {
    findUnique: async () => dbState.user,
    update: async (args: any) => {
      dbState.updateCalls.push(args)
      return dbState.user
    },
  },
}

mock.module('./db', { namedExports: { prisma: fakePrisma } })

beforeEach(resetDb)

// ---- 工具：构造用户 ----
function makeUser(overrides: any = {}) {
  return {
    id: 'u1',
    dailyFreeCount: 10, // 5 点（存储倍数 2）
    freeCountResetAt: new Date(), // 默认今天，避免跨天重置
    accessLevel: 'none',
    accessExpire: null,
    ...overrides,
  }
}

// ---- 测试 ----
test('checkQuota：用户不存在 → 拒绝', async () => {
  const { checkQuota } = await import('./quota')
  dbState.user = null
  const r = await checkQuota('nobody', 1)
  assert.equal(r.allowed, false)
  assert.equal(r.message, '用户不存在')
})

test('checkQuota：邀请用户且在有效期内 → 无限使用', async () => {
  const { checkQuota } = await import('./quota')
  dbState.user = makeUser({
    accessLevel: 'invite',
    accessExpire: new Date(Date.now() + 30 * 24 * 3600 * 1000), // 30 天后
  })
  const r = await checkQuota('u1', 1)
  assert.equal(r.allowed, true)
  assert.equal(r.remainingFree, 999)
})

test('checkQuota：跨天 → 自动重置为 5 点', async () => {
  const { checkQuota } = await import('./quota')
  dbState.user = makeUser({
    dailyFreeCount: 0, // 昨天用光了
    freeCountResetAt: new Date(Date.now() - 24 * 3600 * 1000), // 昨天
  })
  const r = await checkQuota('u1', 1)
  assert.equal(r.allowed, true)
  assert.equal(r.remainingFree, 5)
  assert.equal(dbState.updateCalls.length, 1, '应触发一次 update 重置')
  assert.equal(dbState.updateCalls[0].data.dailyFreeCount, 10, '重置为 10 存储单位 = 5 点')
})

test('checkQuota：当天额度足够（5 点剩 3 点，批改扣 1 点）', async () => {
  const { checkQuota } = await import('./quota')
  dbState.user = makeUser({ dailyFreeCount: 6 }) // 3 点
  const r = await checkQuota('u1', 1)
  assert.equal(r.allowed, true)
  assert.equal(r.remainingFree, 3)
})

test('checkQuota：当天额度不足 → 拒绝', async () => {
  const { checkQuota } = await import('./quota')
  dbState.user = makeUser({ dailyFreeCount: 1 }) // 0.5 点，不够批改扣 1 点
  const r = await checkQuota('u1', 1)
  assert.equal(r.allowed, false)
  assert.equal(r.message.includes('额度已用完'), true)
})

test('checkQuota：出题扣 0.5 点时，0.5 点余额仍可出题', async () => {
  const { checkQuota } = await import('./quota')
  dbState.user = makeUser({ dailyFreeCount: 1 }) // 0.5 点
  const r = await checkQuota('u1', 0.5) // 出题
  assert.equal(r.allowed, true)
  assert.equal(r.remainingFree, 0.5)
})

test('deductQuota：邀请用户不扣额度', async () => {
  const { deductQuota } = await import('./quota')
  dbState.user = makeUser({
    accessLevel: 'invite',
    accessExpire: new Date(Date.now() + 30 * 24 * 3600 * 1000),
  })
  await deductQuota('u1', 1)
  assert.equal(dbState.updateCalls.length, 0, '邀请用户不应调用 update')
})

test('deductQuota：普通用户扣减存储单位', async () => {
  const { deductQuota } = await import('./quota')
  dbState.user = makeUser({ dailyFreeCount: 10 })
  await deductQuota('u1', 1)
  assert.equal(dbState.updateCalls.length, 1)
  assert.deepEqual(dbState.updateCalls[0].data.dailyFreeCount, { decrement: 2 }, '扣 1 点 = 2 存储单位')
})

test('getQuotaInfo：邀请用户 remainingFree 为 999', async () => {
  const { getQuotaInfo } = await import('./quota')
  dbState.user = makeUser({
    accessLevel: 'invite',
    accessExpire: new Date(Date.now() + 30 * 24 * 3600 * 1000),
  })
  const info = await getQuotaInfo('u1')
  assert.ok(info, '应返回额度信息')
  assert.equal(info!.hasAccess, true)
  assert.equal(info!.remainingFree, 999)
})

test('checkAccess：非邀请用户返回专享提示', async () => {
  const { checkAccess } = await import('./quota')
  dbState.user = makeUser()
  const r = await checkAccess('u1')
  assert.equal(r.hasAccess, false)
  assert.equal(r.message.includes('专享'), true)
})
