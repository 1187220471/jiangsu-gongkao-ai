'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function CustomQuestion() {
  const router = useRouter()
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)

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

  const handleGenerateAnswer = async () => {
    if (!question.trim() || question.trim().length < 10) {
      alert('请输入完整的面试题目，至少10个字')
      return
    }

    setLoading(true)
    setAnswer('')

    try {
      const res = await fetch('/api/custom-answer', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ question: question.trim() }),
      })

      const data = await res.json()
      if (data.answer) {
        setAnswer(data.answer)
      } else {
        alert(data.error || '生成答案失败')
      }
    } catch {
      alert('网络错误')
    } finally {
      setLoading(false)
    }
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
            <span className="font-bold">独行侠波铁面试训练</span>
          </button>
          <div className="text-sm text-slate-500">自定义题目</div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-slate-800 mb-4">
            输入你自己的面试题目
          </h2>
          <p className="text-slate-500 text-sm mb-4">
            粘贴你收集到的面试真题或模拟题，AI 会按照独行侠波铁答题模板生成参考答案。
          </p>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="w-full h-48 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none text-slate-700 leading-relaxed"
            placeholder={`请在此输入面试题目...\n\n例如：\n某市推行「一网通办」政务服务改革，要求群众办事「最多跑一次」。但在实际执行中，部分群众反映仍存在材料重复提交、部门间信息不互通等问题。对此，你怎么看？`}
          />
          <div className="flex items-center justify-between mt-3">
            <div className="text-sm text-slate-400">
              {question.length} 字
            </div>
            <button
              onClick={handleGenerateAnswer}
              disabled={loading || question.trim().length < 10}
              className="bg-primary-600 hover:bg-primary-700 text-white font-medium px-6 py-2.5 rounded-xl transition-colors disabled:opacity-50"
            >
              {loading ? '生成中...' : '生成参考答案'}
            </button>
          </div>
        </div>

        {answer && (
          <div className="bg-green-50 rounded-xl border border-green-200 p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">✅</span>
              <h3 className="font-bold text-green-800">参考答案</h3>
            </div>
            <div className="text-slate-700 leading-relaxed whitespace-pre-wrap">
              {answer}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
