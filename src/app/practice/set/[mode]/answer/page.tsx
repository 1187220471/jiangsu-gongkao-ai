'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getAuthHeaders } from '@/lib/auth'
import VoiceInput from '@/components/VoiceInput'

interface QuestionItem {
  index: number
  type: string
  typeName: string
  question: string
  topic: string
}

interface SetData {
  mode: string
  name: string
  time: string
  questions: QuestionItem[]
}

export default function SetAnswerPage() {
  const router = useRouter()
  const params = useParams()
  const mode = params.mode as string

  const [setData, setSetData] = useState<SetData | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({})
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitStep, setSubmitStep] = useState('')
  const [submitProgress, setSubmitProgress] = useState(0)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }

    const stored = localStorage.getItem('setTrainingData')
    if (stored) {
      try {
        const data = JSON.parse(stored)
        if (data.mode === mode) {
          setSetData(data)
          // 恢复已保存的答案
          const savedAnswers = localStorage.getItem(`setAnswers_${mode}`)
          if (savedAnswers) {
            const parsed = JSON.parse(savedAnswers)
            setUserAnswers(parsed)
            // 找到第一个未答的题
            const answeredIndices = Object.keys(parsed).map(Number)
            const firstUnanswered = data.questions.findIndex(
              (q: QuestionItem) => !answeredIndices.includes(q.index)
            )
            setCurrentIndex(firstUnanswered >= 0 ? firstUnanswered : data.questions.length - 1)
            if (firstUnanswered < 0 && answeredIndices.length > 0) {
              setCurrentAnswer(parsed[data.questions[data.questions.length - 1].index] || '')
            }
          }
        } else {
          setError('套题模式不匹配')
        }
      } catch {
        setError('数据解析失败')
      }
    } else {
      setError('未找到套题数据')
    }
    setLoading(false)
  }, [mode, router])

  const currentQuestion = setData?.questions[currentIndex]

  const handleSaveAnswer = () => {
    if (!currentQuestion) return
    const newAnswers = { ...userAnswers, [currentQuestion.index]: currentAnswer }
    setUserAnswers(newAnswers)
    localStorage.setItem(`setAnswers_${mode}`, JSON.stringify(newAnswers))
  }

  const handleNext = () => {
    handleSaveAnswer()
    if (setData && currentIndex < setData.questions.length - 1) {
      const nextIndex = currentIndex + 1
      setCurrentIndex(nextIndex)
      setCurrentAnswer(userAnswers[setData.questions[nextIndex].index] || '')
    }
  }

  const handlePrev = () => {
    handleSaveAnswer()
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1
      setCurrentIndex(prevIndex)
      if (setData) {
        setCurrentAnswer(userAnswers[setData.questions[prevIndex].index] || '')
      }
    }
  }

  const handleSubmit = async () => {
    handleSaveAnswer()
    if (!setData) return

    // 检查是否全部作答
    const answeredCount = Object.keys(userAnswers).length
    if (answeredCount < setData.questions.length) {
      const confirmed = window.confirm(`您只完成了 ${answeredCount}/${setData.questions.length} 道题，确定要提交吗？`)
      if (!confirmed) return
    }

    setSubmitting(true)

    try {
      // 生成参考答案
      setSubmitStep('正在生成参考答案...')
      const refAnswers: Record<number, string> = {}
      for (const q of setData.questions) {
        const res = await fetch('/api/answers/generate', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ question: q.question }),
        })
        const data = await res.json()
        refAnswers[q.index] = data.answer || '生成失败'
      }

      // 逐题调用AI批改
      const evaluations: Record<number, { score: number; evaluation: string; improvedAnswer: string }> = {}
      for (let i = 0; i < setData.questions.length; i++) {
        const q = setData.questions[i]
        setSubmitStep(`正在评分第${i + 1}/${setData.questions.length}题...`)
        setSubmitProgress(i + 1)
        const userAnswer = userAnswers[q.index]
        if (userAnswer) {
          try {
            const evalRes = await fetch('/api/evaluate', {
              method: 'POST',
              headers: getAuthHeaders(),
              body: JSON.stringify({
                question: q.question,
                referenceAnswer: refAnswers[q.index],
                userAnswer: userAnswer,
                type: q.type,
              }),
            })
            const evalData = await evalRes.json()
            evaluations[q.index] = {
              score: evalData.score || 0,
              evaluation: evalData.evaluation || '批改生成中...',
              improvedAnswer: evalData.improvedAnswer || '',
            }
          } catch {
            evaluations[q.index] = {
              score: 0,
              evaluation: '批改失败',
              improvedAnswer: '',
            }
          }
        }
      }

      // 保存到 localStorage，跳转到结果页
      localStorage.setItem(`setRefAnswers_${mode}`, JSON.stringify(refAnswers))
      localStorage.setItem(`setUserAnswers_${mode}`, JSON.stringify(userAnswers))
      localStorage.setItem(`setEvaluations_${mode}`, JSON.stringify(evaluations))
      router.push(`/practice/set/${mode}/result`)
    } catch {
      alert('提交失败，请稍后重试')
    } finally {
      setSubmitting(false)
      setSubmitStep('')
      setSubmitProgress(0)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-3"></div>
          <p className="text-slate-500">加载中...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => router.push('/practice')}
            className="bg-primary-600 hover:bg-primary-700 text-white font-medium px-6 py-2.5 rounded-xl transition-colors"
          >
            返回练习页
          </button>
        </div>
      </div>
    )
  }

  if (!setData || !currentQuestion) return null

  const progress = ((currentIndex + 1) / setData.questions.length) * 100
  const answeredCount = Object.keys(userAnswers).length

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 提交中全屏遮罩 */}
      {submitting && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-sm mx-4 text-center shadow-2xl">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600 mx-auto mb-5"></div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">AI正在评分和生成修改版答案</h3>
            <p className="text-sm text-slate-500 mb-4">
              {submitStep}
            </p>
            {submitProgress > 0 && setData && (
              <div className="w-full bg-slate-100 rounded-full h-2 mb-2">
                <div
                  className="bg-primary-600 h-2 rounded-full transition-all"
                  style={{ width: `${(submitProgress / setData.questions.length) * 100}%` }}
                ></div>
              </div>
            )}
            <p className="text-xs text-slate-400 mt-3">预计1-2分钟，请耐心等待</p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push('/practice')}
            className="flex items-center gap-2 text-slate-800"
          >
            <span className="text-2xl">🐻</span>
            <span className="font-bold">江苏公务员面试答题训练</span>
          </button>
          <div className="text-sm text-slate-500">
            套题作答 {currentIndex + 1}/{setData.questions.length}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* 进度条 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">作答进度</span>
            <span className="text-sm text-slate-500">{answeredCount}/{setData.questions.length} 题已答</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        {/* 题目导航 */}
        <div className="flex gap-2 mb-6 justify-center">
          {setData.questions.map((q, idx) => (
            <button
              key={q.index}
              onClick={() => {
                handleSaveAnswer()
                setCurrentIndex(idx)
                setCurrentAnswer(userAnswers[q.index] || '')
              }}
              className={`w-10 h-10 rounded-lg font-medium text-sm transition-colors ${
                idx === currentIndex
                  ? 'bg-primary-600 text-white'
                  : userAnswers[q.index]
                  ? 'bg-green-100 text-green-700'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {q.index}
            </button>
          ))}
        </div>

        {/* 当前题目 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-primary-100 text-primary-700 text-xs font-medium px-2.5 py-1 rounded-full">
              第{currentQuestion.index}题
            </span>
            <span className="bg-slate-100 text-slate-600 text-xs font-medium px-2.5 py-1 rounded-full">
              {currentQuestion.typeName}
            </span>
          </div>
          <div className="text-slate-800 leading-relaxed whitespace-pre-wrap mb-6">
            {currentQuestion.question}
          </div>

          {/* 答题区 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block font-medium text-slate-700">
                你的答案
              </label>
              <VoiceInput
                onTranscript={(text) => setCurrentAnswer((prev) => prev + text)}
                disabled={submitting}
              />
            </div>
            <textarea
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              className="w-full h-64 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none text-slate-700 leading-relaxed"
              placeholder="请在此输入你的面试答案，或点击右上角语音答题..."
            />
            <div className="text-right text-sm text-slate-400 mt-2">
              {currentAnswer.length} 字
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex flex-wrap gap-3 justify-center">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium px-6 py-2.5 rounded-xl transition-colors disabled:opacity-50"
          >
            ← 上一题
          </button>
          {currentIndex < setData.questions.length - 1 ? (
            <button
              onClick={handleNext}
              className="bg-primary-600 hover:bg-primary-700 text-white font-medium px-6 py-2.5 rounded-xl transition-colors"
            >
              下一题 →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-2.5 rounded-xl transition-colors disabled:opacity-50"
            >
              {submitting ? '提交中...' : '✅ 提交并查看结果'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
