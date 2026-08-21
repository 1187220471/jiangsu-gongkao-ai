import type { SupplyCategory } from '@/lib/theme'

export type EarnType = 'answer' | 'set' | 'zhenti' | 'shenlun' | 'focus30' | 'focus60' | 'dailySign' | 'share'

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

export async function earnPoints(type: EarnType, refId?: string) {
  return authFetch<{ balance: number; earned: number; alreadyEarned: boolean }>('/api/supply/earn', {
    method: 'POST',
    body: JSON.stringify({ type, refId }),
  })
}

export async function fetchSupplyBalance(category?: SupplyCategory) {
  const query = category ? `?category=${category}` : ''
  return authFetch<{
    balance: number
    freeDrawUsedToday?: boolean
    category?: string
    equippedItem: { id: number; name: string; imageUrl: string; rarity: string; category?: string } | null
  }>(`/api/supply/balance${query}`)
}

export interface CollectionItem {
  id: number
  name: string
  rarity: string
  imageUrl: string
  category: string
  description?: string | null
  collected: boolean
  isEquipped: boolean
  obtainedAt: string | null
}

export interface CollectionResponse {
  items: CollectionItem[]
  total: number
  collected: number
}

export async function fetchCollection(category: SupplyCategory = 'pixelPet'): Promise<CollectionResponse> {
  return authFetch<CollectionResponse>(`/api/supply/collection?category=${category}`)
}

export async function equipItem(itemId: number | null): Promise<{ success: boolean }> {
  return authFetch<{ success: boolean }>('/api/supply/collection/equip', {
    method: 'POST',
    body: JSON.stringify({ itemId }),
  })
}

export type DrawSource = 'free' | 'paid' | 'share'

export interface DrawResponse {
  item: {
    id: number
    name: string
    rarity: string
    imageUrl: string
    description: string | null
  }
  isRepeat: boolean
  repeatPoints: number
  balance: number
  source: DrawSource
}

export async function drawItem(
  source: DrawSource,
  category: SupplyCategory = 'pixelPet',
  shareToken?: string
): Promise<DrawResponse> {
  return authFetch<DrawResponse>('/api/supply/draw', {
    method: 'POST',
    body: JSON.stringify({ source, category, shareToken }),
  })
}

export interface ShareResponse {
  success: boolean
  token: string
  item: { id: number; name: string; category: string }
  shareCountToday: number
  remainingShares: number
}

export async function shareItem(itemId: number): Promise<ShareResponse> {
  return authFetch<ShareResponse>('/api/supply/share', {
    method: 'POST',
    body: JSON.stringify({ itemId }),
  })
}

export async function claimShareReward(token: string) {
  return authFetch<{
    success: boolean
    reward: { type: 'freeDraw'; description: string }
    sharerId: string
  }>('/api/supply/share/claim', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
}