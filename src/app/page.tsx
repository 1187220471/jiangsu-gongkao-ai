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

    // 获取用户信息
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

    // 获取额度信息
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
        <span className="text-sm bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
          ⭐ 已邀请
        </span>
      )
    }
    return (
      <span className="text-sm bg-primary-50 text-primary-600 px-2 py-0.5 rounded-full">
        今日剩余 {quota.remainingFree} 次
      </span>
    )
  }

  const modules = [
    {
      title: '公考面试训练',
      subtitle: '结构化面试 / 真题模拟 / AI智能批改',
      icon: '🎤',
      color: 'from-blue-500 to-blue-600',
      hoverColor: 'hover:from-blue-600 hover:to-blue-700',
      route: '/interview',
      features: ['随机出题', '语音答题', 'AI批改', '真题参考'],
      stats: '2008-2026 真题',
    },
    {
      title: '公考申论训练',
      subtitle: '材料分析 / 写作训练 / 名师答案对比',
      icon: '📝',
      color: 'from-emerald-500 to-emerald-600',
      hoverColor: 'hover:from-emerald-600 hover:to-emerald-700',
      route: '/shenlun',
      features: ['历年真题', '给定材料', '名师答案', 'AI批改'],
      stats: '2018-2025 真题',
    },
    {
      title: '每日政务要闻',
      subtitle: '江苏政务新闻 / AI精选素材 / 备考积累',
      icon: '📰',
      color: 'from-amber-500 to-amber-600',
      hoverColor: 'hover:from-amber-600 hover:to-amber-700',
      route: '/daily-news',
      features: ['每日更新', 'AI精选', '公考素材', '热点追踪'],
      stats: '每日 19:00 更新',
    },
  ]

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🐻</span>
            <h1 className="text-xl font-bold text-slate-800">江苏公考AI智能训练网站</h1>
          </div>
          <div className="flex items-center gap-4">
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
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              退出
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-16 text-center">
          <h2 className="text-4xl font-bold text-slate-800 mb-4">
            江苏公考AI智能训练网站
          </h2>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto">
            面试、申论、时政三大模块，AI智能辅助，助你高效备考江苏省公务员考试
          </p>
        </div>
      </div>

      {/* Module Cards */}
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {modules.map((module) => (
            <button
              key={module.route}
              onClick={() => router.push(module.route)}
              className={`bg-gradient-to-br ${module.color} ${module.hoverColor} text-white p-8 rounded-2xl shadow-lg transition-all hover:shadow-2xl hover:-translate-y-1 text-left group relative overflow-hidden`}
            >
              {/* 背景装饰 */}
              <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full" />
              <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-white/5 rounded-full" />

              <div className="relative">
                {/* 统计标签 */}
                <div className="absolute top-0 right-0 text-xs bg-white/20 text-white px-2.5 py-1 rounded-full font-medium backdrop-blur-sm">
                  {module.stats}
                </div>

                <div className="text-5xl mb-5">{module.icon}</div>
                <h3 className="text-2xl font-bold mb-2">{module.title}</h3>
                <p className="text-white/80 text-sm mb-5">{module.subtitle}</p>

                {/* 功能标签 */}
                <div className="flex flex-wrap gap-2">
                  {module.features.map((feature) => (
                    <span
                      key={feature}
                      className="text-xs bg-white/20 text-white px-2.5 py-1 rounded-full backdrop-blur-sm"
                    >
                      {feature}
                    </span>
                  ))}
                </div>

                {/* 进入箭头 */}
                <div className="mt-6 flex items-center gap-1 text-sm text-white/70 group-hover:text-white transition-colors">
                  <span>进入训练</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* 额度提示 */}
        {quota && !quota.hasAccess && (
          <div className="mt-8 bg-blue-50 rounded-xl p-4 border border-blue-200 max-w-3xl mx-auto">
            <div className="flex items-center gap-2">
              <span className="text-lg">💡</span>
              <span className="text-sm text-blue-800">
                每日免费 <strong>5</strong> 次AI练习，今日剩余 <strong>{quota.remainingFree}</strong> 次
              </span>
            </div>
          </div>
        )}

        {quota && quota.hasAccess && (
          <div className="mt-8 bg-yellow-50 rounded-xl p-4 border border-yellow-200 max-w-3xl mx-auto">
            <div className="flex items-center gap-2">
              <span className="text-lg">⭐</span>
              <span className="text-sm text-yellow-800">
                已邀请用户，无限次使用，感谢您的支持！
              </span>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
