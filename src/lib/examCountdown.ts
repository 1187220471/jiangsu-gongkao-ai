const CUSTOM_EXAM_STORAGE_KEY = 'exam_countdown_custom'
const STORAGE_VERSION = 1
const DAY_MS = 24 * 60 * 60 * 1000
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000

export interface ExamItem {
  id: string
  name: string
  date: string
}

export type ExamCountdownStatus = 'upcoming' | 'today' | 'expired' | 'invalid'

export interface ExamCountdownResult {
  exam: ExamItem
  status: ExamCountdownStatus
  daysRemaining: number | null
  displayText: string
}

interface CustomExamStorage {
  version: number
  exam: ExamItem
}

export const DEFAULT_EXAMS: ExamItem[] = [
  { id: 'national-exam', name: '国考', date: '2026-11-28' },
  { id: 'jiangsu-exam', name: '江苏省考', date: '2026-12-05' },
]

export function isValidDateString(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const [year, month, day] = value.split('-').map(Number)
  const timestamp = Date.UTC(year, month - 1, day)
  const date = new Date(timestamp)

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

export function getBeijingDateString(now = new Date()): string {
  return new Date(now.getTime() + BEIJING_OFFSET_MS).toISOString().slice(0, 10)
}

function toDayNumber(dateString: string): number {
  const [year, month, day] = dateString.split('-').map(Number)
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS)
}

export function getDaysRemaining(examDate: string, now = new Date()): number | null {
  if (!isValidDateString(examDate)) return null
  return toDayNumber(examDate) - toDayNumber(getBeijingDateString(now))
}

export function getExamCountdown(exam: ExamItem, now = new Date()): ExamCountdownResult {
  const daysRemaining = getDaysRemaining(exam.date, now)

  if (daysRemaining === null) {
    return { exam, status: 'invalid', daysRemaining: null, displayText: '日期无效' }
  }
  if (daysRemaining === 0) {
    return { exam, status: 'today', daysRemaining, displayText: '今天考试' }
  }
  if (daysRemaining < 0) {
    return { exam, status: 'expired', daysRemaining, displayText: '已过期' }
  }
  return { exam, status: 'upcoming', daysRemaining, displayText: `还差 ${daysRemaining} 天` }
}

export function formatExamDate(dateString: string): string {
  if (!isValidDateString(dateString)) return '请选择日期'
  const [year, month, day] = dateString.split('-')
  return `${year}年${Number(month)}月${Number(day)}日`
}

export function getCustomExam(): ExamItem | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(CUSTOM_EXAM_STORAGE_KEY)
    if (!raw) return null
    const stored = JSON.parse(raw) as CustomExamStorage
    if (
      !stored ||
      stored.version !== STORAGE_VERSION ||
      !stored.exam ||
      stored.exam.id !== 'custom-exam' ||
      stored.exam.name !== '我的考试' ||
      !isValidDateString(stored.exam.date)
    ) {
      return null
    }
    return stored.exam
  } catch {
    return null
  }
}

export function saveCustomExam(date: string): ExamItem | null {
  if (!isValidDateString(date) || typeof window === 'undefined') return null

  const exam: ExamItem = { id: 'custom-exam', name: '我的考试', date }
  window.localStorage.setItem(
    CUSTOM_EXAM_STORAGE_KEY,
    JSON.stringify({ version: STORAGE_VERSION, exam } satisfies CustomExamStorage)
  )
  return exam
}

export function clearCustomExam(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(CUSTOM_EXAM_STORAGE_KEY)
}