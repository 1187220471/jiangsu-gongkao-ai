import { getAuthHeaders } from '@/lib/auth'

export interface ExtractPdfResult {
  rawText: string
  mode: 'text' | 'ocr'
  pageCount: number
  warnings: string[]
}

export interface ExtractPdfOptions {
  onProgress?: (current: number, total: number, phase: 'text' | 'ocr') => void
  signal?: AbortSignal
}

export const PDF_LIMITS = {
  maxPages: 20,
  maxFileBytes: 30 * 1024 * 1024,
  maxPageImageBytes: 3 * 1024 * 1024,
}

type PdfjsModule = {
  GlobalWorkerOptions: { workerSrc: string }
  getDocument: (src: Record<string, unknown>) => { promise: Promise<any> }
}

let pdfjsPromise: Promise<PdfjsModule> | null = null

/**
 * pdfjs 只能在浏览器加载：模块顶层不得 import，否则 build 期会因 DOMMatrix/document 崩溃。
 * worker 走 public 静态文件，避免 Next 14 对 new URL(..., import.meta.url) 的错误打包。
 */
async function loadPdfjs(): Promise<PdfjsModule> {
  if (typeof window === 'undefined') {
    throw new Error('PDF 解析只能在浏览器中进行')
  }
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs').then((mod) => {
      const pdfjs = mod as unknown as PdfjsModule
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
      return pdfjs
    })
  }
  return pdfjsPromise
}

function pageText(items: any[]): string {
  const parts: string[] = []
  for (const item of items) {
    if (item && typeof item.str === 'string') parts.push(item.str)
  }
  return parts.join('').replace(/[ \t]+\n/g, '\n').trim()
}

async function renderPageToJpeg(page: any): Promise<string> {
  const attempts = [
    { scale: 2, quality: 0.82 },
    { scale: 1.6, quality: 0.7 },
    { scale: 1.4, quality: 0.6 },
  ]

  for (const attempt of attempts) {
    const viewport = page.getViewport({ scale: attempt.scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('无法创建画布')

    await page.render({ canvasContext: ctx, viewport }).promise

    const dataUrl = canvas.toDataURL('image/jpeg', attempt.quality)
    const base64 = dataUrl.split(',')[1] || ''
    if (base64.length * 0.75 <= PDF_LIMITS.maxPageImageBytes) {
      return dataUrl
    }
  }

  throw new Error('PAGE_TOO_LARGE')
}

async function ocrPageImage(dataUrl: string): Promise<string> {
  const res = await fetch('/api/shenlun/ocr', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ image: dataUrl }),
  })

  if (res.status === 401) {
    throw new Error('AUTH_REQUIRED')
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const err = new Error(data?.error || `OCR 失败（${res.status}）`) as Error & {
      permanent?: boolean
    }
    // 4xx 属配置/权限/参数问题，重试无意义
    err.permanent = res.status >= 400 && res.status < 500
    throw err
  }

  const data = await res.json()
  return typeof data?.text === 'string' ? data.text : ''
}

async function ocrWithRetry(dataUrl: string): Promise<string> {
  try {
    return await ocrPageImage(dataUrl)
  } catch (err) {
    if (err instanceof Error && err.message === 'AUTH_REQUIRED') throw err
    if ((err as Error & { permanent?: boolean })?.permanent) throw err
    return await ocrPageImage(dataUrl)
  }
}

/**
 * 从 PDF 提取整卷原文：数字版直接取文本层，扫描版逐页渲染后调 OCR。
 * 任一页失败只标记该页，不中断整卷。
 */
export async function extractPdf(
  file: File,
  options: ExtractPdfOptions = {}
): Promise<ExtractPdfResult> {
  if (file.size > PDF_LIMITS.maxFileBytes) {
    throw new Error(`文件超过 ${Math.round(PDF_LIMITS.maxFileBytes / 1024 / 1024)}MB，请压缩后重试`)
  }

  const pdfjs = await loadPdfjs()
  const data = new Uint8Array(await file.arrayBuffer())
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise

  try {
    const pageCount: number = doc.numPages
    if (pageCount > PDF_LIMITS.maxPages) {
      throw new Error(`页数超过 ${PDF_LIMITS.maxPages} 页，请拆分后上传`)
    }

    // 第一轮：尝试文本层，判断是否为数字版 PDF
    const textPages: string[] = []
    let totalChars = 0
    let cjkChars = 0

    for (let i = 1; i <= pageCount; i++) {
      if (options.signal?.aborted) throw new Error('已取消')
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      const text = pageText(content.items)
      textPages.push(text)
      totalChars += text.length
      cjkChars += (text.match(/[\u4e00-\u9fa5]/g) || []).length
      page.cleanup()
      options.onProgress?.(i, pageCount, 'text')
    }

    const avgChars = pageCount > 0 ? totalChars / pageCount : 0
    const cjkRatio = totalChars > 0 ? cjkChars / totalChars : 0

    if (avgChars >= 100 && totalChars >= 300 && cjkRatio >= 0.3) {
      const rawText = textPages
        .map((t, idx) => (t ? `[[第${idx + 1}页]]\n${t}` : ''))
        .filter(Boolean)
        .join('\n\n')
      return { rawText, mode: 'text', pageCount, warnings: [] }
    }

    // 第二轮：扫描件，逐页渲染 + OCR
    const warnings: string[] = []
    const ocrPages: string[] = []

    for (let i = 1; i <= pageCount; i++) {
      if (options.signal?.aborted) throw new Error('已取消')
      const page = await doc.getPage(i)

      try {
        const image = await renderPageToJpeg(page)
        options.onProgress?.(i, pageCount, 'ocr')
        const text = await ocrWithRetry(image)
        ocrPages.push(text ? `[[第${i}页]]\n${text}` : '')
        if (!text) warnings.push(`第${i}页未识别出文字`)
      } catch (err) {
        if (err instanceof Error && err.message === 'AUTH_REQUIRED') {
          throw new Error('登录已过期，请重新登录后再上传')
        }
        const detail = err instanceof Error ? err.message : ''
        const reason = detail === 'PAGE_TOO_LARGE' ? '图片过大' : `识别失败${detail ? `：${detail.slice(0, 40)}` : ''}`
        warnings.push(`第${i}页${reason}`)
        ocrPages.push(`[[第${i}页识别失败]]`)
      } finally {
        page.cleanup()
      }
    }

    return {
      rawText: ocrPages.filter(Boolean).join('\n\n'),
      mode: 'ocr',
      pageCount,
      warnings,
    }
  } finally {
    await doc.destroy().catch(() => undefined)
  }
}
