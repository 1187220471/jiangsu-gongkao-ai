'use client'

import { Suspense, useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { equipItem, fetchCollection, shareItem, type CollectionItem } from '@/lib/supplyApi'
import { THEME_META, RARITY_LABELS, getCollectionImageUrl, type SupplyCategory } from '@/lib/theme'

function CollectionDetail() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const id = Number(params.id)
  const category = (searchParams.get('category') as SupplyCategory) || 'pixelPet'

  const [item, setItem] = useState<CollectionItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [equipping, setEquipping] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchDetail()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const fetchDetail = async () => {
    setLoading(true)
    try {
      const data = await fetchCollection(category)
      const found = data.items.find((i) => i.id === id)
      setItem(found || null)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const handleEquip = async () => {
    if (!item || equipping) return
    setEquipping(true)
    try {
      await equipItem(item.isEquipped ? null : item.id)
      setMessage(item.isEquipped ? '已取消展示' : '已设为首页展示')
      setItem({ ...item, isEquipped: !item.isEquipped })
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '操作失败')
    } finally {
      setEquipping(false)
    }
  }

  const handleShare = async () => {
    if (!item || sharing) return
    setSharing(true)
    try {
      const result = await shareItem(item.id)
      const shareUrl = `${window.location.origin}/supply?shareToken=${result.token}&category=${category}`
      await navigator.clipboard.writeText(shareUrl)
      setMessage(
        `分享链接已复制！好友打开链接可获独立免费抽，今日还可分享 ${result.remainingShares} 次`
      )
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '分享失败')
    } finally {
      setSharing(false)
    }
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

  if (!item) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        物品不存在
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
            <span className="text-sm font-medium">返回图鉴</span>
          </button>
          <h1 className="text-base font-bold text-slate-800">物品详情</h1>
          <span className="w-16" />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 pt-6">
        {/* 详情卡片 */}
        <div className="card-pixel p-8 text-center">
          <div
            className="w-36 h-36 mx-auto flex items-center justify-center rounded-[18px]"
            style={{
              background:
                item.rarity === 'rare'
                  ? 'radial-gradient(circle at 30% 30%, rgba(59,130,246,0.15), transparent 60%)'
                  : '#f9fafb',
            }}
          >
            <img
              className="w-28 h-28 object-contain"
              src={getCollectionImageUrl(item.imageUrl)}
              alt={item.name}
            />
          </div>
          <div className="text-xl font-bold text-slate-800 mt-4">{item.name}</div>
          <span
            className="inline-block text-xs font-semibold text-white px-3 py-1 rounded-full mt-2"
            style={{ background: item.rarity === 'rare' ? rareColor : commonColor }}
          >
            {RARITY_LABELS[item.rarity]}
          </span>
          <p className="text-sm text-slate-500 mt-4 leading-relaxed">
            {item.description || `${item.name}是收集系统中的一个物品。`}
          </p>
          {item.collected && item.obtainedAt && (
            <p className="text-xs text-slate-400 mt-3">
              获得时间：{new Date(item.obtainedAt).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* 操作区 */}
        {item.collected ? (
          <div className="space-y-3 mt-5">
            <button
              onClick={handleEquip}
              disabled={equipping}
              className={`btn-3d w-full py-3 rounded-[14px] text-sm font-bold transition-all disabled:opacity-50 active:translate-y-1 ${
                item.isEquipped
                  ? 'bg-slate-200 text-slate-600 active:shadow-[0_1px_0_#9ca3af]'
                  : 'bg-primary-500 text-white active:shadow-[0_1px_0_#2563eb]'
              }`}
            >
              {item.isEquipped ? '取消首页展示' : theme.equipLabel}
            </button>
            <button
              onClick={handleShare}
              disabled={sharing}
              className="btn-3d w-full bg-green-600 text-white py-3 rounded-[14px] text-sm font-bold transition-all disabled:opacity-50 active:translate-y-1 active:shadow-[0_1px_0_#166534]"
            >
              {sharing ? '生成链接中...' : '分享给好友，送好友免费抽'}
            </button>
            <p className="text-xs text-slate-400 text-center">
              好友通过链接完成抽奖，你可得 +1 学习点（每日最多 10 次分享）
            </p>
          </div>
        ) : (
          <div className="mt-5 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[14px] py-5 text-center text-sm text-slate-400">
            还未收集，去补给站抽取吧
          </div>
        )}

        {message && (
          <div className="mt-4 text-center text-sm text-slate-600 bg-white border-2 border-slate-200 rounded-[12px] py-2.5">
            {message}
          </div>
        )}
      </div>
    </div>
  )
}

export default function CollectionDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-400">加载中...</div>}>
      <CollectionDetail />
    </Suspense>
  )
}
