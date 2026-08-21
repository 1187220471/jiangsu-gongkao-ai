export type FocusDuration = 30 | 60

export interface StartFocusResponse {
  sessionId: number
  startedAt: string
  duration: FocusDuration
}

export interface EndFocusResponse {
  status: 'completed' | 'abandoned' | 'cheated'
  pointsAwarded: number
  balance: number
}

export interface TodayFocusResponse {
  totalMinutes: number
  completedMinutes: number
  sessions: Array<{
    id: number
    duration: number
    status: string
    pointsAwarded: number
    startedAt: string
    endedAt: string | null
  }>
}

export interface ActiveFocusInfo {
  sessionId: number
  duration: number
  startedAt: string
  elapsedSeconds: number
}

async function authFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  const res = await fetch(url, { ...options, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || '请求失败')
  }
  return data as T
}

export function startFocus(duration: FocusDuration) {
  return authFetch<StartFocusResponse>('/api/focus/start', {
    method: 'POST',
    body: JSON.stringify({ duration }),
  })
}

export function endFocus(
  sessionId: number,
  action: 'complete' | 'abandon' = 'complete',
  clientNow?: number
) {
  return authFetch<EndFocusResponse>('/api/focus/end', {
    method: 'POST',
    body: JSON.stringify({ sessionId, action, clientNow }),
  })
}

export function fetchTodayFocus() {
  return authFetch<TodayFocusResponse>('/api/focus/today')
}

export function fetchActiveFocus() {
  return authFetch<{ active: ActiveFocusInfo | null }>('/api/focus/active')
}