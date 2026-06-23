'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getAuthHeaders } from '@/lib/auth'
import IndentedText from '@/components/IndentedText'
import ImageUploader from '@/components/ImageUploader'

interface Material {
  materialNum: string
  content: string
}

interface TeacherAnswer {
  teacherName: string
  answerText: string
}

interface ShenlunDetail {
  id: number
  examTitle: string
  examYear: number
  examDate: string
  examCategory: string
  questionNumber: number
  questionText: string
  questionType: string
  score: number | null
  wordLimit: string | null
  materialRange: string | null
  referenceAnswer: string | null
  materials: Material[]
  answers: TeacherAnswer[]
}

interface SiblingItem {
  id: number
  questionNumber: number
  questionType: string
}

interface EvaluationResult {
  score: number
  dimensionScores: Record<string, number>
  evaluation: string
  sentenceComments: { sentence: string; comment: string }[]
  improvedAnswer: string
  isInvited: boolean
  recordId: number
  cost: number
}

const PROFICIENCY_OPTIONS = [
  { value: 'weak', label: '生疏', emoji: '😰', color: 'border-red-300 bg-red-50 text-red-700' },
  { value: 'okay', label: '一般', emoji: '🙂', color: 'border-yellow-300 bg-yellow-50 text-yellow-700' },
  { value: 'mastered', label: '熟练', emoji: '😎', color: 'border-green-300 bg-green-50 text-green-700' },
]

function countChars(text: string): number {
  return (text || '').replace(/\s/g, '').length
}

