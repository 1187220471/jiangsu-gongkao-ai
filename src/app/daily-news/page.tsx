'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface NewsItem {
  topic: string
  title: string
  date: string
  source: string
  score: number
  intro: string
  url: string
}

interface AllNewsItem {
  title: string
  date: string
  source: string
  score: number
  url: string
}

interface NewsData {
  date: string
  topNews: NewsItem[]
  allNews: AllNewsItem[]
  createdAt: string
}

const TOPIC_COLORS: Record<string, string> = {
  '民生保障': 'bg-red-50 text-red-700 border-red-200',
  '产业创新': 'bg-blue-50 text-blue-700 border-blue-200',
  '经济发展': 'bg-green-50 text-green-700 border-green-200',
  '文化繁荣': 'bg-purple-50 text-purple-700 border-purple-200',
  '社会治理': 'bg-orange-50 text-orange-700 border-orange-200',
  '科技创新': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  '区域协调': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  '乡村振兴': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  '绿色发展': 'bg-teal-50 text-teal-700 border-teal-200',
}

function getTopicColor(topic: string) {
  return TOPIC_COLORS[topic] || 'bg-gray-50 text-gray-700 border-gray-200'
}

function getScoreColor(score: number): string {
  if (score >= 8) return 'text-green-600 bg-green-50'
  if (score >= 7) return 'text-blue-600 bg-blue-50'
  if (score >= 6) return 'text-amber-600 bg-amber-50'
  return 'text-gray-600 bg-gray-50'
}

export default function DailyNewsPage() {
  const router = useRouter()
  const [news, setNews] = useState<NewsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [showAllNews, setShowAllNews] = useState(false)

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    setSelectedDate(today)
    fetchNews(today)
  }, [])

  const fetchNews = async (date: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/news/daily?date=${date}`)
      const data = await res.json()
      if (res.ok) {
        setNews(data)
      } else {
        setError(data.error || '获取新闻失败')
        setNews(null)
      }
    } catch (e) {
      setError('网络错误')
      setNews(null)
    }
    setLoading(false)
  }

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value
    setSelectedDate(date)
    if (date) fetchNews(date)
  }

  // 按主题分组
  const groupedNews = news?.topNews.reduce((acc, item) => {
    if (!acc[item.topic]) acc[item.topic] = []
    acc[item.topic].push(item)
    return acc
  }, {} as Record<string, NewsItem[]>)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-lg font-bold text-gray-800">每日政务要闻</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">日期</span>
            <input
              type="date"
              value={selectedDate}
              onChange={handleDateChange}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </header>

      {/* 主体内容 */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* 说明 */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">公考备考专用精选</p>
              <p className="text-blue-600">
                每天19:00自动抓取江苏政务新闻，经AI筛选后保留8-12条与申论/面试话题高度相关的内容，并生成100-150字备考简介。
              </p>
            </div>
          </div>
        </div>

        {/* 筛选标准 */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className="text-sm font-semibold text-gray-700">AI 筛选评分标准</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="bg-gray-50 rounded-lg p-2.5">
              <div className="font-medium text-gray-800 mb-0.5">申论/面试相关度</div>
              <div className="text-gray-500">权重 40%</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2.5">
              <div className="font-medium text-gray-800 mb-0.5">政策重要性</div>
              <div className="text-gray-500">权重 25%</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2.5">
              <div className="font-medium text-gray-800 mb-0.5">时效性</div>
              <div className="text-gray-500">权重 20%</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2.5">
              <div className="font-medium text-gray-800 mb-0.5">信息密度</div>
              <div className="text-gray-500">权重 15%</div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 space-y-1">
            <p><span className="text-green-600 font-medium">加分项：</span>民生保障、产业创新、经济发展、文化繁荣、基层治理、长三角一体化（+1分）</p>
            <p><span className="text-red-500 font-medium">降分项：</span>纯人事任免（-3分）、纯行政事务（-1分）</p>
            <p><span className="text-gray-400">排除项：</span>娱乐八卦、体育赛事、商业广告、社会猎奇、天气预报、重复报道</p>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-500">加载中...</span>
          </div>
        )}

        {error && !loading && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
            <svg className="w-10 h-10 text-yellow-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-yellow-800 font-medium">{error}</p>
            <p className="text-yellow-600 text-sm mt-1">每日新闻于19:00自动更新，请稍后再试</p>
          </div>
        )}

        {news && !loading && (
          <>
            {/* 统计信息 */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">
                  {news.date} 共 {news.topNews.length} 条精选 / {news.allNews?.length || 0} 条初筛
                </span>
                <span className="text-xs text-gray-400">
                  更新于 {new Date(news.createdAt).toLocaleString('zh-CN')}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Object.keys(groupedNews || {}).map(topic => (
                  <span
                    key={topic}
                    className={`text-xs px-2 py-0.5 rounded-full border ${getTopicColor(topic)}`}
                  >
                    {topic} {groupedNews?.[topic].length}
                  </span>
                ))}
              </div>
            </div>

            {/* 初筛新闻列表 */}
            {news.allNews && news.allNews.length > 0 && (
              <div className="mb-6 bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setShowAllNews(!showAllNews)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span className="font-medium text-gray-800 text-sm">初筛新闻（得分6分以上）</span>
                    <span className="text-xs text-gray-400">共 {news.allNews.length} 条</span>
                  </div>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${showAllNews ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showAllNews && (
                  <div className="border-t border-gray-100">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500 text-xs">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium w-12">得分</th>
                            <th className="px-4 py-2 text-left font-medium">标题</th>
                            <th className="px-4 py-2 text-left font-medium w-24 hidden sm:table-cell">时间</th>
                            <th className="px-4 py-2 text-left font-medium w-28 hidden md:table-cell">来源</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {news.allNews
                            .sort((a, b) => b.score - a.score)
                            .map((item, idx) => (
                            <tr key={idx} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-2.5">
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getScoreColor(item.score)}`}>
                                  {item.score}
                                </span>
                              </td>
                              <td className="px-4 py-2.5">
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-gray-800 hover:text-blue-600 transition-colors line-clamp-1"
                                >
                                  {item.title}
                                </a>
                              </td>
                              <td className="px-4 py-2.5 text-gray-500 hidden sm:table-cell">
                                {item.date}
                              </td>
                              <td className="px-4 py-2.5 text-gray-500 hidden md:table-cell">
                                {item.source}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 今日精选 - 按主题分组 */}
            <div className="space-y-6">
              {Object.entries(groupedNews || {}).map(([topic, items]) => (
                <div key={topic} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className={`px-4 py-3 border-b ${getTopicColor(topic).replace('text-', 'bg-').split(' ')[0]} border-gray-100`}>
                    <h2 className="font-bold text-gray-800 flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${getTopicColor(topic)}`}>
                        {topic}
                      </span>
                      <span className="text-sm text-gray-400">{items.length} 条</span>
                    </h2>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {items.map((item, idx) => (
                      <div key={idx} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 text-sm leading-snug mb-1.5">
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-blue-600 transition-colors"
                              >
                                {item.title}
                              </a>
                            </h3>
                            <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                              <span>{item.date}</span>
                              <span className="text-gray-300">|</span>
                              <span>{item.source}</span>
                              <span className="text-gray-300">|</span>
                              <span className="text-amber-600 font-medium">{item.score}分</span>
                            </div>
                            <p className="text-sm text-gray-600 leading-relaxed">
                              {item.intro}
                            </p>
                          </div>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0 text-gray-400 hover:text-blue-500 transition-colors mt-1"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
