'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Login() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const data = await res.json()

      if (data.token) {
        localStorage.setItem('token', data.token)
        router.push('/')
      } else {
        setError(data.error || '登录失败')
      }
    } catch {
      setError('网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="text-3xl">🐻</span>
          <h1 className="text-xl font-bold text-slate-800 mt-2">江苏公考AI智能训练</h1>
          <p className="text-slate-400 text-sm mt-1">登录后开始练习</p>
        </div>

        <div className="bg-white rounded-2xl p-7 shadow-card">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                用户名
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full h-10 bg-slate-100 rounded-[10px] border-none px-3 text-sm text-slate-800 focus:outline-2 focus:outline-[#3b82f6] focus:-outline-offset-2 box-border"
                placeholder="请输入用户名"
                required
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-10 bg-slate-100 rounded-[10px] border-none px-3 text-sm text-slate-800 focus:outline-2 focus:outline-[#3b82f6] focus:-outline-offset-2 box-border"
                placeholder="请输入密码"
                required
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-xs">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-pixel w-full h-11 text-sm"
            >
              {loading ? '登录中...' : '登录'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <span className="text-slate-400 text-sm">还没有账号？</span>
            <button
              onClick={() => router.push('/register')}
              className="text-primary-600 hover:text-primary-700 text-sm font-medium ml-1"
            >
              立即注册
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
