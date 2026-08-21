import {
  DEFAULT_EXAMS,
  formatExamDate,
  getBeijingDateString,
  getDaysRemaining,
  getExamCountdown,
  isValidDateString,
} from './examCountdown'

const { test } = require('node:test')
const assert = require('node:assert')

test('isValidDateString：合法/非法日期判断', () => {
  assert.equal(isValidDateString('2026-11-28'), true)
  assert.equal(isValidDateString('2026-02-30'), false, '2月30日不存在')
  assert.equal(isValidDateString('2026/11/28'), false, '分隔符必须为横线')
  assert.equal(isValidDateString('abc'), false)
  assert.equal(isValidDateString(null), false)
  assert.equal(isValidDateString(20261128), false)
})

test('getBeijingDateString：UTC 16:00 之后应算北京时间次日', () => {
  // 北京 = UTC + 8，UTC 16:00 即北京次日 00:00
  assert.equal(getBeijingDateString(new Date('2026-11-27T16:00:00Z')), '2026-11-28')
  assert.equal(getBeijingDateString(new Date('2026-11-27T15:59:59Z')), '2026-11-27')
})

test('getDaysRemaining：无效日期返回 null', () => {
  assert.equal(getDaysRemaining('2026-13-99'), null)
  assert.equal(getDaysRemaining(''), null)
})

test('getExamCountdown：四种状态与边界', () => {
  const exam = { id: 'x', name: 'x', date: '2026-11-28' }
  // 北京 11-27 23:59（UTC 15:59）→ 还差 1 天
  const upcoming = getExamCountdown(exam, new Date('2026-11-27T15:59:00Z'))
  assert.equal(upcoming.status, 'upcoming')
  assert.equal(upcoming.daysRemaining, 1)
  // 北京 11-28 00:00（UTC 11-27 16:00）→ 今天考试
  assert.equal(getExamCountdown(exam, new Date('2026-11-27T16:00:00Z')).status, 'today')
  // 考试过后 → 已过期
  assert.equal(getExamCountdown(exam, new Date('2026-11-28T16:00:00Z')).status, 'expired')
  // 无效日期 → invalid
  assert.equal(getExamCountdown({ id: 'y', name: 'y', date: 'bad' }, new Date()).status, 'invalid')
})

test('getExamCountdown：跨年场景（2025-12-31 → 2026-01-01）', () => {
  const exam = { id: 'x', name: 'x', date: '2026-01-01' }
  const r = getExamCountdown(exam, new Date('2025-12-31T16:00:00Z')) // 北京 2026-01-01
  assert.equal(r.status, 'today')
  assert.equal(r.daysRemaining, 0)
})

test('formatExamDate：格式化日期', () => {
  assert.equal(formatExamDate('2026-11-28'), '2026年11月28日')
  assert.equal(formatExamDate('bad'), '请选择日期')
})

test('DEFAULT_EXAMS：默认国考与江苏省考日期', () => {
  const dates = DEFAULT_EXAMS.map((e) => e.date)
  assert.ok(dates.includes('2026-11-28'), '应包含国考日期')
  assert.ok(dates.includes('2026-12-05'), '应包含江苏省考日期')
  for (const e of DEFAULT_EXAMS) {
    assert.equal(isValidDateString(e.date), true, `${e.name} 日期合法`)
  }
})
