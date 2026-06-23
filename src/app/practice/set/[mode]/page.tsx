'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getAuthHeaders } from '@/lib/auth'
import { downloadSetDoc, downloadSetDocHtml } from '@/lib/docx-export'

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

export default function SetTrainingPage() {
  const router = useRouter()
  const params = useParams()
  const mode = params.mode as string

  const [setData, setSetData] = useState<SetData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAnswers, setShowAnswers] = useState(false)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [loadingAnswers, setLoadingAnswers] = useState(false)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }

    // 从 localStorage 读取套题数据
    const stored = localStorage.getItem('setTrainingData')
    if (stored) {
      try {
        const data = JSON.parse(stored)
        if (data.mode === mode) {
          setSetData(data)
        } else {
          setError('套题模式不匹配，请重新选择')
        }
      } catch {
        setError('数据解析失败，请重新选择套题')
      }
    } else {
      setError('未找到套题数据，请重新选择')
    }
    setLoading(false)
  }, [mode, router])

  const handleShowAnswers = async () => {
    if (!setData) return
    setLoadingAnswers(true)

    try {
      const newAnswers: Record<number, string> = {}
      for (const q of setData.questions) {
        const res = await fetch('/api/answers/generate', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ question: q.question }),
        })
        const data = await res.json()
        newAnswers[q.index] = data.answer || '生成失败'
      }
      setAnswers(newAnswers)
      setShowAnswers(true)
      // 保存到 localStorage，方便下载
      localStorage.setItem(`setRefAnswers_${mode}`, JSON.stringify(newAnswers))
      localStorage.setItem(`setUserAnswers_${mode}`, JSON.stringify({}))
    } catch {
      alert('生成答案失败')
    } finally {
      setLoadingAnswers(false)
    }
  }

  const handleSelfAnswer = () => {
    router.push(`/practice/set/${mode}/answer`)
  }

  const handleDownload = async () => {
    if (!setData) return
    setDownloading(true)
    try {
      const storedUserAnswers = localStorage.getItem(`setUserAnswers_${mode}`)
      const storedRefAnswers = localStorage.getItem(`setRefAnswers_${mode}`)
      const userAnswers = storedUserAnswers ? JSON.parse(storedUserAnswers) : {}
      const refAnswers = storedRefAnswers ? JSON.parse(storedRefAnswers) : answers
      await downloadSetDoc(setData, userAnswers, refAnswers)
    } catch {
      const storedUserAnswers = localStorage.getItem(`setUserAnswers_${mode}`)
      const storedRefAnswers = localStorage.getItem(`setRefAnswers_${mode}`)
      const userAnswers = storedUserAnswers ? JSON.parse(storedUserAnswers) : {}
      const refAnswers = storedRefAnswers ? JSON.parse(storedRefAnswers) : answers
      downloadSetDocHtml(setData, userAnswers, refAnswers)
    } finally {
      setDownloading(false)
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

  if (!setData) return null

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push('/practice')}
            className="flex items-center gap-2 text-slate-800"
          >
            <span className="text-2xl">🐻</span>
            <span className="font-bold">公考面试训练</span>
          </button>
          <div className="text-sm text-slate-500">
            套题训练
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* 套题信息 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-800">{setData.name}</h1>
              <p className="text-sm text-slate-500 mt-1">共 {setData.questions.length} 道题 · 建议作答时间 {setData.time}</p>
            </div>
            <span className="bg-amber-100 text-amber-700 text-xs font-medium px-3 py-1 rounded-full">
              邀请用户专享
            </span>
          </div>
        </div>

        {/* 题目列表 */}
        <div className="space-y-6 mb-8">
          {setData.questions.map((q) => (
            <div key={q.index} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-primary-100 text-primary-700 text-xs font-medium px-2.5 py-1 rounded-full">
                  第{q.index}题
                </span>
                <span className="bg-slate-100 text-slate-600 text-xs font-medium px-2.5 py-1 rounded-full">
                  {q.typeName}
                </span>
              </div>
              <div className="text-slate-800 leading-relaxed whitespace-pre-wrap">
                {q.question}
              </div>

              {/* 参考答案 */}
              {showAnswers && answers[q.index] && (
                <div className="mt-4 bg-green-50 rounded-lg border border-green-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">✅</span>
                    <span className="font-medium text-green-800 text-sm">参考答案</span>
                  </div>
                  <div className="text-slate-700 leading-relaxed whitespace-pre-wrap text-sm">
                    {answers[q.index]}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 生成答案中遮罩 */}
        {loadingAnswers && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 max-w-sm mx-4 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">正在生成参考答案</h3>
              <p className="text-sm text-slate-500">
                AI正在生成{setData.questions.length}道题的参考答案，预计30-60秒，请稍后...
              </p>
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex flex-wrap gap-3 justify-center">
          {!showAnswers ? (
            <>
              <button
                onClick={handleSelfAnswer}
                className="bg-primary-600 hover:bg-primary-700 text-white font-medium px-8 py-3 rounded-xl transition-colors"
              >
                📝 自己作答
              </button>
              <button
                onClick={handleShowAnswers}
                disabled={loadingAnswers}
                className="bg-green-600 hover:bg-green-700 text-white font-medium px-8 py-3 rounded-xl transition-colors disabled:opacity-50"
              >
                👀 直接查看参考答案
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleSelfAnswer}
                className="bg-primary-600 hover:bg-primary-700 text-white font-medium px-8 py-3 rounded-xl transition-colors"
              >
                📝 自己作答（对照答案）
              </button>
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-8 py-3 rounded-xl transition-colors disabled:opacity-50"
              >
                {downloading ? '下载中...' : '📥 下载Word文档'}
              </button>
              <button
                onClick={() => router.push('/practice')}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium px-8 py-3 rounded-xl transition-colors"
              >
                返回练习页
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
