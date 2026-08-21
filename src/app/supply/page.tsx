'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { drawItem, fetchCollection, fetchSupplyBalance } from '@/lib/supplyApi'
import { THEME_META, RARITY_LABELS, getCollectionImageUrl, type SupplyCategory } from '@/lib/theme'

interface DrawResult {
  id: number
  name: string
  rarity: string
  imageUrl: string
  description: string | null
}

interface DrawResponse {
  item: DrawResult
  isRepeat: boolean
  repeatPoints: number
  balance: number
  source: 'free' | 'paid' | 'share'
}

interface PoolItem {
  id: number
  name: string
  rarity: string
  imageUrl: string
  collected: boolean
  category?: string
}

const LIGHT_COUNT = 7

function SupplyDraw() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const shareTokenFromUrl = searchParams.get('shareToken') || undefined
  const categoryFromUrl = (searchParams.get('category') as SupplyCategory) || undefined

  const [category, setCategory] = useState<SupplyCategory>(categoryFromUrl || 'pixelPet')
  const [shareToken, setShareToken] = useState<string | undefined>(shareTokenFromUrl)
  const [balance, setBalance] = useState(0)
  const [pool, setPool] = useState<PoolItem[]>([])
  const [stats, setStats] = useState({ total: 0, collected: 0 })
  const [loading, setLoading] = useState(false)
  const [animating, setAnimating] = useState(false)
  const [outcome, setOutcome] = useState<DrawResponse | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [freeUsed, setFreeUsed] = useState(false)
  const [reelIndex, setReelIndex] = useState(0)
  const [stoppedCount, setStoppedCount] = useState(0)
  const [message, setMessage] = useState('')
  const reelTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    fetchData()
    return () => {
      stopReel()
      timeouts.current.forEach(clearTimeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category])

  const stopReel = () => {
    if (reelTimer.current) {
      clearInterval(reelTimer.current)
      reelTimer.current = null
    }
  }

  const startReel = () => {
    stopReel()
    let i = 0
    reelTimer.current = setInterval(() => {
      i += 1
      setReelIndex(i)
    }, 100)
  }

  const fetchData = async () => {
    try {
      const [balanceData, collectionData] = await Promise.all([
        fetchSupplyBalance(),
        fetchCollection(category),
      ])
      setBalance(balanceData.balance)
      setFreeUsed(!!balanceData.freeDrawUsedToday)
      const filtered = collectionData.items.filter((item) => {
        if (!item.category) return category === 'pixelPet'
        return item.category === category
      })
      setPool(filtered)
      setStats({
        total: filtered.length,
        collected: filtered.filter((i) => i.collected).length,
      })
    } catch (err) {
      console.error('加载补给站失败:', err)
    }
  }

  const showMessage = (text: string) => {
    setMessage(text)
    const t = setTimeout(() => setMessage(''), 2600)
    timeouts.current.push(t)
  }

  const handleDraw = async () => {
    if (loading || animating) return

    const source: 'free' | 'paid' | 'share' = shareToken
      ? 'share'
      : freeUsed
        ? 'paid'
        : 'free'

    if (source === 'paid' && balance < 3) {
      showMessage('学习点不足，去答题赚学习点吧')
      return
    }

    setLoading(true)
    setAnimating(true)
    setOutcome(null)
    setStoppedCount(0)
    startReel()

    try {
      const data = await drawItem(source, category, shareToken)

      setOutcome(data)
      timeouts.current.push(setTimeout(() => setStoppedCount(1), 1000))
      timeouts.current.push(setTimeout(() => setStoppedCount(2), 1300))
      timeouts.current.push(
        setTimeout(() => {
          setStoppedCount(3)
          stopReel()
          setAnimating(false)
          setBalance(data.balance)
          if (source === 'free') setFreeUsed(true)
          if (source === 'share') setShareToken(undefined)
          setShowModal(true)
          fetchData()
        }, 1600)
      )
    } catch (err) {
      stopReel()
      setAnimating(false)
      setStoppedCount(0)
      const messageText = err instanceof Error ? err.message : '抽奖失败'

      if (source === 'free' && messageText.includes('免费')) {
        setFreeUsed(true)
        fetchData()
        showMessage('今日免费已用完，可消耗 3 学习点再抽')
      } else {
        showMessage(messageText)
      }
    } finally {
      setLoading(false)
    }
  }

  const closeResult = () => {
    setShowModal(false)
    if (outcome?.isRepeat) {
      showMessage(`已拥有，自动兑换 ${outcome.repeatPoints} 学习点`)
    }
  }

  const switchTheme = (c: SupplyCategory) => {
    if (c === category) return
    setCategory(c)
    // 清理分享态与结果，避免跨主题残留
    setOutcome(null)
    setShowModal(false)
    setShareToken(undefined)
    setStoppedCount(0)
  }

  const ctaText = shareToken ? '好友赠送免费抽' : freeUsed ? '3 学习点抽一次' : '免费抽一次'
  const ctaDisabled = loading || animating || (!shareToken && freeUsed && balance < 3)

  const theme = THEME_META[category]
  const rareColor = theme.rareColor
  const commonColor = '#6b7280'

  const commonItems = pool.filter((i) => i.rarity === 'common')
  const rareItems = pool.filter((i) => i.rarity === 'rare')

  const renderReel = (i: number) => {
    if (animating && i >= stoppedCount && pool.length > 0) {
      const item = pool[(reelIndex + i * 5) % pool.length]
      return (
        <img
          className="supply-reel-img spinning"
          src={getCollectionImageUrl(item.imageUrl)}
          alt=""
        />
      )
    }
    if (outcome) {
      return (
        <img
          className="supply-reel-img"
          src={getCollectionImageUrl(outcome.item.imageUrl)}
          alt={outcome.item.name}
        />
      )
    }
    return (
      <img className="supply-reel-img capsule" src="/collection/capsule-160.png" alt="补给胶囊" />
    )
  }

  const renderPoolRow = (items: PoolItem[], groupName: string) => (
    <div className="mb-5" key={groupName}>
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-sm font-bold text-slate-700">{groupName}</span>
        <span className="text-xs text-slate-400">
          {items.length} {theme.unitLabel}
        </span>
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-1">
        {items.map((item) => (
          <div
            key={item.id}
            className={`supply-pool-card ${item.collected ? '' : 'locked'}`}
          >
            {item.collected ? (
              <img
                className="w-14 h-14 object-contain mx-auto"
                src={getCollectionImageUrl(item.imageUrl)}
                alt={item.name}
              />
            ) : (
              <div className="w-14 h-14 mx-auto flex items-center justify-center text-2xl text-slate-300">
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
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="pb-14">
      {/* Header */}
      <header className="bg-white border-b-2 border-slate-100">
        <div className="max-w-3xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-800"
          >
            <span className="text-base">←</span>
            <span className="text-sm font-medium">返回首页</span>
          </button>
          <h1 className="text-base font-bold text-slate-800">补给站</h1>
          <button
            onClick={() => router.push('/supply/collection')}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            我的图鉴
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 pt-5 space-y-5">
        {/* 主题切换 Tab */}
        <div className="flex gap-2">
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

        {/* 状态栏 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="card-pixel p-3.5">
            <div className="text-xs text-slate-400">学习点</div>
            <div className="text-xl font-bold text-slate-800 mt-1">💎 {balance}</div>
          </div>
          <div className="card-pixel p-3.5">
            <div className="text-xs text-slate-400">{shareToken ? '好友赠送' : '今日免费'}</div>
            <div
              className={`text-xl font-bold mt-1 ${
                freeUsed && !shareToken ? 'text-slate-400' : 'text-green-600'
              }`}
            >
              {shareToken ? '独立 1 次' : freeUsed ? '已用完' : '剩余 1 次'}
            </div>
          </div>
        </div>

        {/* 抽卡机 */}
        <div className="supply-machine">
          <div className="supply-machine-lights">
            {Array.from({ length: LIGHT_COUNT }).map((_, i) => (
              <span
                key={i}
                className="supply-machine-light"
                style={{ animationDelay: `${i * 0.18}s` }}
              />
            ))}
          </div>

          <div className="text-center font-bold text-slate-800 mt-3 tracking-wide">
            {theme.drawTitle}
          </div>

          <div className="supply-reel-row">
            {[0, 1, 2].map((i) => (
              <div className="supply-reel-window" key={i}>
                {renderReel(i)}
              </div>
            ))}
          </div>

          <div
            className={`supply-lever ${animating ? 'pulled' : ''}`}
            onClick={handleDraw}
            role="button"
            aria-label="拉动拉杆抽卡"
          >
            <span className="supply-lever-ball" />
            <span className="supply-lever-stick" />
          </div>

          <div className="supply-sticker">
            <span className="supply-sticker-dot" style={{ backgroundColor: commonColor }} />
            <span>普通 80%</span>
            <span className="text-slate-300">·</span>
            <span className="supply-sticker-dot" style={{ backgroundColor: rareColor }} />
            <span>稀有 20%</span>
          </div>

          <div className="supply-slot" />
        </div>

        {/* 抽卡按钮 */}
        <button
          onClick={handleDraw}
          disabled={ctaDisabled}
          className={`btn-3d w-full text-white text-base font-bold py-3 rounded-[14px] transition-all disabled:opacity-50 active:translate-y-1 ${
            shareToken
              ? 'bg-green-600 active:shadow-[0_1px_0_#166534]'
              : 'bg-slate-800 active:shadow-[0_1px_0_#111827]'
          }`}
        >
          {ctaText}
        </button>

        {/* 提示 */}
        {message && (
          <div className="text-center text-sm text-slate-600 bg-white border-2 border-slate-200 rounded-[12px] py-2.5">
            {message}
          </div>
        )}

        {/* 图鉴入口 */}
        <button
          onClick={() => router.push(`/supply/collection?category=${category}`)}
          className="card-pixel card-active w-full p-4 flex items-center justify-between text-left"
        >
          <div>
            <div className="text-sm font-bold text-slate-800">我的图鉴</div>
            <div className="text-xs text-slate-400 mt-0.5">{theme.collectionDesc}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-primary-600">
              已收集 {stats.collected}/{stats.total}
            </span>
            <span className="text-slate-400">→</span>
          </div>
        </button>

        {/* 奖池分组 */}
        <div>
          {renderPoolRow(commonItems, theme.poolCommonLabel)}
          {renderPoolRow(rareItems, theme.poolRareLabel)}
        </div>
      </div>

      {/* 结果弹窗 */}
      {showModal && outcome && (
        <div className="supply-result-mask" onClick={closeResult}>
          <div className="supply-result-card" onClick={(e) => e.stopPropagation()}>
            <div className="text-lg font-bold text-slate-800">
              {outcome.isRepeat ? '重复获得' : '恭喜获得'}
            </div>
            <img
              className="w-32 h-32 object-contain mx-auto my-4"
              src={getCollectionImageUrl(outcome.item.imageUrl)}
              alt={outcome.item.name}
            />
            <div className="text-base font-bold text-slate-800">{outcome.item.name}</div>
            <div
              className="text-sm font-semibold mt-1"
              style={{ color: outcome.item.rarity === 'rare' ? rareColor : commonColor }}
            >
              {RARITY_LABELS[outcome.item.rarity]}
            </div>
            {outcome.isRepeat && (
              <div className="text-xs text-slate-500 mt-2">
                已拥有，自动兑换 {outcome.repeatPoints} 学习点
              </div>
            )}
            <button
              onClick={closeResult}
              className="btn-3d w-full bg-slate-800 text-white mt-5 py-2.5 rounded-[12px] text-sm font-semibold transition-all active:translate-y-1 active:shadow-[0_1px_0_#111827]"
            >
              收下
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SupplyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-400">加载中...</div>}>
      <SupplyDraw />
    </Suspense>
  )
}
