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
        <span className="text-sm bg-yellow-50 text-yellow-700 px-2.5 py-1 rounded-full font-medium border border-yellow-200">
          ⭐ 已邀请
        </span>
      )
    }
    return (
      <span className="text-sm bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full border border-blue-200">
        今日剩余 {quota.remainingFree} 次
      </span>
    )
  }

  const sections = [
    {
      title: 'AI智能练习',
      subtitle: '选择题型，随机出题，提交后AI智能批改',
      icon: '🤖',
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      route: '/practice',
      features: ['7大题型', '随机出题', 'AI批改', '改进建议'],
      badge: '每日5次免费',
      badgeColor: 'bg-blue-100 text-blue-700',
    },
    {
      title: '面试真题参考',
      subtitle: '江苏省考历年真题 + AI三答对比 + 参考答案',
      icon: '📜',
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      route: '/zhenti',
      features: ['2008-2026真题', 'AI三答', '汇总答案', '语音答题'],
      badge: '200+ 真题',
      badgeColor: 'bg-emerald-100 text-emerald-700',
    },
    {
      title: '套题训练',
      subtitle: '模拟真实考场，一次性生成完整套题',
      icon: '📋',
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      route: '/practice',
      features: ['3题/4题模式', '限时模拟', 'Word下载', '邀请专享'],
      badge: '邀请用户专享',
      badgeColor: 'bg-amber-100 text-amber-700',
    },
    {
      title: '自定义题目',
      subtitle: '输入你自己的面试题，AI生成参考答案',
      icon: '✏️',
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
      route: '/custom-question',
      features: ['自由输入', 'AI生成', '参考答案', '即时查看'],
      badge: null,
      badgeColor: '',
    },
    {
      title: '练习记录',
      subtitle: '查看历史答题记录和AI批改结果',
      icon: '📚',
      iconBg: 'bg-slate-50',
      iconColor: 'text-slate-600',
      route: '/history',
      features: ['历史记录', '批改回顾', '成绩追踪', '持续改进'],
      badge: null,
      badgeColor: '',
    },
  ]

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
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
              className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 transition-all hover:shadow-lg hover:-translate-y-0.5 text-left group relative"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 ${section.iconBg} rounded-xl flex items-center justify-center text-2xl`}>
                  <span className={section.iconColor}>{section.icon}</span>
                </div>
                {section.badge && (
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${section.badgeColor}`}>
                    {section.badge}
                  </span>
                )}
              </div>

              <h3 className="text-lg font-bold text-slate-800 mb-1 group-hover:text-primary-600 transition-colors">
                {section.title}
              </h3>
              <p className="text-slate-500 text-sm mb-4 leading-relaxed">
                {section.subtitle}
              </p>

              <div className="flex flex-wrap gap-2">
                {section.features.map((f) => (
                  <span
                    key={f}
                    className="text-xs bg-slate-50 text-slate-500 px-2.5 py-1 rounded-full border border-slate-100"
                  >
                    {f}
                  </span>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-1 text-sm text-primary-500 font-medium">
                <span>点击进入</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
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
