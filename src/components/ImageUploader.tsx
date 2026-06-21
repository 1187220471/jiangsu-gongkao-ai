'use client'

import { useState, useRef } from 'react'

interface ImageUploaderProps {
  onRecognized: (text: string) => void
  disabled?: boolean
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
      // 用 FileReader 读 base64
      const base64: string = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('文件读取失败'))
        reader.readAsDataURL(file)
      })

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
      // 清空 input 允许重复选同一文件
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
