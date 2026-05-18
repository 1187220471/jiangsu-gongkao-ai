'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { QUESTION_TYPE_LABELS } from '@/types'

interface Record {
  id: string
  questionType: string
  question: string
  referenceAnswer: string | null
  userAnswer: string | null
  evaluation: string | null
  score: number | null
  createdAt: string
}

export default function History() {
  const router = useRouter()
  const [records, setRecords] = useState<Record[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }

    fetch('/api/history', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.records) {
          setRecords(data.records)
        }
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }, [router])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-slate-400'
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
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
          <span className="text-sm text-slate-500">练习记录</span>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <h2 className="text-xl font-bold text-slate-800 mb-6">练习记录</h2>

        {loading ? (
          <div className="text-center py-12">
            <div className="text-slate-400">加载中...</div>
          </div>
        ) : records.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <div className="text-4xl mb-4">📝</div>
            <div className="text-slate-500 mb-4">还没有练习记录</div>
            <button
              onClick={() => router.push('/practice')}
              className="bg-primary-600 hover:bg-primary-700 text-white font-medium px-6 py-2 rounded-lg transition-colors"
            >
              开始练习
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {records.map((record) => (
              <div
                key={record.id}
                className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
              >
                <div
                  className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() =>
                    setExpandedId(expandedId === record.id ? null : record.id)
                  }
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-primary-100 text-primary-700 text-xs font-medium px-2 py-0.5 rounded-full">
                          {QUESTION_TYPE_LABELS[record.questionType as keyof typeof QUESTION_TYPE_LABELS] || record.questionType}
                        </span>
                        <span className="text-xs text-slate-400">
                          {formatDate(record.createdAt)}
                        </span>
                      </div>
                      <p className="text-slate-700 text-sm line-clamp-2">
                        {record.question}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {record.score !== null && (
                        <span
                          className={`text-lg font-bold ${getScoreColor(
                            record.score
                          )}`}
                        >
                          {record.score}
                        </span>
                      )}
                      <span className="text-slate-400 text-sm">
                        {expandedId === record.id ? '▲' : '▼'}
                      </span>
                    </div>
                  </div>
                </div>

                {expandedId === record.id && (
                  <div className="border-t border-slate-100 p-4 space-y-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-700 mb-2">
                        题目
                      </h4>
                      <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
                        {record.question}
                      </div>
                    </div>

                    {record.referenceAnswer && (
                      <div>
                        <h4 className="text-sm font-bold text-green-700 mb-2">
                          参考答案
                        </h4>
                        <div className="bg-green-50 rounded-lg p-3 text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
                          {record.referenceAnswer}
                        </div>
                      </div>
                    )}

                    {record.userAnswer && (
                      <div>
                        <h4 className="text-sm font-bold text-slate-700 mb-2">
                          你的答案
                        </h4>
                        <div className="bg-slate-50 rounded-lg p-3 text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
                          {record.userAnswer}
                        </div>
                      </div>
                    )}

                    {record.evaluation && (
                      <div>
                        <h4 className="text-sm font-bold text-primary-700 mb-2">
                          AI批改
                        </h4>
                        <div className="bg-primary-50 rounded-lg p-3 text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
                          {record.evaluation}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
