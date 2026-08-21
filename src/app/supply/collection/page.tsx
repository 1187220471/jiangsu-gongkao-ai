'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { fetchCollection } from '@/lib/supplyApi'
import { THEME_META, RARITY_LABELS, getCollectionImageUrl, type SupplyCategory } from '@/lib/theme'

interface CollectionItem {
  id: number
  name: string
  rarity: string
  imageUrl: string
  category: string
  collected: boolean
  isEquipped: boolean
  obtainedAt: string | null
}

function CollectionList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialCategory = (searchParams.get('category') as SupplyCategory) || 'pixelPet'
  const [category, setCategory] = useState<SupplyCategory>(initialCategory)
  const [items, setItems] = useState<CollectionItem[]>([])
  const [stats, setStats] = useState({ total: 0, collected: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchCollectionData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category])

  const fetchCollectionData = async () => {
    setLoading(true)
    try {
      const data = await fetchCollection(category)
      const filtered = data.items.filter((item) => {
        if (!item.category) return category === 'pixelPet'
        return item.category === category
      })
      setItems(filtered)
      setStats({
        total: filtered.length,
        collected: filtered.filter((i) => i.collected).length,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const switchTheme = (c: SupplyCategory) => {
    if (c === category) return
    setCategory(c)
  }

  const theme = THEME_META[category]
  const rareColor = theme.rareColor
  const commonColor = '#6b7280'

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        加载中...
      </div>
    )
  }

  return (
    <div className="pb-14">
      {/* Header */}
      <header className="bg-white border-b-2 border-slate-100">
        <div className="max-w-3xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-800"
          >
            <span className="text-base">←</span>
            <span className="text-sm font-medium">返回</span>
          </button>
          <h1 className="text-base font-bold text-slate-800">我的图鉴</h1>
          <button
            onClick={() => router.push('/supply')}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            去抽卡
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 pt-5">
        {/* 主题切换 Tab */}
        <div className="flex gap-2 mb-5">
          {(['pixelPet', 'nbaStar'] as SupplyCategory[]).map((c) => (
            <button
              key={c}
              onClick={() => switchTheme(c)}
              className={`px-4 py-2 rounded-[12px] text-sm font-semibold border-2 transition-all ${
                category === c
                  ? 'bg-slate-800 text-white border-slate-800 shadow-[0_3px_0_#111827]'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              }`}
            >
              {THEME_META[c].icon} {THEME_META[c].label}
            </button>
          ))}
        </div>

        {error ? (
          <div className="text-sm text-slate-400 text-center py-10">{error}</div>
        ) : (
          <>
            {/* 标题 + 进度 */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-slate-800">{theme.collectionTitle}</h2>
              <span className="text-sm font-bold text-primary-600">
                {stats.collected}/{stats.total}
              </span>
            </div>

            <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden mb-6">
              <div
                className="h-full bg-primary-500 rounded-full transition-all duration-500"
                style={{
                  width: `${stats.total > 0 ? (stats.collected / stats.total) * 100 : 0}%`,
                }}
              />
            </div>

            {/* 网格 */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {items.map((item) => (
                <button
                  key={item.id}
                  disabled={!item.collected}
                  onClick={() =>
                    router.push(
                      `/supply/collection/${item.id}?category=${category}`
                    )
                  }
                  className={`relative bg-white border-2 rounded-[14px] p-3 text-center transition-all ${
                    item.collected
                      ? 'border-slate-200 hover:border-slate-400 hover:-translate-y-0.5'
                      : 'border-dashed border-slate-200 bg-slate-50'
                  } ${item.isEquipped ? 'border-primary-400' : ''}`}
                >
                  {item.isEquipped && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary-500 text-white text-xxs px-2 py-0.5 rounded-full whitespace-nowrap">
                      展示中
                    </span>
                  )}
                  {item.collected ? (
                    <img
                      className="w-16 h-16 object-contain mx-auto"
                      src={getCollectionImageUrl(item.imageUrl)}
                      alt={item.name}
                    />
                  ) : (
                    <div className="w-16 h-16 mx-auto flex items-center justify-center text-2xl text-slate-300">
                      ?
                    </div>
                  )}
                  <div className="text-xs font-medium text-slate-600 mt-1.5 truncate">
                    {item.collected ? item.name : '???'}
                  </div>
                  <div
                    className="text-xxs mt-0.5"
                    style={{
                      color: item.collected
                        ? item.rarity === 'rare'
                          ? rareColor
                          : commonColor
                        : '#d1d5db',
                    }}
                  >
                    {item.collected ? RARITY_LABELS[item.rarity] : '???'}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function CollectionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-400">加载中...</div>}>
      <CollectionList />
    </Suspense>
  )
}
