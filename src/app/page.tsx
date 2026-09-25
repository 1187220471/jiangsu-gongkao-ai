'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  DEFAULT_EXAMS,
  getCustomExam,
  getExamCountdown,
  saveCustomExam,
  formatExamDate,
  type ExamItem,
} from '@/lib/examCountdown'
import {
  getDailyTask,
  setDailyTaskTarget,
  getPandaImage,
  getMascotStage,
  getTaskHint,
  type DailyTaskState,
} from '@/lib/dailyTask'
import { fetchSupplyBalance, fetchCollection, equipItem, type CollectionItem } from '@/lib/supplyApi'

interface QuotaInfo {
  hasAccess: boolean
  accessLevel: string
  remainingFree: number
}

interface UserInfo {
  id: string
  username: string
  nickname: string | null
}

export default function Home() {
  const router = useRouter()
  const [user, setUser] = useState<UserInfo | null>(null)
  const [quota, setQuota] = useState<QuotaInfo | null>(null)

  // 考试倒计时
  const [exams, setExams] = useState<ExamItem[]>(DEFAULT_EXAMS)
  const [customDateInput, setCustomDateInput] = useState('')
  const [showCustomPicker, setShowCustomPicker] = useState(false)

  // 每日任务
  const [dailyTask, setDailyTask] = useState<DailyTaskState>(() => getDailyTask())
  const [customTarget, setCustomTarget] = useState('')

  // 学习点 / 装备
  const [points, setPoints] = useState(0)
  const [equipped, setEquipped] = useState<{ id: number; name: string; imageUrl: string; rarity: string } | null>(null)

  // 伙伴装备选择器
  const [showMascotPicker, setShowMascotPicker] = useState(false)
  const [pickerItems, setPickerItems] = useState<CollectionItem[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }

    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user)
        } else {
          localStorage.removeItem('token')
          router.push('/login')
        }
      })
      .catch(() => {
        localStorage.removeItem('token')
        router.push('/login')
      })

    fetch('/api/quota', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) {
          setQuota(data)
        }
      })
      .catch(() => {})

    // 文档端加载最近的考试日期 + 补给站余额
    const customExam = getCustomExam()
    if (customExam) {
      setExams((prev) => [...prev.filter((e) => e.id !== 'custom-exam'), customExam])
    }

    fetchSupplyBalance()
      .then((bal) => {
        setPoints(bal.balance)
        if (bal.equippedItem) setEquipped(bal.equippedItem)
      })
      .catch(() => {})
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem('token')
    router.push('/login')
  }

  // ---- 考试倒计时 ----
  const examCards = exams.map((exam) => ({ exam, result: getExamCountdown(exam) }))

  const handleCustomExamDate = () => {
    const exam = saveCustomExam(customDateInput)
    if (!exam) return
    setExams((prev) => [...prev.filter((e) => e.id !== 'custom-exam'), exam])
    setCustomDateInput('')
    setShowCustomPicker(false)
  }

  // ---- 每日任务 ----
  const pandaStage = getMascotStage(dailyTask.progress)

  const handleSetTarget = () => {
    const n = Number(customTarget)
    if (!n || n < 1 || n > 20) return
    setDailyTask(setDailyTaskTarget(n))
    setCustomTarget('')
  }

  // ---- 伙伴装备选择器 ----
  const openMascotPicker = async () => {
    setShowMascotPicker(true)
    if (pickerItems.length === 0) {
      try {
        // 跨主题获取全部已收集物品
        const [pet, nba] = await Promise.all([
          fetchCollection('pixelPet'),
          fetchCollection('nbaStar'),
        ])
        setPickerItems([...pet.items, ...nba.items].filter((i) => i.collected))
      } catch (err) {
        console.error('加载图鉴失败:', err)
      }
    }
  }

  const handleEquipFromPicker = async (itemId: number | null) => {
    if (pickerLoading) return
    setPickerLoading(true)
    try {
      await equipItem(itemId)
      const bal = await fetchSupplyBalance()
      setPoints(bal.balance)
      setEquipped(bal.equippedItem || null)
      setShowMascotPicker(false)
      setPickerItems((prev) =>
        prev.map((item) => ({ ...item, isEquipped: item.id === itemId }))
      )
    } catch (err) {
      console.error('装备失败:', err)
    } finally {
      setPickerLoading(false)
    }
  }

  const getQuotaDisplay = () => {
    if (!quota) return null
    if (quota.hasAccess) {
      return (
        <span className="text-xxs bg-slate-800 text-white px-2.5 py-1 rounded-lg font-medium">
          ⭐ 已邀请
        </span>
      )
    }
    return (
      <span className="text-xxs bg-primary-50 text-primary-600 px-2.5 py-1 rounded-lg font-medium">
        今日剩余 {quota.remainingFree} 次
      </span>
    )
  }

  const modules = [
    {
      title: '公考面试训练',
      subtitle: '结构化面试 · 真题模拟 · AI批改',
      icon: '🎤',
      route: '/interview',
      features: ['随机出题', '语音答题', 'AI批改', '真题参考'],
    },
    {
      title: '公考申论训练',
      subtitle: '材料分析 · 写作训练 · 名师答案',
      icon: '📝',
      route: '/shenlun',
      features: ['历年真题', '给定材料', '名师答案', 'AI批改'],
    },
    {
      title: '每日政务要闻',
      subtitle: '江苏政务 · AI精选 · 备考积累',
      icon: '📰',
      route: '/daily-news',
      features: ['每日更新', 'AI精选', '公考素材', '热点追踪'],
    },
    {
      title: '每周素材积累',
      subtitle: '时评精选 · 金句摘录 · 大作文素材',
      icon: '📚',
      route: '/materials',
      features: ['每周更新', '金句提炼', '时评全文', 'AI点评'],
    },
  ]

  return (
    <main className="pb-6">
      {/* Header */}
      <header className="bg-white">
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🐻</span>
            <h1 className="text-base font-bold text-slate-800">江苏公考AI智能训练</h1>
          </div>
          <div className="flex items-center gap-3">
            {getQuotaDisplay()}
            {equipped && (
              <span className="text-xxs bg-orange-50 text-orange-600 font-medium px-2 py-1 rounded-lg flex items-center gap-1">
                🏠 {equipped.name}
              </span>
            )}
            {user && (
              <button
                onClick={() => router.push('/profile')}
                className="text-sm text-slate-600 hover:text-primary-600 transition-colors"
              >
                你好，{user.nickname || user.username}
              </button>
            )}
            <button
              onClick={handleLogout}
              className="text-sm text-slate-400 hover:text-slate-600"
            >
              退出
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="bg-white">
        <div className="max-w-5xl mx-auto px-4 pb-8 pt-6">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">
            江苏公考AI智能训练
          </h2>
          <p className="text-slate-400 text-sm">
            面试、申论、时政三大模块，AI智能辅助，助你高效备考
          </p>
        </div>
      </div>

      {/* Dashboard 卡片区 */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* 考试倒计时 + 每日任务 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          {/* 考试倒计时卡片 */}
          <div className="card-pixel p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-title-pixel">📅 考试倒计时</h3>
              <button
                onClick={() => setShowCustomPicker((v) => !v)}
                className="text-xs text-primary-600 hover:text-primary-700"
              >
                {showCustomPicker ? '收起' : '自定义'}
              </button>
            </div>

            {showCustomPicker && (
              <div className="mb-4 bg-slate-50 rounded-xl p-3">
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={customDateInput}
                    onChange={(e) => setCustomDateInput(e.target.value)}
                    className="flex-1 h-10 bg-white rounded-[10px] border border-slate-200 px-3 text-sm text-slate-800"
                  />
                  <button
                    onClick={handleCustomExamDate}
                    className="btn-3d bg-slate-800 text-white px-4 rounded-[10px] text-sm font-semibold"
                  >
                    添加
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-2">可添加一场「我的考试」，自定义后将替换显示</p>
              </div>
            )}

            <div className="space-y-3">
              {examCards.map(({ exam, result }) => {
                const isCustom = exam.id === 'custom-exam'
                const active = result.status === 'upcoming' || result.status === 'today'
                return (
                  <div
                    key={exam.id}
                    className="flex items-center justify-between bg-slate-50 rounded-xl p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl">{isCustom ? '📌' : '🎯'}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{exam.name}</p>
                        <p className="text-xs text-slate-400">{formatExamDate(exam.date)}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {active ? (
                        <div>
                          <span className="stat-num-pixel text-primary-600">{result.daysRemaining}</span>
                          <span className="text-xs text-slate-400 ml-1">天</span>
                        </div>
                      ) : (
                        <span className={`text-sm font-semibold ${result.status === 'expired' ? 'text-slate-400' : 'text-red-500'}`}>
                          {result.displayText}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 每日任务卡片 */}
          <div className="card-pixel p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-title-pixel">🐼 每日任务</h3>
              {dailyTask.completed && (
                <span className="tag-pixel bg-green-50 text-green-600 !bg-green-50">已完成</span>
              )}
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={openMascotPicker}
                className="w-20 h-20 flex-shrink-0 relative group"
                aria-label="切换首页展示伙伴"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={equipped ? equipped.imageUrl : getPandaImage(dailyTask.progress)}
                  alt={equipped ? equipped.name : '熊猫进度'}
                  className={`w-full h-full object-contain transition-transform group-hover:scale-105 ${
                    equipped?.rarity === 'rare' ? 'rare-shimmer rounded-[14px]' : ''
                  }`}
                />
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-xxs bg-slate-800 text-white px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                  点击切换
                </span>
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500 mb-2">{getTaskHint(dailyTask.count, dailyTask.target)}</p>
                <div className="progress-pixel">
                  <div className="progress-pixel-fill" style={{ width: `${dailyTask.progress}%` }} />
                </div>
                <p className="text-xxs text-slate-400 mt-2">
                  今日练习 <span className="font-bold text-slate-600">{dailyTask.count}</span> / {dailyTask.target} 次
                </p>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <input
                type="number"
                min={1}
                max={20}
                value={customTarget}
                onChange={(e) => setCustomTarget(e.target.value)}
                placeholder={`每日目标 ${dailyTask.target} 次`}
                className="flex-1 h-10 bg-slate-100 rounded-[10px] border-none px-3 text-sm text-slate-800 text-center focus:outline-2 focus:outline-[#3b82f6]"
              />
              <button
                onClick={handleSetTarget}
                className="btn-3d bg-slate-800 text-white px-4 rounded-[10px] text-sm font-semibold"
              >
                设定
              </button>
            </div>
          </div>
        </div>

        {/* 补给站 / 专注 快捷入口 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <Link href="/supply" className="card-pixel card-active p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎁</span>
              <div>
                <p className="text-sm font-bold text-slate-800">补给站</p>
                <p className="text-xs text-slate-400">抽卡集卡 · 学习点兑换</p>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <span className="stat-num-pixel text-primary-600">💎 {points}</span>
              <p className="text-xxs text-slate-400 mt-0.5">学习点</p>
            </div>
          </Link>

          <Link href="/focus" className="card-pixel card-active p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⏱️</span>
              <div>
                <p className="text-sm font-bold text-slate-800">专注训练</p>
                <p className="text-xs text-slate-400">30/60 分钟番茄钟</p>
              </div>
            </div>
            <span className="text-2xl text-slate-300">→</span>
          </Link>
        </div>

        {/* Module Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {modules.map((module) => (
            <button
              key={module.route}
              onClick={() => router.push(module.route)}
              className="card-pixel p-5 text-left transition-all hover:-translate-y-0.5 active:opacity-85 active:scale-98"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-3xl">{module.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-slate-800 mb-1">{module.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{module.subtitle}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {module.features.map((feature) => (
                  <span key={feature} className="tag-pixel">
                    {feature}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>

        {/* 额度提示 */}
        {quota && !quota.hasAccess && (
          <div className="mt-6 bg-white rounded-2xl p-4 max-w-3xl mx-auto">
            <div className="flex items-center gap-2">
              <span className="text-sm">💡</span>
              <span className="text-xs text-slate-600">
                每日免费 <strong className="text-slate-800">5</strong> 次AI练习，今日剩余{' '}
                <strong className="text-slate-800">{quota.remainingFree}</strong> 次
              </span>
            </div>
          </div>
        )}

        {quota && quota.hasAccess && (
          <div className="mt-6 bg-white rounded-2xl p-4 max-w-3xl mx-auto">
            <div className="flex items-center gap-2">
              <span className="text-sm">⭐</span>
              <span className="text-xs text-slate-600">
                已邀请用户，无限次使用，感谢您的支持！
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 伙伴装备选择器弹层 */}
      {showMascotPicker && (
        <div className="supply-result-mask" onClick={() => setShowMascotPicker(false)}>
          <div
            className="supply-result-card !w-[min(92vw,400px)] !max-w-[400px] !p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-800">选择首页展示的伙伴</h3>
              <button
                onClick={() => setShowMascotPicker(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5 max-h-[52vh] overflow-y-auto pr-1">
              {/* 默认熊猫 */}
              <button
                onClick={() => handleEquipFromPicker(null)}
                disabled={pickerLoading}
                className={`relative bg-white border-2 rounded-[12px] p-2.5 text-center transition-all disabled:opacity-50 ${
                  !equipped
                    ? 'border-primary-500'
                    : 'border-slate-200 hover:border-slate-400'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getPandaImage(dailyTask.progress)}
                  alt="默认熊猫"
                  className="w-14 h-14 object-contain mx-auto"
                />
                <div className="text-xs text-slate-600 mt-1">默认熊猫</div>
                {!equipped && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary-500 text-white text-xxs px-2 py-0.5 rounded-full whitespace-nowrap">
                    展示中
                  </span>
                )}
              </button>

              {/* 已收集物品（跨主题） */}
              {pickerItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleEquipFromPicker(item.id)}
                  disabled={pickerLoading}
                  className={`relative bg-white border-2 rounded-[12px] p-2.5 text-center transition-all disabled:opacity-50 ${
                    item.isEquipped
                      ? 'border-primary-500'
                      : 'border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className={`w-14 h-14 object-contain mx-auto ${
                      item.rarity === 'rare' ? 'rare-shimmer rounded-[10px]' : ''
                    }`}
                  />
                  <div className="text-xs text-slate-600 mt-1 truncate">{item.name}</div>
                  {item.isEquipped && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary-500 text-white text-xxs px-2 py-0.5 rounded-full whitespace-nowrap">
                      展示中
                    </span>
                  )}
                </button>
              ))}

              {pickerItems.length === 0 && !pickerLoading && (
                <div className="col-span-3 text-center text-sm text-slate-400 py-6">
                  还没有收集到物品，去补给站抽取吧
                </div>
              )}
            </div>

            <p className="text-xs text-slate-400 text-center mt-4">
              抽取到的萌宠与球星卡可在此切换为首页形象
            </p>
          </div>
        </div>
      )}
    </main>
  )
}