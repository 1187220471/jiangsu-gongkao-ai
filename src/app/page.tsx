'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface QuotaInfo {
  hasAccess: boolean
  accessLevel: string
  remainingFree: number
  coins: number
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

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🐻</span>
            <h1 className="text-xl font-bold text-slate-800">江苏公务员面试答题训练</h1>
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

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-800 mb-4">
            江苏省公务员面试AI智能训练
          </h2>
          <p className="text-slate-600 max-w-lg mx-auto">
            随机生成江苏特色面试题，AI智能批改，助你高效备考
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <button
            onClick={() => router.push('/practice')}
            className="bg-primary-600 hover:bg-primary-700 text-white p-8 rounded-2xl shadow-lg transition-all hover:shadow-xl text-left group"
          >
            <div className="text-4xl mb-4">📝</div>
            <h3 className="text-xl font-bold mb-2">开始练习</h3>
            <p className="text-primary-100 text-sm">
              选择题型，随机出题，提交答案后AI智能批改
            </p>
          </button>

          <button
            onClick={() => router.push('/custom-question')}
            className="bg-white hover:bg-slate-50 text-slate-800 p-8 rounded-2xl shadow-lg transition-all hover:shadow-xl text-left border border-slate-200 group"
          >
            <div className="text-4xl mb-4">✏️</div>
            <h3 className="text-xl font-bold mb-2">自定义题目</h3>
            <p className="text-slate-500 text-sm">
              输入你自己的面试题，AI生成参考答案
            </p>
          </button>

          <button
            onClick={() => router.push('/history')}
            className="bg-white hover:bg-slate-50 text-slate-800 p-8 rounded-2xl shadow-lg transition-all hover:shadow-xl text-left border border-slate-200 group"
          >
            <div className="text-4xl mb-4">📚</div>
            <h3 className="text-xl font-bold mb-2">练习记录</h3>
            <p className="text-slate-500 text-sm">
              查看历史答题记录和AI批改结果
            </p>
          </button>

          <button
            onClick={() => router.push('/daily-news')}
            className="bg-white hover:bg-slate-50 text-slate-800 p-8 rounded-2xl shadow-lg transition-all hover:shadow-xl text-left border border-slate-200 group"
          >
            <div className="text-4xl mb-4">📰</div>
            <h3 className="text-xl font-bold mb-2">每日政务要闻</h3>
            <p className="text-slate-500 text-sm">
              每天19:00自动抓取江苏政务新闻，AI精选公考备考素材
            </p>
          </button>

          <button
            onClick={() => router.push('/zhenti')}
            className="bg-white hover:bg-slate-50 text-slate-800 p-8 rounded-2xl shadow-lg transition-all hover:shadow-xl text-left border border-slate-200 group relative overflow-hidden"
          >
            <div className="absolute top-3 right-3 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">2008-2026</div>
            <div className="text-4xl mb-4">📜</div>
            <h3 className="text-xl font-bold mb-2">真题复盘</h3>
            <p className="text-slate-500 text-sm">
              江苏省考历年真题 + AI三答对比 + 汇总参考答案
            </p>
          </button>
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

        <div className="mt-8 bg-white rounded-xl p-6 shadow-sm border border-slate-200 max-w-2xl mx-auto">
          <h3 className="font-bold text-slate-800 mb-4">支持的题型</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
                className="bg-slate-50 rounded-lg px-4 py-2 text-sm text-slate-700 text-center"
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
