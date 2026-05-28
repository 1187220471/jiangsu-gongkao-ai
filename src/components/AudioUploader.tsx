'use client'

import { useState, useRef } from 'react'
import { getAuthHeaders } from '@/lib/auth'

interface AudioUploaderProps {
  onTranscript: (text: string) => void
  disabled?: boolean
}

/**
 * 阿里云录音文件识别（异步）
 * 支持上传mp3/wav/m4a等格式，自动转写成文字
 * 适合2-5分钟的长音频
 */
export default function AudioUploader({ onTranscript, disabled }: AudioUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // 获取音频格式对应的阿里云format参数
  const getAudioFormat = (file: File): string => {
    const type = file.type.toLowerCase()
    if (type.includes('mp3') || type.includes('mpeg')) return 'mp3'
    if (type.includes('wav')) return 'wav'
    if (type.includes('m4a') || type.includes('mp4')) return 'm4a'
    if (type.includes('ogg')) return 'ogg'
    if (type.includes('opus')) return 'opus'
    if (type.includes('flac')) return 'flac'
    return 'mp3'
  }

  // 轮询查询识别结果
  const pollResult = async (token: string, appKey: string, taskId: string): Promise<string> => {
    const maxAttempts = 60 // 最多轮询2分钟
    const queryUrl = 'https://nls-gateway.cn-shanghai.aliyuncs.com/stream/v1/FileTranscriber'

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000)) // 每2秒查一次

      const response = await fetch(`${queryUrl}?appkey=${appKey}&task_id=${taskId}`, {
        method: 'GET',
        headers: {
          'X-NLS-Token': token,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        console.warn(`轮询第${i + 1}次失败: ${response.status}`)
        continue
      }

      const result = await response.json()
      console.log(`轮询第${i + 1}次结果:`, result)

      // 检查错误
      if (result.error_code && result.error_code !== 0) {
        throw new Error(result.error_message || `识别失败: ${result.error_code}`)
      }

      // 检查状态
      const status = result.status_text
      if (status === 'SUCCESS') {
        // 识别完成，提取文字
        const sentences = result.result?.sentences || []
        const text = sentences.map((s: any) => s.text).join('')
        if (!text) {
          throw new Error('识别结果为空，请检查音频质量')
        }
        return text
      } else if (status === 'FAILED') {
        throw new Error(result.error_message || '识别任务失败')
      }
      // RUNNING 或 QUEUING，继续轮询
      setProgress(`识别中...(${i + 1}/${maxAttempts})`)
    }

    throw new Error('识别超时，请重试')
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 限制文件大小（10MB，2-5分钟mp3通常2-5MB）
    if (file.size > 10 * 1024 * 1024) {
      setProgress('文件超过10MB，请压缩后上传')
      setTimeout(() => setProgress(''), 3000)
      return
    }

    setIsUploading(true)
    setProgress('正在获取识别Token...')

    try {
      // 1. 获取阿里云Token
      const tokenRes = await fetch('/api/voice/aliyun-token', {
        headers: getAuthHeaders(),
      })
      const tokenData = await tokenRes.json()

      if (!tokenData.token) {
        throw new Error('获取Token失败: ' + (tokenData.error || '未知错误'))
      }

      setProgress('正在读取音频文件...')

      // 2. 读取文件并转Base64
      const arrayBuffer = await file.arrayBuffer()
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      )
      const format = getAudioFormat(file)

      setProgress('正在提交识别任务...')

      // 3. 提交识别任务
      const submitUrl = 'https://nls-gateway.cn-shanghai.aliyuncs.com/stream/v1/FileTranscriber'

      const response = await fetch(submitUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-NLS-Token': tokenData.token,
        },
        body: JSON.stringify({
          appkey: tokenData.appKey,
          file_link: `data:audio/${format};base64,${base64}`,
          format: format,
          sample_rate: 16000,
          enable_punctuation_prediction: true,
          enable_inverse_text_normalization: true,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`提交识别任务失败: ${errorText}`)
      }

      const submitResult = await response.json()
      console.log('提交识别任务结果:', submitResult)

      if (submitResult.error_code && submitResult.error_code !== 0) {
        throw new Error(submitResult.error_message || '提交识别任务失败')
      }

      const taskId = submitResult.task_id
      if (!taskId) {
        throw new Error('未获取到任务ID')
      }

      // 4. 轮询查询结果
      setProgress('AI识别中，请稍候...')
      const transcript = await pollResult(tokenData.token, tokenData.appKey, taskId)

      setProgress('识别完成')
      onTranscript(transcript)
    } catch (err: any) {
      console.error('录音识别失败:', err)
      setProgress('识别失败: ' + err.message)
    } finally {
      setIsUploading(false)
      if (inputRef.current) inputRef.current.value = ''
      setTimeout(() => setProgress(''), 3000)
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="audio/mp3,audio/wav,audio/m4a,audio/ogg,audio/*"
        onChange={handleFileSelect}
        disabled={disabled || isUploading}
        className="hidden"
        id="audio-upload"
      />
      <label
        htmlFor="audio-upload"
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
          disabled || isUploading
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
            : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
        }`}
      >
        {isUploading ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            {progress}
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            上传录音
          </>
        )}
      </label>
    </div>
  )
}
