'use client'

import { useState, useRef, ChangeEvent } from 'react'

interface ImageUploaderProps {
  onRecognized: (text: string) => void
  disabled?: boolean
}

export default function ImageUploader({ onRecognized, disabled }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件')
      return
    }

    // 验证文件大小（最大 20MB）
    if (file.size > 20 * 1024 * 1024) {
      alert('图片大小不能超过 20MB')
      return
    }

    // 读取文件为 base64
    const reader = new FileReader()
    reader.onload = async (event) => {
      const base64 = event.target?.result as string
      setPreviewUrl(base64)
      await recognizeText(base64)
    }
    reader.readAsDataURL(file)
  }

  const recognizeText = async (base64Image: string) => {
    setUploading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/shenlun/ocr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ image: base64Image }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '识别失败')
      }

      const data = await res.json()
      onRecognized(data.text)
      setPreviewUrl(null)
    } catch (err: any) {
      alert(err.message || '图片识别失败，请重试')
    } finally {
      setUploading(false)
      // 清空 input，允许重复选择同一文件
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleClick = () => {
    if (!uploading && !disabled) {
      fileInputRef.current?.click()
    }
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading || disabled}
      />

      <button
        onClick={handleClick}
        disabled={uploading || disabled}
        className="text-xs flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors disabled:opacity-50"
      >
        {uploading ? (
          <>
            <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary-500"></span>
            <span>识别中...</span>
          </>
        ) : (
          <>
            <span>📷</span>
            <span>上传手写稿</span>
          </>
        )}
      </button>

      {/* 图片预览 */}
      {previewUrl && (
        <div className="mt-2 relative">
          <img
            src={previewUrl}
            alt="预览"
            className="max-h-32 rounded-lg border border-slate-200 object-contain"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
            <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
          </div>
        </div>
      )}
    </div>
  )
}
