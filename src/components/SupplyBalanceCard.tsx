'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { fetchSupplyBalance } from '@/lib/supplyApi'

interface BalanceData {
  balance: number
  freeDrawUsedToday?: boolean
  equippedItem: {
    id: number
    name: string
    imageUrl: string
    rarity: string
    category?: string
  } | null
}

export default function SupplyBalanceCard() {
  const [data, setData] = useState<BalanceData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchSupplyBalance()
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch(() => {
        if (!cancelled) setError('加载失败')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="card-pixel p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-slate-800">学习点</h3>
        <Link
          href="/supply"
          className="btn-3d bg-slate-800 text-white px-4 py-1.5 rounded-[12px] text-xs font-semibold transition-all active:translate-y-1 active:shadow-[0_1px_0_#374151]"
        >
          前往补给站 →
        </Link>
      </div>

      {error ? (
        <p className="text-sm text-slate-400">{error}</p>
      ) : !data ? (
        <div className="text-sm text-slate-400">加载中...</div>
      ) : (
        <div className="space-y-4">
          {/* 余额 */}
          <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="text-4xl font-bold text-primary-600 leading-none">
                {data.balance}
              </div>
              <div className="text-sm text-slate-500 mt-1.5">可用学习点</div>
            </div>
            <div className="text-right space-y-1">
              <span
                className={`inline-block px-2.5 py-1 rounded-lg text-xxs font-semibold ${
                  data.freeDrawUsedToday
                    ? 'bg-slate-200 text-slate-500'
                    : 'bg-green-100 text-green-700'
                }`}
              >
                {data.freeDrawUsedToday ? '今日免费抽已用' : '今日免费抽可用'}
              </span>
              <p className="text-xs text-slate-400">
                完成练习、专注、每日任务可获取
              </p>
            </div>
          </div>

          {/* 已装备 */}
          {data.equippedItem && (
            <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-3">
              <img
                src={data.equippedItem.imageUrl}
                alt={data.equippedItem.name}
                className="w-12 h-12 object-contain"
              />
              <div className="flex-1">
                <div className="text-sm font-bold text-slate-700">
                  {data.equippedItem.name}
                </div>
                <div className="text-xs text-slate-400">已装备 · 图鉴展示中</div>
              </div>
              <span className="tag-pixel">
                {data.equippedItem.rarity === 'rare' ? '稀有' : '普通'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
