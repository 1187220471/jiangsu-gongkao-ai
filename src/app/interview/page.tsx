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

export default function InterviewPage() {
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

  const sections = [
    {
      title: 'AI智能练习',
      subtitle: '选择题型，随机出题，提交后AI智能批改',
      icon: '🤖',
      color: 'from-blue-500 to-blue-600',
      hoverColor: 'hover:from-blue-600 hover:to-blue-700',
      route: '/practice',
      features: ['7大题型', '随机出题', 'AI批改', '改进建议'],
      badge: '每日5次免费',
    },
    {
      title: '面试真题参考',
      subtitle: '江苏省考历年真题 + AI三答对比 + 参考答案',
      icon: '📜',
      color: 'from-emerald-500 to-emerald-600',
      hoverColor: 'hover:from-emerald-600 hover:to-emerald-700',
      route: '/zhenti',
      features: ['2008-2026真题', 'AI三答', '汇总答案', '语音答题'],
      badge: '200+ 真题',
    },
    {
      title: '套题训练',
      subtitle: '模拟真实考场，一次性生成完整套题',
      icon: '📋',
      color: 'from-amber-500 to-amber-600',
      hoverColor: 'hover:from-amber-600 hover:to-amber-700',
      route: '/practice',
      features: ['3题/4题模式', '限时模拟', 'Word下载', '邀请专享'],
      badge: '邀请用户专享',
    },
    {
      title: '自定义题目',
      subtitle: '输入你自己的面试题，AI生成参考答案',
      icon: '✏️',
      color: 'from-purple-500 to-purple-600',
      hoverColor: 'hover:from-purple-600 hover:to-purple-700',
      route: '/custom-question',
      features: ['自由输入', 'AI生成', '参考答案', '即时查看'],
      badge: null,
    },
    {
      title: '练习记录',
      subtitle: '查看历史答题记录和AI批改结果',
      icon: '📚',
      color: 'from-slate-500 to-slate-600',
      hoverColor: 'hover:from-slate-600 hover:to-slate-700',
      route: '/history',
      features: ['历史记录', '批改回顾', '成绩追踪', '持续改进'],
      badge: null,
    },
  ]

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-slate-800 hover:text-primary-600 transition-colors"
          >
            <span className="text-2xl">🐻</span>
            <span className="font-bold">江苏公考AI智能训练网站</span>
          </button>
          <div className="flex items-center gap-4">
            {getQuotaDisplay()}
            {user && (
              <span className="text-sm text-slate-600">
                你好，{user.nickname || user.username}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-10 text-center">
          <h2 className="text-3xl font-bold text-slate-800 mb-3">
            🎤 公考面试训练
          </h2>
          <p className="text-slate-500 max-w-xl mx-auto">
            结构化面试全链路训练：AI出题、语音答题、智能批改、真题参考，助你面试高分上岸
          </p>
        </div>
      </div>

      {/* Sections */}
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {sections.map((section) => (
            <button
              key={section.route + section.title}
              onClick={() => router.push(section.route)}
              className={`bg-gradient-to-br ${section.color} ${section.hoverColor} text-white p-6 rounded-2xl shadow-lg transition-all hover:shadow-2xl hover:-translate-y-1 text-left group relative overflow-hidden`}
            >
              {/* 装饰 */}
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full" />
              <div className="absolute -bottom-3 -left-3 w-16 h-16 bg-white/5 rounded-full" />

              <div className="relative">
                {section.badge && (
                  <div className="absolute top-0 right-0 text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-medium backdrop-blur-sm">
                    {section.badge}
                  </div>
                )}

                <div className="text-4xl mb-4">{section.icon}</div>
                <h3 className="text-xl font-bold mb-1">{section.title}</h3>
                <p className="text-white/70 text-sm mb-4">{section.subtitle}</p>

                <div className="flex flex-wrap gap-1.5">
                  {section.features.map((f) => (
                    <span
                      key={f}
                      className="text-xs bg-white/15 text-white/90 px-2 py-0.5 rounded-full backdrop-blur-sm"
                    >
                      {f}
                    </span>
                  ))}
                </div>

                <div className="mt-4 flex items-center gap-1 text-sm text-white/60 group-hover:text-white/90 transition-colors">
                  <span>点击进入</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* 支持的题型 */}
        <div className="mt-10 bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-4 text-center">支持的面试题型</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              '社会现象类',
              '态度观点类',
              '组织管理类',
              '应急应变类',
              '人际关系类',
              '自我认知类',
              '情景模拟类',
            ].map((type) => (
              <div
                key={type}
                className="bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-600 text-center border border-slate-100"
              >
                {type}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
