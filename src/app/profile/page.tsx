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
  access: {
    hasAccess: boolean
    accessLevel: string
    accessExpire: string | null
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
  const [bindToken, setBindToken] = useState('')
  const [bindLoading, setBindLoading] = useState(false)
  const [bindMessage, setBindMessage] = useState('')
  const [bindError, setBindError] = useState('')

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

  const handleGenerateBindToken = async () => {
    setBindMessage('')
    setBindError('')
    setBindToken('')
    setBindLoading(true)
    const token = localStorage.getItem('token')

    try {
      const res = await fetch('/api/auth/bind-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await res.json()

      if (res.ok) {
        setBindToken(data.token)
        setBindMessage(`绑定码已生成，5 分钟内有效。请在小程序「我的」页面输入该绑定码。`)
      } else {
        setBindError(data.error || '生成失败')
      }
    } catch {
      setBindError('网络错误，请稍后重试')
    } finally {
      setBindLoading(false)
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
    <div className="pb-10">
      {/* Header */}
      <header className="bg-white">
        <div className="max-w-3xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-800"
          >
            <span className="text-base">←</span>
            <span className="text-sm font-medium">返回首页</span>
          </button>
          <h1 className="text-base font-bold text-slate-800">个人中心</h1>
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
        <div className="card-pixel p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-xl">
              🐻
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
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

        {/* 邀请权限状态卡片 */}
        <div className="card-pixel p-6">
          <h3 className="text-base font-bold text-slate-800 mb-4">邀请权限</h3>

          {profile.access.hasAccess ? (
            <div className={`rounded-xl p-4 border ${profile.access.accessLevel === 'year' ? 'bg-purple-50 border-purple-200' : 'bg-yellow-50 border-yellow-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{profile.access.accessLevel === 'year' ? '👑' : '⭐'}</span>
                <span className={`font-bold ${profile.access.accessLevel === 'year' ? 'text-purple-800' : 'text-yellow-800'}`}>
                  {profile.access.accessLevel === 'year' ? '长期邀请用户' : '邀请用户'}
                </span>
              </div>
              <p className={`text-sm ${profile.access.accessLevel === 'year' ? 'text-purple-700' : 'text-yellow-700'}`}>
                权限到期时间：{profile.access.accessExpire}
              </p>
              <p className={`text-sm mt-1 ${profile.access.accessLevel === 'year' ? 'text-purple-600' : 'text-yellow-600'}`}>
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
                <strong>{profile.access.remainingFree}</strong> 次
              </p>
            </div>
          )}

          {/* 邀请码输入 */}
          <form onSubmit={handleValidateInvite} className="mt-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {profile.access.hasAccess ? '延长权限' : '激活邀请权限'}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="flex-1 h-10 bg-slate-100 rounded-[10px] border-none px-3 text-sm text-slate-800 focus:outline-2 focus:outline-[#3b82f6] focus:-outline-offset-2 box-border"
                placeholder="请输入邀请码"
              />
              <button
                type="submit"
                disabled={inviteLoading}
                className="btn-3d bg-slate-800 text-white px-5 py-2 rounded-[14px] text-sm font-semibold transition-all disabled:opacity-50 active:translate-y-1 active:shadow-[0_1px_0_#374151]"
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

        {/* 小程序账号绑定 */}
        <div className="card-pixel p-6">
          <h3 className="text-base font-bold text-slate-800 mb-4">绑定小程序</h3>
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">📱</span>
              <span className="font-bold text-slate-700">小程序与 Web 账号共享</span>
            </div>
            <p className="text-sm text-slate-600">
              绑定后，小程序登录将使用该账号，共享邀请权限、练习记录和额度。
            </p>
          </div>
          <button
            onClick={handleGenerateBindToken}
            disabled={bindLoading}
            className="btn-3d w-full bg-green-600 text-white px-6 py-2.5 rounded-[14px] text-sm font-semibold transition-all disabled:opacity-50 active:translate-y-1 active:shadow-[0_1px_0_#166534]"
          >
            {bindLoading ? '生成中...' : '生成小程序绑定码'}
          </button>
          {bindToken && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
              <p className="text-sm font-medium text-green-800 mb-2">小程序绑定码</p>
              <p className="text-2xl font-mono font-bold text-green-900 tracking-wider break-all">
                {bindToken}
              </p>
              <p className="text-xs text-green-700 mt-2">
                复制上方绑定码，在小程序「我的」页面输入完成绑定
              </p>
            </div>
          )}
          {bindError && (
            <p className="text-sm text-red-600 mt-2">{bindError}</p>
          )}
          {bindMessage && (
            <p className="text-sm text-green-600 mt-2">{bindMessage}</p>
          )}
        </div>

        {/* 使用统计 */}
        <div className="card-pixel p-6">
          <h3 className="text-base font-bold text-slate-800 mb-4">使用统计</h3>
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
        <div className="card-pixel p-6">
          <h3 className="text-base font-bold text-slate-800 mb-4">意见反馈</h3>
          <form onSubmit={handleSubmitFeedback}>
            <div className="mb-3">
              <select
                value={feedbackType}
                onChange={(e) => setFeedbackType(e.target.value)}
                className="w-full h-10 bg-slate-100 rounded-[10px] border-none px-3 text-sm text-slate-800 focus:outline-2 focus:outline-[#3b82f6] focus:-outline-offset-2 box-border"
              >
                <option value="建议">💡 功能建议</option>
                <option value="BUG">🐛 问题反馈</option>
                <option value="其他">📝 其他</option>
              </select>
            </div>
            <textarea
              value={feedbackContent}
              onChange={(e) => setFeedbackContent(e.target.value)}
              className="w-full bg-slate-100 rounded-[10px] border-none px-3 py-2 text-sm text-slate-800 focus:outline-2 focus:outline-[#3b82f6] focus:-outline-offset-2 box-border resize-none"
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
                className="btn-3d bg-slate-800 text-white px-5 py-2 rounded-[14px] text-sm font-semibold transition-all disabled:opacity-50 active:translate-y-1 active:shadow-[0_1px_0_#374151]"
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
