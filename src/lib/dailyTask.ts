const DAILY_TASK_DATE_KEY = 'daily_task_date'
const DAILY_TASK_COUNT_KEY = 'daily_task_count'
const DAILY_TASK_TARGET_KEY = 'daily_task_target'
const DEFAULT_TARGET = 3
const MAX_TARGET = 20

export interface DailyTaskState {
  count: number
  target: number
  completed: boolean
  date: string
  progress: number
}

/** 0=reading, 1=writing, 2=thumbsup */
export type MascotStage = 0 | 1 | 2

function getToday(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getTarget(): number {
  if (typeof window === 'undefined') return DEFAULT_TARGET
  const stored = window.localStorage.getItem(DAILY_TASK_TARGET_KEY)
  const n = stored ? Number(stored) : NaN
  if (typeof n === 'number' && n >= 1 && n <= MAX_TARGET) {
    return n
  }
  return DEFAULT_TARGET
}

function getCount(): number {
  if (typeof window === 'undefined') return 0
  const stored = window.localStorage.getItem(DAILY_TASK_COUNT_KEY)
  const n = stored ? Number(stored) : NaN
  if (typeof n === 'number' && n >= 0) return n
  return 0
}

function computeProgress(count: number, target: number): number {
  if (target <= 0) return 0
  return Math.round((count / target) * 100)
}

export function getMascotStage(progress: number): MascotStage {
  if (progress >= 66) return 2
  if (progress >= 33) return 1
  return 0
}

export function getDailyTask(): DailyTaskState {
  const today = getToday()
  const storedDate =
    typeof window === 'undefined' ? '' : (window.localStorage.getItem(DAILY_TASK_DATE_KEY) || '')
  const target = getTarget()
  let count = 0

  if (storedDate === today) {
    count = getCount()
  }

  count = Math.min(count, target)

  return {
    count,
    target,
    completed: count >= target,
    date: today,
    progress: computeProgress(count, target),
  }
}

export function completeDailyTask(): DailyTaskState {
  const today = getToday()
  const target = getTarget()
  let count = 0

  const storedDate =
    typeof window === 'undefined' ? '' : (window.localStorage.getItem(DAILY_TASK_DATE_KEY) || '')
  if (storedDate === today) {
    count = getCount()
  }

  if (count < target) {
    count += 1
  }

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(DAILY_TASK_DATE_KEY, today)
    window.localStorage.setItem(DAILY_TASK_COUNT_KEY, String(count))
  }

  return {
    count,
    target,
    completed: count >= target,
    date: today,
    progress: computeProgress(count, target),
  }
}

export function setDailyTaskTarget(n: number): DailyTaskState {
  const today = getToday()
  const target = Math.max(1, Math.min(MAX_TARGET, Math.round(n)))
  let count = 0

  const storedDate =
    typeof window === 'undefined' ? '' : (window.localStorage.getItem(DAILY_TASK_DATE_KEY) || '')
  if (storedDate === today) {
    count = getCount()
  }

  count = Math.min(count, target)

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(DAILY_TASK_TARGET_KEY, String(target))
    window.localStorage.setItem(DAILY_TASK_DATE_KEY, today)
    window.localStorage.setItem(DAILY_TASK_COUNT_KEY, String(count))
  }

  return {
    count,
    target,
    completed: count >= target,
    date: today,
    progress: computeProgress(count, target),
  }
}

export function getTaskHint(count: number, target: number): string {
  if (count >= target) {
    return '今日目标已完成！'
  }
  const remaining = target - count
  if (remaining === 1) {
    return '还差 1 次完成今日目标'
  }
  return `还差 ${remaining} 次完成今日目标`
}

export const PANDA_STAGE_IMAGES = {
  0: '/collection/panda-reading-120.png',
  1: '/collection/panda-writing-120.png',
  2: '/collection/panda-thumbsup-120.png',
} as const

/** 获取当日熊猫形象（读取场景） */
export function getPandaImage(progress: number): string {
  return PANDA_STAGE_IMAGES[getMascotStage(progress)]
}