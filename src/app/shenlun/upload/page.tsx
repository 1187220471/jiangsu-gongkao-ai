'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import PdfDropzone from '@/components/shenlun/PdfDropzone'
import { extractPdf, PDF_LIMITS, type ExtractPdfResult } from '@/lib/pdf'
import { splitShenlunPaper, type SplitResult } from '@/lib/shenlunPaperSplit'
import { getAuthHeaders } from '@/lib/auth'

type Step = 'file' | 'review'

export default function ShenlunUploadPage() {
  const router = useRouter()

  const [step, setStep] = useState<Step>('file')
  const [extracting, setExtracting] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number; phase: 'text' | 'ocr' }>({
    current: 0,
    total: 0,
    phase: 'text',
  })
  const [extracted, setExtracted] = useState<ExtractPdfResult | null>(null)

  const [rawText, setRawText] = useState('')
  const [title, setTitle] = useState('')
  const [examYear, setExamYear] = useState('')
  const [examCategory, setExamCategory] = useState('')

  const [preview, setPreview] = useState<SplitResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    setAuthed(!!localStorage.getItem('token'))
  }, [])

  useEffect(() => {
    if (step !== 'review') return
    const timer = setTimeout(() => setPreview(splitShenlunPaper(rawText)), 300)
    return () => clearTimeout(timer)
  }, [rawText, step])

  const handleFile = async (file: File) => {
    setError('')
    setExtracting(true)
    setProgress({ current: 0, total: 0, phase: 'text' })

    try {
      const result = await extractPdf(file, {
        onProgress: (current, total, phase) => setProgress({ current, total, phase }),
      })
      setExtracted(result)
      setRawText(result.rawText)
      setTitle(file.name.replace(/\.pdf$/i, '').slice(0, 80))
      setStep('review')
      if (!result.rawText.trim()) {
        setError('未能读取到文字，请检查文件是否清晰，或直接粘贴原文')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF 读取失败')
    } finally {
      setExtracting(false)
    }
  }

  const handleSave = async () => {
    if (saving) return
    if (!rawText.trim()) {
      setError('原文不能为空')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/shenlun/papers', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          rawText,
          title,
          examYear: examYear || null,
          examCategory: examCategory || null,
          sourceFileName: extracted ? title : null,
          pageCount: extracted?.pageCount || 0,
          extractMode: extracted?.mode || 'text',
        }),
      })

      if (res.status === 401) {
        router.push('/login')
        return
      }

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || '保存失败')
      }

      router.push(`/shenlun/mine/${data.paper.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const progressText = useMemo(() => {
    if (!extracting) return ''
    if (progress.total === 0) return '正在读取 PDF…'
    return progress.phase === 'text'
      ? `正在提取文本 第 ${progress.current}/${progress.total} 页…`
      : `正在识别 第 ${progress.current}/${progress.total} 页…`
  }, [extracting, progress])

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push('/shenlun')}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-primary-600"
          >
            <span>←</span>
            <span>申论</span>
          </button>
          <h1 className="text-lg font-bold text-slate-800">上传申论试卷</h1>
          <div className="text-xs text-slate-400">最多 {PDF_LIMITS.maxPages} 页</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {authed === false && (
          <div className="max-w-xl mx-auto bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <div className="text-3xl mb-3">🔒</div>
            <p className="text-sm font-medium text-slate-800 mb-1">请先登录</p>
            <p className="text-xs text-slate-500 mb-5">
              上传试卷需要调用识别服务，请登录后使用
            </p>
            <button
              onClick={() => router.push('/login')}
              className="text-sm px-6 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800"
            >
              去登录
            </button>
          </div>
        )}

        {authed === true && step === 'file' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="text-base font-semibold text-slate-800 mb-1">选择 PDF 试卷</h2>
              <p className="text-xs text-slate-500 mb-4">
                数字版 PDF 直接提取文字；扫描件会逐页 OCR 识别。识别后需你校对原文再保存。
              </p>

              <PdfDropzone disabled={extracting} onFile={handleFile} />

              {extracting && (
                <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
                  <span className="inline-block w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  {progressText}
                </div>
              )}

              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

              <div className="mt-5 pt-4 border-t border-slate-100">
                <button
                  onClick={() => {
                    setExtracted(null)
                    setRawText('')
                    setStep('review')
                  }}
                  className="text-xs text-slate-500 hover:text-primary-600"
                >
                  没有 PDF？直接粘贴试卷原文 →
                </button>
              </div>
            </div>
          </div>
        )}

        {authed === true && step === 'review' && (
          <div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="试卷标题"
                  className="md:col-span-2 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
                <input
                  value={examYear}
                  onChange={(e) => setExamYear(e.target.value.replace(/[^\d]/g, '').slice(0, 4))}
                  placeholder="年份，如 2026"
                  className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
                <select
                  value={examCategory}
                  onChange={(e) => setExamCategory(e.target.value)}
                  className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-400"
                >
                  <option value="">卷别（可不选）</option>
                  <option value="A">A 卷</option>
                  <option value="B">B 卷</option>
                  <option value="C">C 卷</option>
                  <option value="其他">其他</option>
                </select>
              </div>

              {extracted && (
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                  <span>共 {extracted.pageCount} 页</span>
                  <span>
                    抽取方式：{extracted.mode === 'text' ? '数字版文本' : '扫描件 OCR'}
                  </span>
                  <span>当前 {rawText.length} 字</span>
                </div>
              )}

              {extracted?.warnings.length ? (
                <ul className="mt-2 text-xs text-amber-600 space-y-1">
                  {extracted.warnings.map((w, idx) => (
                    <li key={idx}>· {w}</li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold text-slate-800">校对原文</h2>
                  <span className="text-xs text-slate-400">
                    OCR 可能有错字，建议通读一遍
                  </span>
                </div>
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  rows={22}
                  placeholder="在此粘贴或校对试卷原文…"
                  className="w-full text-sm leading-6 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400 font-mono"
                />
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold text-slate-800">
                    切分预览（{preview?.questions.length || 0} 题）
                  </h2>
                  <span className="text-xs text-slate-400">
                    按题号规则切分，保存后可编辑
                  </span>
                </div>

                <div className="max-h-[460px] overflow-y-auto space-y-2">
                  {preview?.questions.length ? (
                    preview.questions.map((q) => (
                      <div
                        key={q.questionNumber}
                        className="rounded-xl border border-slate-200 bg-slate-50/60 p-3"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-600 text-white text-[11px] font-semibold">
                            {q.questionNumber}
                          </span>
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200">
                            {q.questionType}
                          </span>
                          {q.score ? (
                            <span className="text-[11px] text-amber-700">{q.score} 分</span>
                          ) : null}
                          {q.wordLimit ? (
                            <span className="text-[11px] text-blue-700">{q.wordLimit}</span>
                          ) : null}
                        </div>
                        <p className="text-xs leading-5 text-slate-600 line-clamp-3">
                          {q.questionText.slice(0, 90)}
                          {q.questionText.length > 90 ? '…' : ''}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">
                      未识别到题目。可保存后进入试卷页手动添加，或检查原文题号格式（如「1.」「（1）」）。
                    </p>
                  )}
                </div>

                {preview?.warnings.length ? (
                  <ul className="mt-3 text-xs text-amber-600 space-y-1">
                    {preview.warnings.map((w, idx) => (
                      <li key={idx}>· {w}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>

            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={() => {
                  setStep('file')
                  setError('')
                }}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                ← 重新选择文件
              </button>

              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">保存不消耗额度</span>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="text-sm px-6 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {saving ? '保存中…' : '保存并进入试卷'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