export default function ShenlunDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = parseInt(params.id as string)

  const [question, setQuestion] = useState<ShenlunDetail | null>(null)
  const [siblings, setSiblings] = useState<SiblingItem[]>([])
  const [bookmark, setBookmark] = useState<{ proficiency: string; notes: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeAnswerIndex, setActiveAnswerIndex] = useState(0)
  const [expandedMaterials, setExpandedMaterials] = useState(true)
  const [expandedAnswer, setExpandedAnswer] = useState(false)
  const [bookmarkLoading, setBookmarkLoading] = useState(false)
  const [notesInput, setNotesInput] = useState('')
  const [showNotes, setShowNotes] = useState(false)
  const [userAnswer, setUserAnswer] = useState('')
  const [expandedAnswerInput, setExpandedAnswerInput] = useState(false)
  const [evaluating, setEvaluating] = useState(false)
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null)
  const [evaluationError, setEvaluationError] = useState('')
  const [showReferenceAnswer, setShowReferenceAnswer] = useState(false)
  const hasAiReferenceAnswer = question?.answers.some(a => a.teacherName === 'AI参考答案')

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { router.push('/login'); return }
    fetchDetail()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router])

  const fetchDetail = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/shenlun/detail/${id}`, {
        headers: getAuthHeaders(),
      })
      if (res.status === 401) { router.push('/login'); return }
      const data = await res.json()
      setQuestion(data.question)
      setSiblings(data.siblings || [])
      setBookmark(data.bookmark)
      setNotesInput(data.bookmark?.notes || '')
      setActiveAnswerIndex(0)
      setExpandedMaterials(true)
      setExpandedAnswer(false)
    } catch (err) {
      console.error('获取申论题目详情失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleBookmark = async (proficiency: string) => {
    if (bookmarkLoading) return
    setBookmarkLoading(true)
    try {
      if (bookmark?.proficiency === proficiency) {
        await fetch(`/api/shenlun/bookmark?questionId=${id}`, {
          method: 'DELETE',
          headers: getAuthHeaders(),
        })
        setBookmark(null)
      } else {
        const res = await fetch('/api/shenlun/bookmark', {
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
      const res = await fetch('/api/shenlun/bookmark', {
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
    router.push(`/shenlun/${sibId}`)
  }

  const handleEvaluate = async () => {
    if (!userAnswer.trim()) return
    setEvaluating(true)
    setEvaluationError('')
    try {
      const res = await fetch('/api/shenlun/evaluate', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ questionId: id, userAnswer }),
      })
      if (res.status === 401) {
        router.push('/login')
        return
      }
      const data = await res.json()
      if (!res.ok) {
        setEvaluationError(data.error || '批改失败')
        return
      }
      setEvaluationResult(data)
    } catch (err) {
      console.error('申论批改失败:', err)
      setEvaluationError('网络异常，请稍后重试')
    } finally {
      setEvaluating(false)
    }
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
          <button onClick={() => router.push('/shenlun')} className="mt-4 text-primary-600 text-sm hover:underline">
            返回列表
          </button>
        </div>
      </div>
    )
  }

  const currentAnswer = question.answers[activeAnswerIndex]
  const answerChars = currentAnswer ? countChars(currentAnswer.answerText) : 0

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/shenlun')}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-primary-600 transition-colors"
            >
              <span>←</span>
              <span>申论真题</span>
            </button>
            <div className="w-px h-4 bg-slate-200" />
            <button
              onClick={() => router.push('/shenlun')}
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
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                {question.examCategory}卷
              </span>
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
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 text-sm font-bold flex items-center justify-center">
              {question.questionNumber}
            </span>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
              {question.questionType}
            </span>
            {question.score && (
              <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">
                {question.score}分
              </span>
            )}
            {question.wordLimit && (
              <span className="text-xs text-slate-500">{question.wordLimit}</span>
            )}
            {question.materialRange && (
              <span className="text-xs text-slate-500">{question.materialRange}</span>
            )}
          </div>
          <p className="text-slate-800 leading-relaxed text-base">
            {question.questionText}
          </p>
        </div>

        {/* 材料原文 */}
        {question.materials.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <button
              onClick={() => setExpandedMaterials(!expandedMaterials)}
              className="w-full px-5 py-3 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <span className="text-sm font-medium text-slate-700">
                📄 给定材料（{question.materials.length} 则）
              </span>
              <span className="text-slate-400 text-sm transition-transform" style={{ transform: expandedMaterials ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                ⌄
              </span>
            </button>
            {expandedMaterials && (
              <div className="divide-y divide-slate-100">
                {question.materials.map((m) => (
                  <div key={m.materialNum} className="px-5 py-4">
                    <div className="text-xs font-medium text-slate-500 mb-2">
                      给定资料 {m.materialNum}
                    </div>
                    <IndentedText
                      text={m.content}
                      className="text-sm text-slate-700 leading-relaxed"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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

        {/* 我的作答 */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <button
            onClick={() => setExpandedAnswerInput(!expandedAnswerInput)}
            className="w-full px-5 py-3 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors"
          >
            <span className="text-sm font-medium text-slate-700">✏️ 我的作答</span>
            <span className="text-slate-400 text-sm transition-transform" style={{ transform: expandedAnswerInput ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              ⌄
            </span>
          </button>

          {expandedAnswerInput && (
            <div className="p-5 space-y-4">
              <textarea
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder={`请输入你的答案...\n建议字数：${question.wordLimit || '按题干要求'}`}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary-400"
                rows={8}
              />
              <div className="flex items-center justify-between">
                <ImageUploader
                  onRecognized={(text) => {
                    setUserAnswer(text)
                    setExpandedAnswerInput(true)
                  }}
                  disabled={evaluating}
                />
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">
                    已输入 {countChars(userAnswer)} 字
                  </span>
                  <button
                    onClick={handleEvaluate}
                    disabled={evaluating || !userAnswer.trim()}
                    className="text-sm bg-primary-600 text-white px-5 py-2 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {evaluating ? (
                      <>
                        <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                        批改中...
                      </>
                    ) : (
                      <>
                        AI 批改
                        {evaluationResult?.isInvited ? (
                          <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded">邀请用户</span>
                        ) : (
                          <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded">{question.questionType === '大作文' ? '2点' : '1点'}</span>
                        )}
                      </>
                    )}
                  </button>
                </div>
              </div>

              {evaluating && (
                <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-600 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-500"></span>
                    <span className="font-medium text-primary-700">正在阅卷...</span>
                  </div>
                  <div className="text-xs text-slate-500">正在识别题型 → 提取材料要点 → 对比用户答案 → 生成评语</div>
                </div>
              )}

              {evaluationError && (
                <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3">
                  {evaluationError}
                </div>
              )}

              {evaluationResult && (
                <div className="space-y-4 pt-2">
                  {/* 总分 */}
                  <div className="flex items-center gap-4 bg-primary-50 rounded-xl p-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-primary-700">{evaluationResult.score}</div>
                      <div className="text-xs text-primary-600">/ {question.score || 20} 分</div>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-700 mb-2">各维度得分</div>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(evaluationResult.dimensionScores).map(([dim, score]) => (
                          <div key={dim} className="flex items-center justify-between text-xs bg-white rounded px-2 py-1">
                            <span className="text-slate-600">{dim}</span>
                            <span className="font-medium text-primary-700">{score}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 逐句批改 */}
                  {evaluationResult.sentenceComments.length > 0 && (
                    <div>
                      <div className="text-sm font-medium text-slate-700 mb-2">📝 逐句批改</div>
                      <div className="space-y-2">
                        {evaluationResult.sentenceComments.slice(0, 6).map((item, idx) => (
                          <div key={idx} className="text-xs bg-slate-50 rounded-lg p-3">
                            <div className="text-slate-700 mb-1">「{item.sentence}」</div>
                            <div className="text-primary-700">{item.comment}</div>
                          </div>
                        ))}
                        {evaluationResult.sentenceComments.length > 6 && (
                          <div className="text-xs text-slate-400 text-center">还有 {evaluationResult.sentenceComments.length - 6} 条逐句点评</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 点评 */}
                  <div>
                    <div className="text-sm font-medium text-slate-700 mb-2">💡 综合点评</div>
                    <IndentedText
                      text={evaluationResult.evaluation}
                      className="text-xs text-slate-600 bg-slate-50 rounded-lg p-3"
                    />
                  </div>

                  {/* 参考答案提示 */}
                  {hasAiReferenceAnswer && (
                    <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
                      📖 参考答案已放在下方「名师答案」Tab 中，切换至「AI参考答案」可对照学习。
                    </div>
                  )}

                  {/* 改进版答案 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium text-slate-700">✨ 改进版答案</div>
                      <button
                        onClick={() => navigator.clipboard.writeText(evaluationResult.improvedAnswer)}
                        className="text-xs text-primary-600 hover:text-primary-700"
                      >
                        复制
                      </button>
                    </div>
                    <IndentedText
                      text={evaluationResult.improvedAnswer}
                      className="text-xs text-slate-700 bg-green-50 rounded-lg p-3 leading-relaxed"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 答案区域 */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Tab 头 */}
          <div className="flex border-b border-slate-200 overflow-x-auto">
            {question.answers.map((ans, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setActiveAnswerIndex(idx)
                  setExpandedAnswer(false)
                }}
                className={`flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeAnswerIndex === idx
                    ? ans.teacherName === 'AI参考答案'
                      ? 'text-amber-700 border-b-2 border-amber-500 bg-amber-50'
                      : 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
                    : ans.teacherName === 'AI参考答案'
                      ? 'text-amber-600 hover:text-amber-700'
                      : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {ans.teacherName === 'AI参考答案' ? (
                  <span className="flex items-center gap-1">
                    <span className="text-sm">✨</span>
                    {ans.teacherName}
                  </span>
                ) : (
                  ans.teacherName
                )}
              </button>
            ))}
          </div>

          {/* 答案内容 */}
          {currentAnswer && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {currentAnswer.teacherName === 'AI参考答案' ? (
                    <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-full px-3 py-1">
                      <span className="text-sm">✨</span>
                      <span className="text-sm font-bold text-amber-700">AI参考答案</span>
                      <span className="text-[10px] bg-amber-500 text-white rounded-full px-1.5 py-0.5 font-medium">推荐</span>
                    </span>
                  ) : (
                    <span className="text-sm font-bold text-slate-800">{currentAnswer.teacherName} 参考答案</span>
                  )}
                  <span className="text-xs text-slate-400">（{answerChars} 字）</span>
                </div>
                <button
                  onClick={() => setExpandedAnswer(!expandedAnswer)}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                >
                  {expandedAnswer ? '收起' : '展开全文'}
                </button>
              </div>
              <IndentedText
                text={currentAnswer.answerText}
                className={`text-slate-700 leading-loose text-sm ${
                  expandedAnswer ? '' : 'line-clamp-[12]'
                }`}
              />
              {!expandedAnswer && answerChars > 400 && (
                <div className="mt-4 text-center">
                  <button
                    onClick={() => setExpandedAnswer(true)}
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                  >
                    展开全文
                  </button>
                </div>
              )}
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
            onClick={() => router.push('/shenlun')}
            className="text-sm text-slate-400 hover:text-primary-600 transition-colors"
          >
            ← 返回申论列表
          </button>
        </div>
      </div>
    </div>
  )
}
