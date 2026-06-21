'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getAuthHeaders } from '@/lib/auth'
import IndentedText from '@/components/IndentedText'

interface ComparisonItem {
  answer_id: number
  total_score: number
  dimensions: Record<string, number>
  pros?: string[]
  cons?: string[]
  summary?: string
  strengths?: string
  weaknesses?: string
}

interface ZhentiDetail {
  id: number
  examTitle: string
  examYear: number
  examDate: string
  examCategory: string | null
  questionNumber: number
  questionText: string
  questionType: string
  answer1: string
  answer2: string
  answer3: string
  score1: number
  score2: number
  score3: number
  comparison: {
    comparison: ComparisonItem[]
    best_answer_id: number
    ranking_reason: string
  }
  finalAnswer: string
  finalWordCount: number
  imageUrl: string | null
}

interface SiblingItem {
  id: number
  questionNumber: number
}

const PROFICIENCY_OPTIONS = [
  { value: 'weak', label: '生疏', emoji: '😰', color: 'border-red-300 bg-red-50 text-red-700' },
  { value: 'okay', label: '一般', emoji: '🙂', color: 'border-yellow-300 bg-yellow-50 text-yellow-700' },
  { value: 'mastered', label: '熟练', emoji: '😎', color: 'border-green-300 bg-green-50 text-green-700' },
]

const SCORE_COLOR = (score: number) => {
  if (score >= 85) return 'text-green-600'
  if (score >= 75) return 'text-yellow-600'
  return 'text-red-600'
}

