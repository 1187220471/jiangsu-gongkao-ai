'use client'

import { useRef, useState } from 'react'

interface PdfDropzoneProps {
  disabled?: boolean
  onFile: (file: File) => void
}

const MAX_MB = 30

export default function PdfDropzone({ disabled = false, onFile }: PdfDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')

  const accept = (file?: File | null) => {
    if (!file) return
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      setError('请选择 PDF 文件')
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`文件超过 ${MAX_MB}MB，请压缩或拆分后上传`)
      return
    }
    setError('')
    setFileName(file.name)
    onFile(file)
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) inputRef.current?.click()
        }}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (disabled) return
          accept(e.dataTransfer.files?.[0])
        }}
        className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
          disabled
            ? 'border-slate-200 bg-slate-50 cursor-not-allowed'
            : dragging
              ? 'border-primary-400 bg-primary-50 cursor-copy'
              : 'border-slate-300 bg-white hover:border-primary-400 hover:bg-primary-50/40 cursor-pointer'
        }`}
      >
        <div className="text-3xl mb-2">📄</div>
        <div className="text-sm font-medium text-slate-700">
          {fileName || '点击选择或拖拽 PDF 试卷到此处'}
        </div>
        <div className="text-xs text-slate-500 mt-2">
          支持数字版与扫描件，最多 20 页、30MB
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            accept(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  )
}
