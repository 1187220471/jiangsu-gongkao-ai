'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthHeaders } from '@/lib/auth'

interface PaperItem {
  id: string
  title: string
  examYear: number | null
  examCategory: string | null
  pageCount: number
  extractMode: string
  createdAt: string
  questionCount: number
  readyCount: number
}

export default function MyShenlunPapersPage() {
  const router = useRouter()
  const [papers, setPapers] = useState<PaperItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/shenlun/papers?page=1&pageSize=50', {
        headers: getAuthHeaders(),
      })
      if (res.status === 401) {
        router.push('/login')
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || '加载失败')
      setPapers(data.papers || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  const handleDelete = async (paper: PaperItem) => {
    if (deletingId) return
    const ok = window.confirm(`确定删除「${paper.title}」？材料、题目和答案都会一并删除，且不可恢复。`)
    if (!ok) return

    setDeletingId(paper.id)
    try {
      const res = await fetch(`/api/shenlun/papers/${paper.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || '删除失败')
      }
      setPapers((prev) => prev.filter((p) => p.id !== paper.id))
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败')
    } finally {
      setDeletingId('')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push('/shenlun')}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-primary-600"
          >
            <span>←</span>
            <span>申论</span>
          </button>
          <h1 className="text-lg font-bold text-slate-800">我的试卷</h1>
          <button
            onClick={() => router.push('/shenlun/upload')}
            className="text-sm px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800"
          >
            ＋ 上传
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="inline-block w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            加载中…
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <p className="text-sm text-red-600">{error}</p>
            <button onClick={load} className="mt-3 text-sm text-primary-600">
              重试
            </button>
          </div>
        ) : papers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <div className="text-4xl mb-3">📄</div>
            <p className="text-sm text-slate-600 mb-1">还没有上传过试卷</p>
            <p className="text-xs text-slate-400 mb-5">
              上传 PDF 后，材料和题目会存在这里，答案随时可回看
            </p>
            <button
              onClick={() => router.push('/shenlun/upload')}
              className="text-sm px-5 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800"
            >
              上传第一套试卷
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {papers.map((paper) => {
              const pending = paper.questionCount - paper.readyCount
              return (
                <div
                  key={paper.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 hover:border-primary-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <button
                      onClick={() => router.push(`/shenlun/mine/${paper.id}`)}
                      className="text-left flex-1 min-w-0"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm font-semibold text-slate-800 truncate">
                          {paper.title}
                        </h2>
                        {paper.examYear ? (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {paper.examYear}
                            {paper.examCategory ? ` · ${paper.examCategory}` : ''}
                          </span>
                        ) : null}
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                          {paper.extractMode === 'ocr' ? 'OCR' : '文本'}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                        <span>{paper.questionCount} 题</span>
                        <span>已生成 {paper.readyCount} 题</span>
                        {pending > 0 ? <span className="text-amber-600">待生成 {pending} 题</span> : null}
                        <span>{paper.pageCount} 页</span>
                        <span>{new Date(paper.createdAt).toLocaleDateString('zh-CN')}</span>
                      </div>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => router.push(`/shenlun/mine/${paper.id}`)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                      >
                        查看
                      </button>
                      <button
                        onClick={() => handleDelete(paper)}
                        disabled={deletingId === paper.id}
                        className="text-xs px-3 py-1.5 rounded-lg border border-red-100 text-red-500 hover:bg-red-50 disabled:opacity-50"
                      >
                        {deletingId === paper.id ? '删除中…' : '删除'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
