'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import PaperMaterialPanel from '@/components/shenlun/PaperMaterialPanel'
import PaperQuestionCard, { type PaperQuestion } from '@/components/shenlun/PaperQuestionCard'
import GenerationBar from '@/components/shenlun/GenerationBar'
import { getAuthHeaders } from '@/lib/auth'
import { SHENLUN_QUESTION_TYPES } from '@/lib/shenlunTypes'

interface PaperDetail {
  id: string
  title: string
  examYear: number | null
  examCategory: string | null
  pageCount: number
  extractMode: string
  materialsText: string
  splitWarnings: string[]
  createdAt: string
}

const COST_PER_QUESTION = 0.5

export default function ShenlunPaperDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const paperId = params.id

  const [paper, setPaper] = useState<PaperDetail | null>(null)
  const [questions, setQuestions] = useState<PaperQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [running, setRunning] = useState(false)
  const [currentLabel, setCurrentLabel] = useState('')
  const [done, setDone] = useState(0)
  const [failed, setFailed] = useState(0)
  const [blockedMessage, setBlockedMessage] = useState('')
  const [remainingFree, setRemainingFree] = useState<number | null>(null)
  const stopRef = useRef(false)

  const [adding, setAdding] = useState(false)
  const [newText, setNewText] = useState('')
  const [newType, setNewType] = useState('其他')
  const [newScore, setNewScore] = useState('')
  const [newLimit, setNewLimit] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/shenlun/papers/${paperId}`, { headers: getAuthHeaders() })
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (res.status === 404) {
        setError('试卷不存在或无权访问')
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || '加载失败')
      setPaper(data.paper)
      setQuestions(data.questions || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [paperId, router])

  useEffect(() => {
    load()
  }, [load])

  const updateQuestion = (question: PaperQuestion) => {
    setQuestions((prev) => prev.map((q) => (q.id === question.id ? { ...q, ...question } : q)))
  }

  const requestAnswer = async (question: PaperQuestion, regenerate: boolean) => {
    const res = await fetch(
      `/api/shenlun/papers/${paperId}/questions/${question.id}/answer`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ regenerate }),
      }
    )

    if (res.status === 401) {
      router.push('/login')
      return { status: 'auth' as const }
    }
    if (res.status === 403) {
      const data = await res.json().catch(() => ({}))
      return { status: 'blocked' as const, message: data?.error || '今日额度已用完' }
    }

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { status: 'failed' as const, message: data?.error || '生成失败' }
    }

    if (data.quota?.remainingFree !== undefined) {
      setRemainingFree(data.quota.remainingFree)
    }

    return { status: 'ok' as const, data }
  }

  const generateOne = async (question: PaperQuestion, regenerate: boolean) => {
    stopRef.current = false
    setRunning(true)
    setBlockedMessage('')
    setCurrentLabel(`正在生成第 ${question.questionNumber} 题（${question.questionType}）…`)

    try {
      const result = await requestAnswer(question, regenerate)
      if (result.status === 'ok') {
        updateQuestion({
          ...question,
          answerText: result.data.answer.answerText,
          answerCharCount: result.data.answer.answerCharCount,
          answerStatus: 'ready',
          answerError: null,
          generatedAt: result.data.answer.generatedAt,
        })
      } else if (result.status === 'blocked') {
        setBlockedMessage(result.message)
      } else if (result.status === 'failed') {
        updateQuestion({ ...question, answerStatus: 'failed', answerError: result.message })
      }
    } finally {
      setRunning(false)
      setCurrentLabel('')
    }
  }

  const generateAll = async () => {
    const pending = questions.filter((q) => !(q.answerStatus === 'ready' && q.answerText))
    if (pending.length === 0 || running) return

    const estimated = (pending.length * COST_PER_QUESTION).toFixed(1)
    const confirmed = window.confirm(
      `将依次生成 ${pending.length} 题，预计消耗 ${estimated} 点，是否继续？`
    )
    if (!confirmed) return

    stopRef.current = false
    setRunning(true)
    setBlockedMessage('')
    setDone(0)
    setFailed(0)

    let successCount = 0
    let failCount = 0

    for (const question of pending) {
      if (stopRef.current) break

      setCurrentLabel(
        `正在生成第 ${question.questionNumber} 题（${question.questionType}）…`
      )
      const result = await requestAnswer(question, false)

      if (result.status === 'auth') return

      if (result.status === 'blocked') {
        setBlockedMessage(
          `今日额度已用完，已完成 ${successCount}/${pending.length} 题，进度已保存，明日可继续`
        )
        break
      }

      if (result.status === 'ok') {
        successCount += 1
        updateQuestion({
          ...question,
          answerText: result.data.answer.answerText,
          answerCharCount: result.data.answer.answerCharCount,
          answerStatus: 'ready',
          answerError: null,
          generatedAt: result.data.answer.generatedAt,
        })
      } else {
        failCount += 1
        updateQuestion({ ...question, answerStatus: 'failed', answerError: result.message })
      }

      setDone(successCount)
      setFailed(failCount)
    }

    setRunning(false)
    setCurrentLabel('')
    if (failCount > 0) {
      setBlockedMessage(`有 ${failCount} 题生成失败，已退回额度，可单独重试`)
    }
  }

  const handleSave = async (
    question: PaperQuestion,
    patch: { questionText: string; questionType: string; score: number | null; wordLimit: string | null }
  ) => {
    const res = await fetch(`/api/shenlun/papers/${paperId}/questions/${question.id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(patch),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert(data?.error || '保存失败')
      return
    }
    updateQuestion(data.question)
  }

  const handleDelete = async (question: PaperQuestion) => {
    const ok = window.confirm(`删除第 ${question.questionNumber} 题？`)
    if (!ok) return
    const res = await fetch(`/api/shenlun/papers/${paperId}/questions/${question.id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data?.error || '删除失败')
      return
    }
    setQuestions((prev) => prev.filter((q) => q.id !== question.id))
  }

  const handleAdd = async () => {
    if (!newText.trim()) return
    const res = await fetch(`/api/shenlun/papers/${paperId}/questions`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        questionText: newText.trim(),
        questionType: newType,
        score: newScore ? Number(newScore) : undefined,
        wordLimit: newLimit.trim() || undefined,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert(data?.error || '添加失败')
      return
    }
    setQuestions((prev) => [...prev, data.question])
    setNewText('')
    setNewScore('')
    setNewLimit('')
    setNewType('其他')
    setAdding(false)
  }

  const readyCount = questions.filter((q) => q.answerStatus === 'ready' && q.answerText).length
  const pendingCount = questions.length - readyCount
  const estimatedCost = Number((pendingCount * COST_PER_QUESTION).toFixed(1))

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className="inline-block w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          加载试卷…
        </div>
      </div>
    )
  }

  if (error || !paper) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <p className="text-sm text-red-600 mb-4">{error || '试卷不存在'}</p>
          <button
            onClick={() => router.push('/shenlun/mine')}
            className="text-sm px-4 py-2 rounded-lg bg-slate-900 text-white"
          >
            返回我的试卷
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <button
            onClick={() => router.push('/shenlun/mine')}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-primary-600 shrink-0"
          >
            <span>←</span>
            <span>我的试卷</span>
          </button>
          <div className="min-w-0 text-center">
            <h1 className="text-sm font-bold text-slate-800 truncate">{paper.title}</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {paper.examYear ? `${paper.examYear} 年` : ''}
              {paper.examCategory ? ` · ${paper.examCategory} 卷` : ''}
              {` · ${paper.pageCount} 页`}
            </p>
          </div>
          <div className="text-[11px] text-slate-400 shrink-0">
            {paper.extractMode === 'ocr' ? 'OCR' : '文本'}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-5">
        <GenerationBar
          total={questions.length}
          ready={readyCount}
          running={running}
          done={done}
          failed={failed}
          currentLabel={currentLabel}
          estimatedCost={estimatedCost}
          remainingFree={remainingFree}
          blockedMessage={blockedMessage}
          onStart={generateAll}
          onStop={() => {
            stopRef.current = true
          }}
        />

        {paper.splitWarnings?.length ? (
          <ul className="mb-4 text-xs text-amber-600 space-y-1">
            {paper.splitWarnings.map((w, idx) => (
              <li key={idx}>· {w}</li>
            ))}
          </ul>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-2">
            <div className="lg:sticky lg:top-20">
              <PaperMaterialPanel text={paper.materialsText} />
            </div>
          </div>

          <div className="lg:col-span-3 space-y-4">
            {questions.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                <p className="text-sm text-slate-600 mb-1">这份试卷还没有题目</p>
                <p className="text-xs text-slate-400 mb-4">
                  可能是原文题号格式未被识别，可手动添加
                </p>
              </div>
            ) : (
              questions.map((question) => (
                <PaperQuestionCard
                  key={question.id}
                  question={question}
                  generating={running && currentLabel.includes(`第 ${question.questionNumber} 题`)}
                  onGenerate={(q) => generateOne(q, q.answerStatus === 'ready')}
                  onDelete={handleDelete}
                  onSave={handleSave}
                />
              ))
            )}

            {adding ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-800 mb-2">手动添加题目</h3>
                <textarea
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  rows={4}
                  placeholder="粘贴题干原文"
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
                  >
                    {SHENLUN_QUESTION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <input
                    value={newScore}
                    onChange={(e) => setNewScore(e.target.value.replace(/[^\d]/g, ''))}
                    placeholder="分值"
                    className="w-20 text-sm border border-slate-200 rounded-lg px-3 py-2"
                  />
                  <input
                    value={newLimit}
                    onChange={(e) => setNewLimit(e.target.value)}
                    placeholder="字数要求"
                    className="flex-1 min-w-[140px] text-sm border border-slate-200 rounded-lg px-3 py-2"
                  />
                  <button
                    onClick={handleAdd}
                    className="text-sm px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700"
                  >
                    添加
                  </button>
                  <button
                    onClick={() => setAdding(false)}
                    className="text-sm px-3 py-2 rounded-lg border border-slate-200 text-slate-500"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAdding(true)}
                className="w-full py-3 rounded-2xl border border-dashed border-slate-300 text-sm text-slate-500 hover:border-primary-400 hover:text-primary-600"
              >
                ＋ 手动添加题目
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
