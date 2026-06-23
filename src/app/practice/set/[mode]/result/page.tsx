'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
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

interface Evaluation {
  score: number
  evaluation: string
  improvedAnswer: string
}

export default function SetResultPage() {
  const router = useRouter()
  const params = useParams()
  const mode = params.mode as string

  const [setData, setSetData] = useState<SetData | null>(null)
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({})
  const [refAnswers, setRefAnswers] = useState<Record<number, string>>({})
  const [evaluations, setEvaluations] = useState<Record<number, Evaluation>>({})
  const [totalScore, setTotalScore] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }

    // 读取套题数据
    const stored = localStorage.getItem('setTrainingData')
    const storedUserAnswers = localStorage.getItem(`setUserAnswers_${mode}`)
    const storedRefAnswers = localStorage.getItem(`setRefAnswers_${mode}`)
    const storedEvaluations = localStorage.getItem(`setEvaluations_${mode}`)

    if (stored && storedUserAnswers && storedRefAnswers) {
      try {
        const data = JSON.parse(stored)
        if (data.mode === mode) {
          setSetData(data)
          setUserAnswers(JSON.parse(storedUserAnswers))
          setRefAnswers(JSON.parse(storedRefAnswers))

          if (storedEvaluations) {
            const evals = JSON.parse(storedEvaluations) as Record<number, Evaluation>
            setEvaluations(evals)
            // 计算套题总分（平均分）
            const scores = Object.values(evals).map(e => e.score).filter(s => s > 0)
            if (scores.length > 0) {
              const avg = scores.reduce((a, b) => a + b, 0) / scores.length
              setTotalScore(Math.round(avg))
            }
          }
        } else {
          setError('套题模式不匹配')
        }
      } catch {
        setError('数据解析失败')
      }
    } else {
      setError('未找到作答数据')
    }
    setLoading(false)
  }, [mode, router])

  const handleDownload = async () => {
    if (!setData) return
    setDownloading(true)
    try {
      await downloadSetDoc(setData, userAnswers, refAnswers, evaluations)
    } catch {
      downloadSetDocHtml(setData, userAnswers, refAnswers, evaluations)
    } finally {
      setDownloading(false)
    }
  }

  const handleNewSet = () => {
    localStorage.removeItem(`setUserAnswers_${mode}`)
    localStorage.removeItem(`setRefAnswers_${mode}`)
    localStorage.removeItem(`setEvaluations_${mode}`)
    router.push('/practice')
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

  // 计算各题得分
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-amber-600'
    return 'text-red-600'
  }

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-50 border-green-200'
    if (score >= 60) return 'bg-amber-50 border-amber-200'
    return 'bg-red-50 border-red-200'
  }

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
            套题训练结果
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* 套题信息 + 总分 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-800">{setData.name}</h1>
              <p className="text-sm text-slate-500 mt-1">
                共 {setData.questions.length} 道题 · 建议作答时间 {setData.time}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {totalScore !== null && (
                <div className="text-center">
                  <div className={`text-3xl font-bold ${getScoreColor(totalScore)}`}>
                    {totalScore}
                  </div>
                  <div className="text-xs text-slate-500">套题总分</div>
                </div>
              )}
              <span className="bg-amber-100 text-amber-700 text-xs font-medium px-3 py-1 rounded-full">
                邀请用户专享
              </span>
            </div>
          </div>
          {/* 各题得分预览 */}
          {totalScore !== null && (
            <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
              {setData.questions.map((q) => {
                const eval_ = evaluations[q.index]
                return (
                  <div
                    key={q.index}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium ${eval_ ? getScoreBg(eval_.score) : 'bg-slate-50 border border-slate-200'} ${eval_ ? getScoreColor(eval_.score) : 'text-slate-500'}`}
                  >
                    第{q.index}题：{eval_ ? `${eval_.score}分` : '未评分'}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 题目+答案对照 */}
        <div className="space-y-6 mb-8">
          {setData.questions.map((q) => {
            const eval_ = evaluations[q.index]

            return (
              <div key={q.index} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="bg-primary-100 text-primary-700 text-xs font-medium px-2.5 py-1 rounded-full">
                    第{q.index}题
                  </span>
                  <span className="bg-slate-100 text-slate-600 text-xs font-medium px-2.5 py-1 rounded-full">
                    {q.typeName}
                  </span>
                  {eval_ && (
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${getScoreBg(eval_.score)} ${getScoreColor(eval_.score)}`}>
                      {eval_.score}分
                    </span>
                  )}
                </div>
                <div className="text-slate-800 leading-relaxed whitespace-pre-wrap mb-4">
                  {q.question}
                </div>

                {/* 用户答案 */}
                {userAnswers[q.index] && (
                  <div className="bg-blue-50 rounded-lg border border-blue-200 p-4 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm">📝</span>
                      <span className="font-medium text-blue-800 text-sm">你的答案</span>
                    </div>
                    <div className="text-slate-700 leading-relaxed whitespace-pre-wrap text-sm">
                      {userAnswers[q.index]}
                    </div>
                  </div>
                )}

                {/* AI批改结果 */}
                {eval_ && (
                  <div className={`rounded-lg border p-4 mb-4 ${getScoreBg(eval_.score)}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm">🤖</span>
                      <span className={`font-bold text-sm ${getScoreColor(eval_.score)}`}>AI批改 · {eval_.score}分</span>
                    </div>
                    <div className="text-slate-700 leading-relaxed whitespace-pre-wrap text-sm mb-3">
                      {eval_.evaluation}
                    </div>
                    {/* 改进版答案 */}
                    {eval_.improvedAnswer && (
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm">✨</span>
                          <span className="font-medium text-slate-700 text-sm">改进版答案</span>
                        </div>
                        <div className="text-slate-700 leading-relaxed whitespace-pre-wrap text-sm">
                          {eval_.improvedAnswer}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 参考答案 */}
                {refAnswers[q.index] && (
                  <div className="bg-green-50 rounded-lg border border-green-200 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm">✅</span>
                      <span className="font-medium text-green-800 text-sm">参考答案</span>
                    </div>
                    <div className="text-slate-700 leading-relaxed whitespace-pre-wrap text-sm">
                      {refAnswers[q.index]}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* 操作按钮 */}
        <div className="flex flex-wrap gap-3 justify-center">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-8 py-3 rounded-xl transition-colors disabled:opacity-50"
          >
            {downloading ? '下载中...' : '📥 下载Word文档'}
          </button>
          <button
            onClick={handleNewSet}
            className="bg-primary-600 hover:bg-primary-700 text-white font-medium px-8 py-3 rounded-xl transition-colors"
          >
            再来一套
          </button>
          <button
            onClick={() => router.push('/practice')}
            className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium px-8 py-3 rounded-xl transition-colors"
          >
            返回练习页
          </button>
        </div>
      </div>
    </div>
  )
}
