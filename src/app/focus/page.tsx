'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  startFocus,
  endFocus,
  fetchTodayFocus,
  fetchActiveFocus,
  type FocusDuration,
} from '@/lib/focusApi'
import { fetchSupplyBalance } from '@/lib/supplyApi'
import { getCollectionImageUrl } from '@/lib/theme'

type Phase = 'select' | 'focusing' | 'completed'
const BG_TOLERANCE_MS = 5 * 60 * 1000

interface EquippedItem {
  id: number
  name: string
  imageUrl: string
  rarity: string
}

export default function FocusTimer() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('select')
  const [duration, setDuration] = useState<FocusDuration | null>(null)
  const [remaining, setRemaining] = useState(0)
  const [equipped, setEquipped] = useState<EquippedItem | null>(null)
  const [todayMinutes, setTodayMinutes] = useState(0)
  const [result, setResult] = useState<{ pointsAwarded: number; status: string } | null>(null)
  const [showLeavePrompt, setShowLeavePrompt] = useState(false)
  const [staleActive, setStaleActive] = useState<{ sessionId: number; duration: number; elapsedSeconds: number } | null>(null)
  const [abandoning, setAbandoning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [confirmAbandon, setConfirmAbandon] = useState(false)
  const [message, setMessage] = useState('')

  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const backgroundAtRef = useRef<number | null>(null)
  const startedAtRef = useRef<number | null>(null)
  const durationRef = useRef<number | null>(null)
  const pausedRemainingRef = useRef(0)
  const sessionIdRef = useRef<number | null>(null)
  const phaseRef = useRef<Phase>('select')

  useEffect(() => {
    loadInitial()
    return () => {
      stopTicker()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 切后台检测（Web 用 visibilitychange 模拟小程序 useDidHide/useDidShow）
  const handleVisibility = () => {
    if (document.hidden) {
      if (phaseRef.current === 'focusing' && !isPaused && startedAtRef.current) {
        backgroundAtRef.current = Date.now()
      }
    } else {
      if (phaseRef.current === 'focusing' && backgroundAtRef.current) {
        const elapsed = Date.now() - backgroundAtRef.current
        if (elapsed >= BG_TOLERANCE_MS) {
          setShowLeavePrompt(true)
        }
        backgroundAtRef.current = null
      }
    }
  }

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stopTicker = () => {
    if (tickerRef.current) {
      clearInterval(tickerRef.current)
      tickerRef.current = null
    }
  }

  const showMessage = (text: string) => {
    setMessage(text)
    setTimeout(() => setMessage(''), 2600)
  }

  const loadInitial = async () => {
    try {
      const [bal, today, activeRes] = await Promise.all([
        fetchSupplyBalance(),
        fetchTodayFocus(),
        fetchActiveFocus(),
      ])
      if (bal.equippedItem) setEquipped(bal.equippedItem)
      setTodayMinutes(today.totalMinutes || 0)
      if (activeRes.active) {
        setStaleActive({
          sessionId: activeRes.active.sessionId,
          duration: activeRes.active.duration,
          elapsedSeconds: activeRes.active.elapsedSeconds,
        })
      }
    } catch (err) {
      console.error('加载专注页失败:', err)
    }
  }

  const startTicker = () => {
    stopTicker()
    tickerRef.current = setInterval(() => {
      const sa = startedAtRef.current
      const d = durationRef.current
      if (!sa || !d) return
      const elapsedSec = Math.floor((Date.now() - sa) / 1000)
      const totalSec = d * 60
      const left = Math.max(0, totalSec - elapsedSec)
      setRemaining(left)
      if (left <= 0) {
        stopTicker()
        handleComplete()
      }
    }, 1000)
  }

  const handleSelect = async (d: FocusDuration) => {
    try {
      const res = await startFocus(d)
      const sa = new Date(res.startedAt).getTime()
      sessionIdRef.current = res.sessionId
      startedAtRef.current = sa
      durationRef.current = d
      setDuration(d)
      setRemaining(d * 60)
      setIsPaused(false)
      setPhase('focusing')
      startTicker()
    } catch (err) {
      showMessage(err instanceof Error ? err.message : '开始失败')
    }
  }

  const handleComplete = async () => {
    const sid = sessionIdRef.current
    if (!sid) return
    stopTicker()
    try {
      const res = await endFocus(sid, 'complete')
      setResult({ pointsAwarded: res.pointsAwarded, status: res.status })
      setPhase('completed')
      showMessage(
        res.status === 'cheated' ? '时长不足，未获得学习点' : `专注完成 +${res.pointsAwarded} 学习点`
      )
    } catch {
      showMessage('结束失败')
    }
  }

  const handlePause = () => {
    stopTicker()
    pausedRemainingRef.current = remaining
    setIsPaused(true)
  }

  const handleResume = () => {
    if (!durationRef.current) return
    const totalSec = durationRef.current * 60
    const newStartAt = Date.now() - (totalSec - pausedRemainingRef.current) * 1000
    startedAtRef.current = newStartAt
    setRemaining(pausedRemainingRef.current)
    setIsPaused(false)
    startTicker()
  }

  const handleResumeStale = () => {
    if (!staleActive) return
    const sid = staleActive.sessionId
    const d = staleActive.duration as FocusDuration
    const totalSec = d * 60
    const left = Math.max(0, totalSec - staleActive.elapsedSeconds)
    const sa = Date.now() - staleActive.elapsedSeconds * 1000

    sessionIdRef.current = sid
    startedAtRef.current = sa
    durationRef.current = d
    setDuration(d)
    setRemaining(left)
    setIsPaused(false)
    setStaleActive(null)
    setPhase('focusing')
    startTicker()
  }

  const handleAbandonStale = async () => {
    if (!staleActive || abandoning) return
    setAbandoning(true)
    try {
      await endFocus(staleActive.sessionId, 'abandon')
      setStaleActive(null)
      showMessage('已放弃上次专注')
    } catch (err) {
      showMessage(err instanceof Error ? err.message : '操作失败')
    } finally {
      setAbandoning(false)
    }
  }

  const doAbandon = async () => {
    const sid = sessionIdRef.current
    if (!sid) return
    stopTicker()
    try {
      await endFocus(sid, 'abandon')
      showMessage('已放弃')
      setConfirmAbandon(false)
      setPhase('select')
      setStaleActive(null)
      loadInitial()
    } catch {
      showMessage('操作失败')
    }
  }

  const handleFinish = () => {
    router.push('/')
  }

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const totalSec = (duration || 30) * 60
  const progress = duration ? Math.min(1, (totalSec - remaining) / totalSec) : 0

  const mascotImg = equipped
    ? getCollectionImageUrl(equipped.imageUrl)
    : '/collection/panda-reading-120.png'

  return (
    <div className="min-h-screen pb-14">
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
          <h1 className="text-base font-bold text-slate-800">专注</h1>
          <span className="w-16" />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 pt-6">
        {phase === 'select' && (
          <div>
            {staleActive ? (
              <div className="card-pixel p-8 text-center">
                <div className="text-4xl mb-3">⏱️</div>
                <div className="text-lg font-bold text-slate-800">有一场未结束的专注</div>
                <p className="text-sm text-slate-500 mt-2">
                  上次发起了 {staleActive.duration} 分钟专注，已过去{' '}
                  {Math.floor(staleActive.elapsedSeconds / 60)} 分钟。
                </p>
                <p className="text-sm text-slate-500">
                  你可以继续本次专注，或放弃后开启新的。
                </p>
                <div className="grid grid-cols-2 gap-3 mt-6">
                  <button
                    onClick={handleResumeStale}
                    className="btn-3d bg-primary-500 text-white py-2.5 rounded-[12px] text-sm font-bold transition-all active:translate-y-1 active:shadow-[0_1px_0_#2563eb]"
                  >
                    继续专注
                  </button>
                  <button
                    onClick={handleAbandonStale}
                    disabled={abandoning}
                    className="btn-3d bg-slate-200 text-slate-600 py-2.5 rounded-[12px] text-sm font-bold transition-all disabled:opacity-50 active:translate-y-1 active:shadow-[0_1px_0_#9ca3af]"
                  >
                    {abandoning ? '处理中...' : '放弃本次专注'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="section-title-pixel text-center">选择专注时长</h2>

                {/* 陪伴形象 */}
                <div className="card-pixel p-6 mt-4 text-center">
                  <div
                    className={`w-24 h-24 mx-auto rounded-[18px] bg-slate-50 flex items-center justify-center ${
                      equipped?.rarity === 'rare' ? 'rare-shimmer' : ''
                    }`}
                  >
                    <img
                      className="w-20 h-20 object-contain focus-mascot-breathe"
                      src={mascotImg}
                      alt={equipped?.name || '熊猫'}
                    />
                  </div>
                  <div className="text-sm font-bold text-slate-700 mt-3">
                    {equipped ? `和 ${equipped.name} 一起专注` : '和默认熊猫一起专注'}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    今日已专注 {todayMinutes} 分钟
                  </div>
                </div>

                {/* 时长选择 */}
                <div className="grid grid-cols-2 gap-4 mt-5">
                  <button
                    onClick={() => handleSelect(30)}
                    className="card-pixel card-active p-6 text-center transition-all hover:-translate-y-1"
                  >
                    <div className="text-4xl font-bold text-slate-800">30</div>
                    <div className="text-sm text-slate-500 mt-1">分钟</div>
                    <span className="inline-block mt-3 text-xxs font-bold text-primary-600 bg-primary-50 px-2.5 py-1 rounded-full">
                      +2 学习点
                    </span>
                  </button>
                  <button
                    onClick={() => handleSelect(60)}
                    className="card-pixel card-active p-6 text-center border-2 border-primary-400 transition-all hover:-translate-y-1"
                  >
                    <div className="text-4xl font-bold text-primary-600">60</div>
                    <div className="text-sm text-slate-500 mt-1">分钟</div>
                    <span className="inline-block mt-3 text-xxs font-bold text-primary-600 bg-primary-50 px-2.5 py-1 rounded-full">
                      +4 学习点
                    </span>
                  </button>
                </div>

                <p className="text-center text-xs text-slate-400 mt-5">
                  专注期间切走页面超过 5 分钟将被提示放弃
                </p>
              </>
            )}
          </div>
        )}

        {phase === 'focusing' && (
          <div className="text-center pt-4">
            <div
              className={`w-24 h-24 mx-auto rounded-[18px] bg-slate-50 flex items-center justify-center ${
                equipped?.rarity === 'rare' ? 'rare-shimmer' : ''
              }`}
            >
              <img
                className="w-20 h-20 object-contain focus-mascot-breathe"
                src={mascotImg}
                alt={equipped?.name || '熊猫'}
              />
            </div>

            <div className="focus-countdown-ring mt-8">
              <div
                className="focus-ring-fill"
                style={{
                  background: `conic-gradient(#3b82f6 ${progress * 360}deg, #e5e7eb ${progress * 360}deg)`,
                }}
              />
              <div className="focus-ring-inner">
                <div className="text-5xl font-bold text-slate-800 tabular-nums">
                  {formatTime(remaining)}
                </div>
                <div className="text-sm text-slate-400 mt-2">
                  {isPaused ? '已暂停' : `${duration} 分钟专注中`}
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-center mt-10">
              {isPaused ? (
                <button
                  onClick={handleResume}
                  className="btn-3d bg-primary-500 text-white px-8 py-3 rounded-[14px] text-sm font-bold transition-all active:translate-y-1 active:shadow-[0_1px_0_#2563eb]"
                >
                  继续专注
                </button>
              ) : (
                <button
                  onClick={handlePause}
                  className="btn-3d bg-slate-200 text-slate-700 px-8 py-3 rounded-[14px] text-sm font-bold transition-all active:translate-y-1 active:shadow-[0_1px_0_#9ca3af]"
                >
                  暂停
                </button>
              )}
              <button
                onClick={() => setConfirmAbandon(true)}
                className="btn-3d bg-red-500 text-white px-8 py-3 rounded-[14px] text-sm font-bold transition-all active:translate-y-1 active:shadow-[0_1px_0_#b91c1c]"
              >
                放弃
              </button>
            </div>
          </div>
        )}

        {phase === 'completed' && result && (
          <div className="card-pixel p-10 text-center mt-10">
            <div className="text-5xl mb-3">{result.status === 'cheated' ? '⚠️' : '🎉'}</div>
            <div className="text-xl font-bold text-slate-800">
              {result.status === 'cheated' ? '时长未达标' : '专注完成'}
            </div>
            <div className="text-2xl font-bold text-primary-600 mt-3">
              {result.status === 'cheated' ? '本次未获得学习点' : `+${result.pointsAwarded} 学习点`}
            </div>
            <p className="text-sm text-slate-500 mt-2">
              {result.status === 'cheated' ? '请坚持完成 30/60 分钟专注' : '继续加油！'}
            </p>
            <button
              onClick={handleFinish}
              className="btn-3d bg-slate-800 text-white px-10 py-3 rounded-[14px] text-sm font-bold mt-8 transition-all active:translate-y-1 active:shadow-[0_1px_0_#111827]"
            >
              返回首页
            </button>
          </div>
        )}
      </div>

      {/* 离开超时提示 */}
      {showLeavePrompt && (
        <div className="supply-result-mask">
          <div className="supply-result-card">
            <div className="text-lg font-bold text-slate-800">检测到长时间离开</div>
            <p className="text-sm text-slate-500 mt-2">已离开超过 5 分钟，是否放弃本次专注？</p>
            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                onClick={() => {
                  setShowLeavePrompt(false)
                  backgroundAtRef.current = null
                }}
                className="btn-3d bg-slate-200 text-slate-700 py-2.5 rounded-[12px] text-sm font-bold transition-all active:translate-y-1 active:shadow-[0_1px_0_#9ca3af]"
              >
                继续
              </button>
              <button
                onClick={async () => {
                  setShowLeavePrompt(false)
                  await doAbandon()
                }}
                className="btn-3d bg-red-500 text-white py-2.5 rounded-[12px] text-sm font-bold transition-all active:translate-y-1 active:shadow-[0_1px_0_#b91c1c]"
              >
                放弃
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 放弃确认 */}
      {confirmAbandon && (
        <div className="supply-result-mask">
          <div className="supply-result-card">
            <div className="text-lg font-bold text-slate-800">放弃本次专注？</div>
            <p className="text-sm text-slate-500 mt-2">当前时长未达标，将不会获得学习点。</p>
            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                onClick={() => setConfirmAbandon(false)}
                className="btn-3d bg-slate-200 text-slate-700 py-2.5 rounded-[12px] text-sm font-bold transition-all active:translate-y-1 active:shadow-[0_1px_0_#9ca3af]"
              >
                继续专注
              </button>
              <button
                onClick={doAbandon}
                className="btn-3d bg-red-500 text-white py-2.5 rounded-[12px] text-sm font-bold transition-all active:translate-y-1 active:shadow-[0_1px_0_#b91c1c]"
              >
                放弃
              </button>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-sm px-5 py-2.5 rounded-[12px] shadow-lg">
          {message}
        </div>
      )}
    </div>
  )
}
