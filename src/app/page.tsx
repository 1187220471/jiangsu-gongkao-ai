'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)

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
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem('token')
    router.push('/login')
  }

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🐟</span>
            <h1 className="text-xl font-bold text-slate-800">戴锦鲤面试训练</h1>
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <span className="text-sm text-slate-600">
                你好，{user.nickname || user.username}
              </span>
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
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
            onClick={() => router.push('/history')}
            className="bg-white hover:bg-slate-50 text-slate-800 p-8 rounded-2xl shadow-lg transition-all hover:shadow-xl text-left border border-slate-200 group"
          >
            <div className="text-4xl mb-4">📚</div>
            <h3 className="text-xl font-bold mb-2">练习记录</h3>
            <p className="text-slate-500 text-sm">
              查看历史答题记录和AI批改结果
            </p>
          </button>
        </div>

        <div className="mt-12 bg-white rounded-xl p-6 shadow-sm border border-slate-200 max-w-2xl mx-auto">
          <h3 className="font-bold text-slate-800 mb-4">支持的题型</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              '社会现象类',
              '态度观点类',
              '组织管理类',
              '应急应变类',
              '人际关系类',
              '自我认知类',
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
