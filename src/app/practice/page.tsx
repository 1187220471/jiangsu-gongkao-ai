'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { QUESTION_TYPE_LABELS } from '@/types'

const questionTypes = [
  { key: 'social', label: '社会现象类' },
  { key: 'attitude', label: '态度观点类' },
  { key: 'organize', label: '组织管理类' },
  { key: 'emergency', label: '应急应变类' },
  { key: 'relationship', label: '人际关系类' },
  { key: 'self', label: '自我认知类' },
  { key: 'situational', label: '情景模拟类' },
] as const

export default function Practice() {
  const router = useRouter()
  const [selectedType, setSelectedType] = useState<string>('')
  const [question, setQuestion] = useState('')
  const [referenceAnswer, setReferenceAnswer] = useState('')
  const [userAnswer, setUserAnswer] = useState('')
  const [evaluation, setEvaluation] = useState('')
  const [improvedAnswer, setImprovedAnswer] = useState('')
  const [score, setScore] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'select' | 'question' | 'answer' | 'result'>('select')

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
    }
  }, [router])

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token')
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }
  }

  const handleGenerateQuestion = async () => {
    if (!selectedType) {
      alert('请先选择题型')
      return
    }

    setLoading(true)
    setQuestion('')
    setReferenceAnswer('')
    setUserAnswer('')
    setEvaluation('')
    setImprovedAnswer('')
    setScore(null)

    try {
      const res = await fetch('/api/questions/generate', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ type: selectedType }),
      })

      const data = await res.json()
      if (data.question) {
        setQuestion(data.question)
        setStep('question')
      } else {
        alert(data.error || '生成题目失败')
      }
    } catch {
      alert('网络错误')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateAnswer = async () => {
    if (!question) return

    setLoading(true)
    try {
      const res = await fetch('/api/answers/generate', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ question }),
      })

      const data = await res.json()
      if (data.answer) {
        setReferenceAnswer(data.answer)
      } else {
        alert(data.error || '生成答案失败')
      }
    } catch {
      alert('网络错误')
    } finally {
      setLoading(false)
    }
  }

  const handleEvaluate = async () => {
    if (!userAnswer.trim()) {
      alert('请先输入你的答案')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          question,
          referenceAnswer,
          userAnswer,
          type: selectedType,
        }),
      })

      const data = await res.json()
      if (data.evaluation) {
        setEvaluation(data.evaluation)
        setScore(data.score)
        setImprovedAnswer(data.improvedAnswer || '')
        // 如果后端同时返回了参考答案，自动设置（不额外消耗次数）
        if (data.referenceAnswer) {
          setReferenceAnswer(data.referenceAnswer)
        }
        setStep('result')
      } else {
        alert(data.error || '批改失败')
      }
    } catch {
      alert('网络错误')
    } finally {
      setLoading(false)
    }
  }

  const handleNewQuestion = () => {
    setStep('select')
    setQuestion('')
    setReferenceAnswer('')
    setUserAnswer('')
    setEvaluation('')
    setImprovedAnswer('')
    setScore(null)
    setSelectedType('')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-slate-800"
          >
            <span className="text-2xl">🐻</span>
            <span className="font-bold">江苏公务员面试答题训练</span>
          </button>
          <div className="text-sm text-slate-500">
            {step === 'select' && '选择题型'}
            {step === 'question' && '查看题目'}
            {step === 'answer' && '答题练习'}
            {step === 'result' && '批改结果'}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Step 1: Select Type */}
        {step === 'select' && (
          <div>
            <h2 className="text-xl font-bold text-slate-800 mb-6 text-center">
              选择面试题型
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              {questionTypes.map((type) => (
                <button
                  key={type.key}
                  onClick={() => setSelectedType(type.key)}
                  className={`p-6 rounded-xl border-2 transition-all text-center ${
                    selectedType === type.key
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-primary-300'
                  }`}
                >
                  <div className="text-2xl mb-2">
                    {type.key === 'social' && '🔍'}
                    {type.key === 'attitude' && '💭'}
                    {type.key === 'organize' && '📋'}
                    {type.key === 'emergency' && '🚨'}
                    {type.key === 'relationship' && '🤝'}
                    {type.key === 'self' && '👤'}
                    {type.key === 'situational' && '🎭'}
                  </div>
                  <div className="font-medium">{type.label}</div>
                </button>
              ))}
            </div>
            <div className="text-center">
              <button
                onClick={handleGenerateQuestion}
                disabled={loading || !selectedType}
                className="bg-primary-600 hover:bg-primary-700 text-white font-medium px-8 py-3 rounded-xl transition-colors disabled:opacity-50"
              >
                {loading ? '生成中...' : '随机出题'}
              </button>
            </div>
          </div>
        )}

        {/* Step 2-4: Question / Answer / Result */}
        {(step === 'question' || step === 'answer' || step === 'result') && (
          <div>
            {/* Question Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-primary-100 text-primary-700 text-xs font-medium px-2.5 py-1 rounded-full">
                  {QUESTION_TYPE_LABELS[selectedType as keyof typeof QUESTION_TYPE_LABELS]}
                </span>
                <span className="text-xs text-slate-400">AI生成</span>
              </div>
              <div className="text-slate-800 leading-relaxed whitespace-pre-wrap">
                {question}
              </div>
            </div>

            {/* Reference Answer (when user chooses to view it) */}
            {referenceAnswer && (
              <div className="bg-green-50 rounded-xl border border-green-200 p-6 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">✅</span>
                  <h3 className="font-bold text-green-800">参考答案</h3>
                </div>
                <div className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {referenceAnswer}
                </div>
              </div>
            )}

            {/* User Answer Input */}
            {step === 'answer' && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                <h3 className="font-bold text-slate-800 mb-3">你的答案</h3>
                <textarea
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  className="w-full h-64 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none text-slate-700 leading-relaxed"
                  placeholder="请在此输入你的面试答案..."
                />
                <div className="text-right text-sm text-slate-400 mt-2">
                  {userAnswer.length} 字
                </div>
              </div>
            )}

            {/* Evaluation Result */}
            {step === 'result' && (
              <>
                {/* Score Card */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">📊</span>
                      <h3 className="font-bold text-slate-800">AI批改结果</h3>
                    </div>
                    {score !== null && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500">得分：</span>
                        <span
                          className={`text-2xl font-bold ${
                            score >= 80
                              ? 'text-green-600'
                              : score >= 60
                              ? 'text-yellow-600'
                              : 'text-red-600'
                          }`}
                        >
                          {score}
                        </span>
                        <span className="text-slate-400">/100</span>
                      </div>
                    )}
                  </div>
                  <div className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {evaluation}
                  </div>
                </div>

                {/* Improved Answer */}
                {improvedAnswer && (
                  <div className="bg-blue-50 rounded-xl border border-blue-200 p-6 mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-lg">✨</span>
                      <h3 className="font-bold text-blue-800">改进版答案（基于你的答案优化）</h3>
                    </div>
                    <div className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {improvedAnswer}
                    </div>
                  </div>
                )}

                {/* User Original Answer */}
                {userAnswer && (
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 mb-6">
                    <h3 className="font-bold text-slate-700 mb-3">你的原始答案</h3>
                    <div className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                      {userAnswer}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 justify-center">
              {/* Question step: two main buttons */}
              {step === 'question' && (
                <>
                  <button
                    onClick={() => setStep('answer')}
                    className="bg-primary-600 hover:bg-primary-700 text-white font-medium px-6 py-2.5 rounded-xl transition-colors"
                  >
                    📝 先自己作答
                  </button>
                  <button
                    onClick={handleGenerateAnswer}
                    disabled={loading}
                    className="bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-2.5 rounded-xl transition-colors disabled:opacity-50"
                  >
                    {loading ? '生成中...' : '👀 直接查看参考答案'}
                  </button>
                </>
              )}

              {/* Answer step */}
              {step === 'answer' && (
                <>
                  <button
                    onClick={handleEvaluate}
                    disabled={loading}
                    className="bg-primary-600 hover:bg-primary-700 text-white font-medium px-6 py-2.5 rounded-xl transition-colors disabled:opacity-50"
                  >
                    {loading ? '批改中...' : '提交批改'}
                  </button>
                  <button
                    onClick={() => setStep('question')}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium px-6 py-2.5 rounded-xl transition-colors"
                  >
                    查看题目
                  </button>
                </>
              )}

              {/* Result step */}
              {step === 'result' && (
                <>
                  <button
                    onClick={handleNewQuestion}
                    className="bg-primary-600 hover:bg-primary-700 text-white font-medium px-6 py-2.5 rounded-xl transition-colors"
                  >
                    再来一题
                  </button>
                  {!referenceAnswer && (
                    <button
                      onClick={handleGenerateAnswer}
                      disabled={loading}
                      className="bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-2.5 rounded-xl transition-colors disabled:opacity-50"
                    >
                      {loading ? '生成中...' : '查看参考答案'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
