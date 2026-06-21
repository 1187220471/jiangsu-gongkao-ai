'use client'

import { useState, useRef } from 'react'

interface ImageUploaderProps {
  onRecognized: (text: string) => void
  disabled?: boolean
}

// 压缩图片：限制长边最大 2000px，输出 JPEG 质量 0.85
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      const MAX_LONG_SIDE = 2000
      let { width, height } = img
      if (width > MAX_LONG_SIDE || height > MAX_LONG_SIDE) {
        const ratio = MAX_LONG_SIDE / Math.max(width, height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('无法创建 Canvas'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)

      const base64 = canvas.toDataURL('image/jpeg', 0.85)
      resolve(base64)
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片加载失败'))
    }

    img.src = url
  })
}

export default function ImageUploader({ onRecognized, disabled }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.match(/^image\//)) {
      alert('请选择图片文件')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('图片大小不能超过 10MB')
      return
    }

    setUploading(true)

    try {
      // 压缩图片（长边 max 2000px，JPEG 质量 0.85），大幅缩小 base64
      const base64 = await compressImage(file)

      // 调 OCR API
      const token = localStorage.getItem('token')
      const res = await fetch('/api/shenlun/ocr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ image: base64 }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '识别失败')
      }

      const data = await res.json()
      onRecognized(data.text)
    } catch (err: any) {
      console.error('OCR识别失败:', err)
      alert(err.message || '图片识别失败，请重试')
    } finally {
      setUploading(false)
      try {
        if (fileInputRef.current) fileInputRef.current.value = ''
      } catch {
        // ignore
      }
    }
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/bmp,image/gif"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading || disabled}
      />

      <button
        onClick={() => fileInputRef.current?.click()}
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
    </div>
  )
}
