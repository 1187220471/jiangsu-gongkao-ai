'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

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
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem('token')
    router.push('/login')
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
        <div className="max-w-5xl mx-auto px-4 pb-10 pt-6">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">
            江苏公考AI智能训练
          </h2>
          <p className="text-slate-400 text-sm">
            面试、申论、时政三大模块，AI智能辅助，助你高效备考
          </p>
        </div>
      </div>

      {/* Module Cards */}
      <div className="max-w-5xl mx-auto px-4 py-8">
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
                  <span
                    key={feature}
                    className="tag-pixel"
                  >
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
                每日免费 <strong className="text-slate-800">5</strong> 次AI练习，今日剩余 <strong className="text-slate-800">{quota.remainingFree}</strong> 次
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
    </main>
  )
}
