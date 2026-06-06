'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthHeaders } from '@/lib/auth'

interface ZhentiItem {
  id: number
  examTitle: string
  examYear: number
  examDate: string
  examCategory: string | null
  questionNumber: number
  questionText: string
  questionType: string
  finalWordCount: number
  isBookmarked: boolean
  proficiency: string | null
}

interface FilterOptions {
  years: number[]
  categories: string[]
  types: string[]
}

const PROFICIENCY_LABELS: Record<string, { label: string; color: string }> = {
  weak: { label: '生疏', color: 'bg-red-100 text-red-700' },
  okay: { label: '一般', color: 'bg-yellow-100 text-yellow-700' },
  mastered: { label: '熟练', color: 'bg-green-100 text-green-700' },
}

export default function ZhentiPage() {
  const router = useRouter()
  const [questions, setQuestions] = useState<ZhentiItem[]>([])
  const [filters, setFilters] = useState<FilterOptions>({ years: [], categories: [], types: [] })
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)

  // 筛选条件
  const [selectedYear, setSelectedYear] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [showBookmarked, setShowBookmarked] = useState(false)

  const fetchQuestions = useCallback(async (p = 1) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p), pageSize: '20' })
    if (selectedYear) params.set('year', selectedYear)
    if (selectedCategory) params.set('category', selectedCategory)
    if (selectedType) params.set('type', selectedType)

    try {
      const res = await fetch(`/api/zhenti/list?${params}`, {
        headers: getAuthHeaders(),
      })
      if (res.status === 401) { router.push('/login'); return }
      const data = await res.json()
      setQuestions(data.questions || [])
      setTotal(data.total || 0)
      setTotalPages(data.totalPages || 1)
      if (data.filters) setFilters(data.filters)
    } catch (err) {
      console.error('获取真题列表失败:', err)
      setLoading(false)
    }
  }, [selectedYear, selectedCategory, selectedType, router])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { router.push('/login'); return }
    fetchQuestions(1)
    setPage(1)
  }, [selectedYear, selectedCategory, selectedType, fetchQuestions, router])

  const handlePageChange = (p: number) => {
    setPage(p)
    fetchQuestions(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const displayedQuestions = showBookmarked
    ? questions.filter((q) => q.isBookmarked)
    : questions

  // 按场次分组（使用 useMemo 避免重复计算）
  const grouped = useMemo(() => {
    return displayedQuestions.reduce<Record<string, ZhentiItem[]>>((acc, q) => {
      const key = q.examTitle
      if (!acc[key]) acc[key] = []
      acc[key].push(q)
      return acc
    }, {})
  }, [displayedQuestions])

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div />
          <h1 className="text-lg font-bold text-slate-800">📜 真题复盘</h1>
          <div className="text-sm text-slate-500">共 {total} 题</div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* 筛选栏 */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="flex flex-wrap gap-3 items-center">
            {/* 年份 */}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
            >
              <option value="">全部年份</option>
              {filters.years.map((y) => (
                <option key={y} value={String(y)}>{y} 年</option>
              ))}
            </select>

            {/* 类别 */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
            >
              <option value="">全部类别</option>
              {filters.categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* 题型 */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
            >
              <option value="">全部题型</option>
              {filters.types.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            {/* 只看收藏 */}
            <button
              onClick={() => setShowBookmarked(!showBookmarked)}
              className={`text-sm px-3 py-2 rounded-lg border transition-colors ${
                showBookmarked
                  ? 'bg-amber-50 border-amber-300 text-amber-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-amber-300'
              }`}
            >
              ⭐ {showBookmarked ? '全部显示' : '只看收藏'}
            </button>

            {/* 重置 */}
            {(selectedYear || selectedCategory || selectedType) && (
              <button
                onClick={() => {
                  setSelectedYear('')
                  setSelectedCategory('')
                  setSelectedType('')
                }}
                className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
              >
                × 清除筛选
              </button>
            )}
          </div>
        </div>

        {/* 题目列表 */}
        {loading ? (
          <div className="text-center py-20 text-slate-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-3"></div>
            加载中...
          </div>
        ) : displayedQuestions.length === 0 ? (
          <div className="text-center py-20 text-slate-400">暂无数据</div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([examTitle, qs]) => (
              <div key={examTitle} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {/* 场次标题 */}
                <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex items-center gap-3">
                  <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">
                    {qs[0].examYear}年
                  </span>
                  {qs[0].examCategory && (
                    <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                      {qs[0].examCategory}
                    </span>
                  )}
                  <span className="text-sm font-medium text-slate-700 flex-1">{examTitle}</span>
                  <span className="text-xs text-slate-400">{qs.length} 题</span>
                </div>

                {/* 题目列表 */}
                <div className="divide-y divide-slate-100">
                  {qs
                    .sort((a, b) => a.questionNumber - b.questionNumber)
                    .map((q) => (
                      <button
                        key={q.id}
                        onClick={() => router.push(`/zhenti/${q.id}`)}
                        className="w-full px-5 py-4 text-left hover:bg-slate-50 transition-colors group"
                      >
                        <div className="flex items-start gap-3">
                          {/* 题号 */}
                          <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center">
                            {q.questionNumber}
                          </span>

                          {/* 题目内容 */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-700 line-clamp-2 leading-relaxed group-hover:text-slate-900">
                              {q.questionText}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs text-slate-400">{q.questionType}</span>
                              <span className="text-slate-200">·</span>
                              <span className="text-xs text-slate-400">参考答案 {q.finalWordCount} 字</span>
                              {q.isBookmarked && (
                                <>
                                  <span className="text-slate-200">·</span>
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${PROFICIENCY_LABELS[q.proficiency || 'weak']?.color || ''}`}>
                                    {PROFICIENCY_LABELS[q.proficiency || 'weak']?.label}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* 箭头 */}
                          <span className="text-slate-300 group-hover:text-primary-400 transition-colors text-sm flex-shrink-0 mt-1">
                            →
                          </span>
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 分页 */}
        {totalPages > 1 && !showBookmarked && (
          <div className="flex justify-center items-center gap-2 mt-8">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
              className="px-4 py-2 text-sm rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              上一页
            </button>
            <span className="text-sm text-slate-500 px-2">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page === totalPages}
              className="px-4 py-2 text-sm rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              下一页
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
