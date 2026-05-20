'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface ProfileData {
  user: {
    id: string
    username: string
    nickname: string | null
    createdAt: string
  }
  membership: {
    isVip: boolean
    vipType: string
    vipExpire: string | null
    remainingFree: number
  }
  stats: {
    totalPractices: number
    avgScore: number | null
  }
}

export default function Profile() {
  const router = useRouter()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [inviteCode, setInviteCode] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteMessage, setInviteMessage] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [feedbackContent, setFeedbackContent] = useState('')
  const [feedbackType, setFeedbackType] = useState('建议')
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }

    fetch('/api/profile', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          localStorage.removeItem('token')
          router.push('/login')
        } else {
          setProfile(data)
        }
      })
      .catch(() => {
        localStorage.removeItem('token')
        router.push('/login')
      })
      .finally(() => setLoading(false))
  }, [router])

  const handleValidateInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteMessage('')
    setInviteError('')

    if (!inviteCode.trim()) {
      setInviteError('请输入邀请码')
      return
    }

    setInviteLoading(true)
    const token = localStorage.getItem('token')

    try {
      const res = await fetch('/api/invite/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: inviteCode.trim() }),
      })

      const data = await res.json()

      if (res.ok) {
        setInviteMessage(data.message)
        setInviteCode('')
        // 刷新个人信息
        const profileRes = await fetch('/api/profile', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const profileData = await profileRes.json()
        if (!profileData.error) {
          setProfile(profileData)
        }
      } else {
        setInviteError(data.error || '验证失败')
      }
    } catch {
      setInviteError('网络错误，请稍后重试')
    } finally {
      setInviteLoading(false)
    }
  }

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault()
    setFeedbackMessage('')

    if (!feedbackContent.trim()) {
      return
    }

    setFeedbackLoading(true)
    const token = localStorage.getItem('token')

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: feedbackContent.trim(),
          type: feedbackType,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setFeedbackMessage(data.message)
        setFeedbackContent('')
      } else {
        setFeedbackMessage(data.error || '提交失败')
      }
    } catch {
      setFeedbackMessage('网络错误，请稍后重试')
    } finally {
      setFeedbackLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500">加载中...</div>
      </div>
    )
  }

  if (!profile) return null

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-slate-700 hover:text-slate-900"
          >
            <span className="text-xl">←</span>
            <span className="font-medium">返回首页</span>
          </button>
          <h1 className="text-lg font-bold text-slate-800">个人中心</h1>
          <button
            onClick={handleLogout}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            退出登录
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* 用户信息卡片 */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center text-2xl">
              🐻
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                {profile.user.nickname || profile.user.username}
              </h2>
              <p className="text-sm text-slate-500">
                用户名：{profile.user.username}
              </p>
              <p className="text-sm text-slate-400">
                注册时间：{profile.user.createdAt}
              </p>
            </div>
          </div>
        </div>

        {/* 会员状态卡片 */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">会员状态</h3>

          {profile.membership.isVip ? (
            <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">⭐</span>
                <span className="font-bold text-yellow-800">VIP会员</span>
              </div>
              <p className="text-sm text-yellow-700">
                会员到期时间：{profile.membership.vipExpire}
              </p>
              <p className="text-sm text-yellow-600 mt-1">
                无限次使用所有功能
              </p>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">👤</span>
                <span className="font-bold text-slate-700">普通用户</span>
              </div>
              <p className="text-sm text-slate-600">
                每日免费 <strong>5</strong> 次AI练习，今日剩余{' '}
                <strong>{profile.membership.remainingFree}</strong> 次
              </p>
            </div>
          )}

          {/* 邀请码输入 */}
          <form onSubmit={handleValidateInvite} className="mt-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {profile.membership.isVip ? '续费会员' : '开通会员'}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="请输入邀请码"
              />
              <button
                type="submit"
                disabled={inviteLoading}
                className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {inviteLoading ? '验证中...' : '确认'}
              </button>
            </div>
            {inviteError && (
              <p className="text-sm text-red-600 mt-2">{inviteError}</p>
            )}
            {inviteMessage && (
              <p className="text-sm text-green-600 mt-2">{inviteMessage}</p>
            )}
          </form>
        </div>

        {/* 使用统计 */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">使用统计</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-primary-600">
                {profile.stats.totalPractices}
              </div>
              <div className="text-sm text-slate-500 mt-1">总练习次数</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-primary-600">
                {profile.stats.avgScore ?? '--'}
              </div>
              <div className="text-sm text-slate-500 mt-1">平均分</div>
            </div>
          </div>
        </div>

        {/* 意见反馈 */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">意见反馈</h3>
          <form onSubmit={handleSubmitFeedback}>
            <div className="mb-3">
              <select
                value={feedbackType}
                onChange={(e) => setFeedbackType(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="建议">💡 功能建议</option>
                <option value="BUG">🐛 问题反馈</option>
                <option value="其他">📝 其他</option>
              </select>
            </div>
            <textarea
              value={feedbackContent}
              onChange={(e) => setFeedbackContent(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              rows={4}
              placeholder="请描述您遇到的问题或建议..."
              maxLength={2000}
            />
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-slate-400">
                {feedbackContent.length}/2000
              </span>
              <button
                type="submit"
                disabled={feedbackLoading || !feedbackContent.trim()}
                className="bg-slate-700 hover:bg-slate-800 text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {feedbackLoading ? '提交中...' : '提交反馈'}
              </button>
            </div>
            {feedbackMessage && (
              <p
                className={`text-sm mt-2 ${
                  feedbackMessage.includes('成功')
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}
              >
                {feedbackMessage}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