export default function ZhentiDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = parseInt(params.id as string)

  const [question, setQuestion] = useState<ZhentiDetail | null>(null)
  const [siblings, setSiblings] = useState<SiblingItem[]>([])
  const [bookmark, setBookmark] = useState<{ proficiency: string; notes: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'final' | 'compare'>('final')
  const [expandedAnswer, setExpandedAnswer] = useState<number | null>(null)
  const [bookmarkLoading, setBookmarkLoading] = useState(false)
  const [notesInput, setNotesInput] = useState('')
  const [showNotes, setShowNotes] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { router.push('/login'); return }
    fetchDetail()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router])

  const fetchDetail = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/zhenti/detail/${id}`, {
        headers: getAuthHeaders(),
      })
      if (res.status === 401) { router.push('/login'); return }
      const data = await res.json()
      setQuestion(data.question)
      setSiblings(data.siblings || [])
      setBookmark(data.bookmark)
      setNotesInput(data.bookmark?.notes || '')
    } catch (err) {
      console.error('获取题目详情失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleBookmark = async (proficiency: string) => {
    if (bookmarkLoading) return
    setBookmarkLoading(true)
    try {
      if (bookmark?.proficiency === proficiency) {
        // 取消收藏
        await fetch(`/api/zhenti/bookmark?questionId=${id}`, {
          method: 'DELETE',
          headers: getAuthHeaders(),
        })
        setBookmark(null)
      } else {
        const res = await fetch('/api/zhenti/bookmark', {
          method: 'POST',
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionId: id, proficiency, notes: notesInput || null }),
        })
        const data = await res.json()
        setBookmark({ proficiency: data.bookmark.proficiency, notes: data.bookmark.notes })
      }
    } catch (err) {
      console.error('收藏操作失败:', err)
      setBookmarkLoading(false)
    }
  }

  const handleSaveNotes = async () => {
    if (!bookmark) return
    setBookmarkLoading(true)
    try {
      const res = await fetch('/api/zhenti/bookmark', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: id, proficiency: bookmark.proficiency, notes: notesInput }),
      })
      const data = await res.json()
      setBookmark({ proficiency: data.bookmark.proficiency, notes: data.bookmark.notes })
      setShowNotes(false)
    } catch (err) {
      console.error('保存备注失败:', err)
      setBookmarkLoading(false)
    }
  }

  const navigateTo = (sibId: number) => {
    router.push(`/zhenti/${sibId}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-3"></div>
          <div className="text-slate-400 text-sm">加载中...</div>
        </div>
      </div>
    )
  }

  if (!question) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">😕</div>
          <div className="text-slate-500">题目不存在</div>
          <button onClick={() => router.push('/zhenti')} className="mt-4 text-primary-600 text-sm hover:underline">
            返回列表
          </button>
        </div>
      </div>
    )
  }

  const compItems: ComparisonItem[] = question.comparison?.comparison || []

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-primary-600 transition-colors"
            >
              <span>←</span>
              <span>首页</span>
            </button>
            <div className="w-px h-4 bg-slate-200" />
            <button
              onClick={() => router.push('/zhenti')}
              className="text-slate-500 hover:text-slate-800 transition-colors text-sm"
            >
              返回
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">
                {question.examYear}年
              </span>
              {question.examCategory && (
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                  {question.examCategory}
                </span>
              )}
              <span className="text-xs text-slate-400 truncate hidden sm:block">
                {question.examTitle} · 第{question.questionNumber}题
              </span>
            </div>
          </div>
          {/* 同场次导航 */}
          {siblings.length > 1 && (
            <div className="flex items-center gap-1">
              {siblings.map((s) => (
                <button
                  key={s.id}
                  onClick={() => navigateTo(s.id)}
                  className={`w-7 h-7 rounded-full text-xs font-bold transition-colors ${
                    s.id === question.id
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-primary-100 hover:text-primary-600'
                  }`}
                >
                  {s.questionNumber}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {/* 题目卡片 */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 text-sm font-bold flex items-center justify-center">
              {question.questionNumber}
            </span>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
              {question.questionType}
            </span>
          </div>
          <p className="text-slate-800 leading-relaxed text-base">
            {question.questionText}
          </p>
          {question.imageUrl && !imageError && (
            <div className="mt-4">
              {!imageLoaded && (
                <div className="animate-pulse bg-slate-200 h-64 rounded-lg" />
              )}
              <img
                src={question.imageUrl}
                alt="题目配图"
                className={`max-w-full rounded-lg border border-slate-200 ${imageLoaded ? '' : 'hidden'}`}
                style={{ maxHeight: '400px' }}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
              />
            </div>
          )}
          {imageError && (
            <div className="mt-4 text-sm text-slate-400 bg-slate-50 rounded-lg px-4 py-3 text-center">
              📷 图片加载失败
            </div>
          )}
        </div>

        {/* 掌握度标记 */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">📌 标记掌握度</span>
            {bookmark && (
              <button
                onClick={() => setShowNotes(!showNotes)}
                className="text-xs text-slate-400 hover:text-primary-600 transition-colors"
              >
                {showNotes ? '收起备注' : '编辑备注'}
              </button>
            )}
          </div>
          <div className="flex gap-2 mt-3">
            {PROFICIENCY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleBookmark(opt.value)}
                disabled={bookmarkLoading}
                className={`flex-1 py-2 px-3 rounded-xl border-2 text-sm font-medium transition-all ${
                  bookmark?.proficiency === opt.value
                    ? opt.color + ' border-opacity-100'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                }`}
              >
                {opt.emoji} {opt.label}
              </button>
            ))}
          </div>
          {bookmark && bookmark.notes && !showNotes && (
            <div className="mt-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
              📝 {bookmark.notes}
            </div>
          )}
          {showNotes && bookmark && (
            <div className="mt-3">
              <textarea
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                placeholder="写下你的学习心得或备注..."
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary-400"
                rows={3}
              />
              <button
                onClick={handleSaveNotes}
                disabled={bookmarkLoading}
                className="mt-2 text-xs bg-primary-600 text-white px-4 py-1.5 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                保存备注
              </button>
            </div>
          )}
        </div>

        {/* 答案区域（Tab切换）*/}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Tab 头 */}
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab('final')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === 'final'
                  ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              ✅ 汇总参考答案
            </button>
            <button
              onClick={() => setActiveTab('compare')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === 'compare'
                  ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              📊 3答对比分析
            </button>
          </div>

          {/* 汇总参考答案 */}
          {activeTab === 'final' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-800">参考答案</span>
                  <span className="text-xs text-slate-400">（{question.finalWordCount} 字）</span>
                </div>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">AI三答融合精华版</span>
              </div>
              <IndentedText
                text={question.finalAnswer}
                className="text-slate-700 leading-loose text-sm"
              />
            </div>
          )}

          {/* 3答对比分析 */}
          {activeTab === 'compare' && (
            <div className="p-4 space-y-4">
              {/* 分数概览 */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 1, score: question.score1, temp: '0.9' },
                  { id: 2, score: question.score2, temp: '0.7' },
                  { id: 3, score: question.score3, temp: '0.5' },
                ].map((a) => {
                  const item = compItems.find((c) => c.answer_id === a.id)
                  const isBest = question.comparison?.best_answer_id === a.id
                  return (
                    <div
                      key={a.id}
                      className={`rounded-xl border-2 p-3 text-center transition-all ${
                        isBest
                          ? 'border-amber-400 bg-amber-50'
                          : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div className="text-xs text-slate-400 mb-1">答案 {a.id}</div>
                      <div className={`text-2xl font-bold ${SCORE_COLOR(a.score)}`}>{a.score}</div>
                      <div className="text-xs text-slate-400 mt-0.5">temperature {a.temp}</div>
                      {isBest && (
                        <div className="text-xs text-amber-600 font-medium mt-1">🏆 最佳</div>
                      )}
                      {item?.summary && (
                        <div className="text-xs text-slate-400 mt-1 italic">"{item.summary}"</div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* 维度对比表 */}
              {compItems.length > 0 && (() => {
                const dimensions = Object.keys(compItems[0]?.dimensions || {})
                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="text-left px-3 py-2 text-slate-500 font-medium">维度</th>
                          {compItems.map((c) => (
                            <th key={c.answer_id} className={`px-3 py-2 text-center font-medium ${
                              question.comparison?.best_answer_id === c.answer_id ? 'text-amber-600' : 'text-slate-500'
                            }`}>答案{c.answer_id}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {dimensions.map((dim) => (
                          <tr key={dim} className="hover:bg-slate-50">
                            <td className="px-3 py-2 text-slate-600">{dim}</td>
                            {compItems.map((c) => (
                              <td key={c.answer_id} className={`px-3 py-2 text-center font-medium ${SCORE_COLOR(c.dimensions[dim] || 0)}`}>
                                {c.dimensions[dim] ?? '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                        <tr className="bg-slate-50 font-bold">
                          <td className="px-3 py-2 text-slate-700">合计</td>
                          {compItems.map((c) => (
                            <td key={c.answer_id} className={`px-3 py-2 text-center ${SCORE_COLOR(c.total_score)}`}>
                              {c.total_score}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )
              })()}

              {/* 排名理由 */}
              {question.comparison?.ranking_reason && (
                <div className="bg-amber-50 rounded-xl p-3 text-xs text-amber-800 border border-amber-200">
                  <span className="font-medium">🏆 最佳答案理由：</span>
                  {question.comparison.ranking_reason}
                </div>
              )}

              {/* 3个答案详情（可折叠）*/}
              <div className="space-y-3 pt-2">
                {[
                  { id: 1, content: question.answer1, score: question.score1, temp: '0.9' },
                  { id: 2, content: question.answer2, score: question.score2, temp: '0.7' },
                  { id: 3, content: question.answer3, score: question.score3, temp: '0.5' },
                ].map((a) => {
                  const item = compItems.find((c) => c.answer_id === a.id)
                  const isExpanded = expandedAnswer === a.id
                  const isBest = question.comparison?.best_answer_id === a.id

                  return (
                    <div key={a.id} className={`border-2 rounded-xl overflow-hidden ${isBest ? 'border-amber-300' : 'border-slate-200'}`}>
                      <button
                        onClick={() => setExpandedAnswer(isExpanded ? null : a.id)}
                        className="w-full px-4 py-3 flex items-center justify-between text-left bg-white hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-bold ${SCORE_COLOR(a.score)}`}>{a.score}分</span>
                          <span className="text-sm text-slate-700">答案 {a.id}</span>
                          <span className="text-xs text-slate-400">temperature={a.temp}</span>
                          {isBest && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">最佳</span>}
                        </div>
                        <span className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>›</span>
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-4 bg-slate-50 border-t border-slate-100">
                          {/* 优缺点 */}
                          {item && (item.pros || item.cons || item.strengths || item.weaknesses) && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 mb-4">
                              <div className="bg-green-50 rounded-xl p-3">
                                <div className="text-xs font-medium text-green-700 mb-1.5">✅ 优点</div>
                                <ul className="space-y-1">
                                  {(item.pros || []).map((p, i) => (
                                    <li key={i} className="text-xs text-slate-600">• {p}</li>
                                  ))}
                                  {item.strengths && (
                                    <li className="text-xs text-slate-600 whitespace-pre-wrap">{item.strengths}</li>
                                  )}
                                </ul>
                              </div>
                              <div className="bg-red-50 rounded-xl p-3">
                                <div className="text-xs font-medium text-red-700 mb-1.5">⚠️ 不足</div>
                                <ul className="space-y-1">
                                  {(item.cons || []).map((c, i) => (
                                    <li key={i} className="text-xs text-slate-600">• {c}</li>
                                  ))}
                                  {item.weaknesses && (
                                    <li className="text-xs text-slate-600 whitespace-pre-wrap">{item.weaknesses}</li>
                                  )}
                                </ul>
                              </div>
                            </div>
                          )}
                          {/* 答案原文 */}
                          <div className="bg-white rounded-lg p-3 border border-slate-200">
                            <IndentedText
                              text={a.content}
                              className="text-xs text-slate-600 leading-relaxed"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* 底部导航 */}
        {siblings.length > 1 && (
          <div className="flex gap-3">
            {siblings.map((s) => (
              <button
                key={s.id}
                onClick={() => navigateTo(s.id)}
                className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
                  s.id === question.id
                    ? 'bg-primary-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-primary-400 hover:text-primary-600'
                }`}
              >
                第 {s.questionNumber} 题
              </button>
            ))}
          </div>
        )}

        <div className="text-center py-4">
          <button
            onClick={() => router.push('/zhenti')}
            className="text-sm text-slate-400 hover:text-primary-600 transition-colors"
          >
            ← 返回真题列表
          </button>
        </div>
      </div>
    </div>
  )
}
