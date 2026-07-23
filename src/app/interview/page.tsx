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

  const sections = [
    {
      title: 'AI智能练习',
      subtitle: '选择题型，随机出题，AI智能批改',
      icon: '🤖',
      route: '/practice',
      features: ['7大题型', '随机出题', 'AI批改', '改进建议'],
      badge: '每日5次免费',
    },
    {
      title: '面试真题参考',
      subtitle: '江苏省考历年真题 + AI三答对比',
      icon: '📜',
      route: '/zhenti',
      features: ['2008-2026真题', 'AI三答', '汇总答案', '语音答题'],
      badge: '200+ 真题',
    },
    {
      title: '套题训练',
      subtitle: '模拟真实考场，一次性完整套题',
      icon: '📋',
      route: '/practice',
      features: ['3题/4题模式', '限时模拟', 'Word下载', '邀请专享'],
      badge: '邀请用户专享',
    },
    {
      title: '自定义题目',
      subtitle: '输入你自己的面试题，AI生成答案',
      icon: '✏️',
      route: '/custom-question',
      features: ['自由输入', 'AI生成', '参考答案', '即时查看'],
      badge: null,
    },
    {
      title: '练习记录',
      subtitle: '查看历史答题记录和AI批改结果',
      icon: '📚',
      route: '/history',
      features: ['历史记录', '批改回顾', '成绩追踪', '持续改进'],
      badge: null,
    },
  ]

  return (
    <main className="pb-10">
      {/* Header */}
      <header className="bg-white">
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-slate-800 hover:text-primary-600 transition-colors"
          >
            <span className="text-xl">🐻</span>
            <span className="text-sm font-bold">江苏公考AI智能训练</span>
          </button>
          <div className="flex items-center gap-3">
            {getQuotaDisplay()}
            {user && (
              <span className="text-xs text-slate-500">
                你好，{user.nickname || user.username}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-white">
        <div className="max-w-5xl mx-auto px-4 pb-10 pt-6">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">
            🎤 公考面试训练
          </h2>
          <p className="text-slate-400 text-sm">
            结构化面试全链路训练：AI出题、语音答题、智能批改、真题参考
          </p>
        </div>
      </div>

      {/* Sections */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {sections.map((section) => (
            <button
              key={section.route + section.title}
              onClick={() => router.push(section.route)}
              className="card-pixel p-5 text-left transition-all hover:-translate-y-0.5 active:opacity-85 active:scale-98 relative"
            >
              {section.badge && (
                <div className="absolute top-3 right-3 text-xxs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg">
                  {section.badge}
                </div>
              )}

              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">{section.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-slate-800 mb-1">{section.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{section.subtitle}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {section.features.map((f) => (
                  <span key={f} className="tag-pixel">
                    {f}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>

        {/* 支持的题型 */}
        <div className="mt-8 card-pixel p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-4 text-center">支持的面试题型</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
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
                className="bg-slate-100 rounded-lg px-3 py-2 text-xs text-slate-600 text-center"
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
