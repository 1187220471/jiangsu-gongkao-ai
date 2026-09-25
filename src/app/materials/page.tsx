'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface MaterialArticle {
  topic: string
  title: string
  source: string
  url: string
  publishDate: string
  thesis: string
  subPoints: string[]
  quotes: string[]
  content: string
  analysis: string
}

interface MaterialsData {
  week: string
  articles: MaterialArticle[]
  updatedAt: string
}

const TOPIC_COLORS: Record<string, string> = {
  '基层治理': 'bg-orange-50 text-orange-700 border-orange-200',
  '乡村振兴': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  '政务服务': 'bg-blue-50 text-blue-700 border-blue-200',
  '民生保障': 'bg-red-50 text-red-700 border-red-200',
  '执法法治': 'bg-amber-50 text-amber-700 border-amber-200',
  '科技数字化': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  '文化建设': 'bg-purple-50 text-purple-700 border-purple-200',
  '新业态治理': 'bg-pink-50 text-pink-700 border-pink-200',
  '安全应急': 'bg-rose-50 text-rose-700 border-rose-200',
  '生态环保': 'bg-teal-50 text-teal-700 border-teal-200',
  '区域协调': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  '经济发展': 'bg-green-50 text-green-700 border-green-200',
}

function getTopicColor(topic: string) {
  return TOPIC_COLORS[topic] || 'bg-gray-50 text-gray-700 border-gray-200'
}

export default function MaterialsPage() {
  const router = useRouter()
  const [data, setData] = useState<MaterialsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTopic, setActiveTopic] = useState('全部')

  useEffect(() => {
    fetch('/api/materials/weekly')
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? '本周素材尚未生成，请稍后再来' : '获取素材失败')
        return res.json()
      })
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const topics = data ? ['全部', ...Array.from(new Set(data.articles.map((a) => a.topic)))] : ['全部']
  const filtered =
    data && activeTopic !== '全部' ? data.articles.filter((a) => a.topic === activeTopic) : data?.articles || []

  // 按主题分组排序展示（选中"全部"时）
  const grouped =
    activeTopic === '全部' && data
      ? Array.from(new Set(data.articles.map((a) => a.topic))).map((topic) => ({
          topic,
          items: data.articles.filter((a) => a.topic === topic),
        }))
      : [{ topic: activeTopic, items: filtered }]

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </main>
    )
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="text-gray-500 mb-4 text-center">{error || '暂无素材数据'}</div>
        <button onClick={() => router.push('/')} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm">
          返回首页
        </button>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <button onClick={() => router.push('/')} className="text-gray-500 hover:text-gray-800 text-sm">
            ← 首页
          </button>
          <h1 className="text-base font-bold text-gray-800">📚 每周素材积累</h1>
          <span className="text-xs text-gray-400">每周一更新</span>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4">
        {/* 周期信息 */}
        <div className="mt-5 mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">
              本周素材（<span className="font-medium text-gray-800">{data.week}</span> 当周）
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              共 {data.articles.length} 篇 · 摘录自公开时评，注明来源 · 点击标题可读原文
            </p>
          </div>
        </div>

        {/* 主题筛选 */}
        <div className="flex flex-wrap gap-2 mb-5">
          {topics.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTopic(t)}
              className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                activeTopic === t ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* 素材列表 */}
        <div className="space-y-8">
          {grouped.map((group) => (
            <section key={group.topic}>
              {activeTopic === '全部' && (
                <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs border ${getTopicColor(group.topic)}`}>
                    {group.topic}
                  </span>
                  <span className="text-gray-400 font-normal text-xs">{group.items.length} 篇</span>
                </h2>
              )}
              <div className="space-y-4">
                {group.items.map((a, idx) => (
                  <article key={a.url + idx} className="bg-white rounded-xl border border-gray-100 p-5">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="text-base font-bold text-gray-800 leading-snug">
                        <a href={a.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">
                          {a.title}
                        </a>
                      </h3>
                      <span
                        className={`shrink-0 px-2 py-0.5 rounded text-xs border ${getTopicColor(a.topic)}`}
                      >
                        {a.topic}
                      </span>
                    </div>

                    <p className="text-xs text-gray-400 mb-3">
                      来源：<a href={a.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600">{a.source}</a>
                      {a.publishDate && ` · ${a.publishDate}`}
                    </p>

                    {(a.thesis || a.subPoints.length > 0) && (
                      <div className="bg-amber-50/70 border-l-4 border-amber-300 rounded-r-lg px-4 py-3 mb-3">
                        <p className="text-xs font-medium text-amber-700 mb-1.5">🧭 论点结构</p>
                        {a.thesis && (
                          <p className="text-sm text-gray-800 leading-relaxed mb-1.5">
                            <span className="font-medium text-amber-700">总论点：</span>
                            {a.thesis}
                          </p>
                        )}
                        {a.subPoints.length > 0 && (
                          <ul className="space-y-1">
                            {a.subPoints.map((sp, si) => (
                              <li key={si} className="text-sm text-gray-700 leading-relaxed">
                                <span className="text-amber-600 font-medium">分论点{si + 1}：</span>
                                {sp}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {a.quotes.length > 0 && (
                      <div className="bg-blue-50/60 border-l-4 border-blue-300 rounded-r-lg px-4 py-3 mb-3">
                        <p className="text-xs font-medium text-blue-700 mb-1.5">✍️ 金句摘录</p>
                        <ul className="space-y-1.5">
                          {a.quotes.map((q, qi) => (
                            <li key={qi} className="text-sm text-gray-700 leading-relaxed">
                              「{q}」
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {a.content && (
                      <details className="group">
                        <summary className="text-xs text-blue-600 cursor-pointer select-none mb-2">
                          展开全文摘录
                        </summary>
                        <div className="text-sm text-gray-600 leading-loose mt-2 border-t border-gray-50 pt-3">
                          {a.content
                            .split('\n')
                            .filter((p) => p.trim())
                            .map((para, pi) => (
                              <p key={pi} style={{ textIndent: '2em' }} className="mb-3 last:mb-0">
                                {para}
                              </p>
                            ))}
                        </div>
                      </details>
                    )}

                    {a.analysis && (
                      <div className="mt-3 bg-gray-50 rounded-lg px-4 py-3">
                        <p className="text-xs font-medium text-gray-500 mb-1">🤖 AI 点评 · 申论应用</p>
                        <p className="text-sm text-gray-600 leading-relaxed">{a.analysis}</p>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>

        {data.articles.length === 0 && (
          <div className="text-center text-gray-400 py-16 text-sm">本期素材生成中，请稍后再来</div>
        )}

        <p className="text-xs text-gray-300 text-center mt-10">
          内容摘录自共产党员网、甘肃网理论频道、南方网评论频道，版权归原作者所有，仅作学习交流使用
        </p>
      </div>
    </main>
  )
}
