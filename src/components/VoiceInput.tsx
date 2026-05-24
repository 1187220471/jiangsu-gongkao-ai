'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface VoiceInputProps {
  onTranscript: (text: string) => void
  disabled?: boolean
}

// 检查浏览器是否支持语音识别
const isSpeechRecognitionSupported = () => {
  return typeof window !== 'undefined' && (
    'SpeechRecognition' in window ||
    'webkitSpeechRecognition' in window
  )
}

export default function VoiceInput({ onTranscript, disabled }: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [recordingTime, setRecordingTime] = useState(0)
  const [error, setError] = useState('')
  const [showUnsupported, setShowUnsupported] = useState(false)

  const recognitionRef = useRef<any>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const maxDuration = 360 // 6分钟 = 360秒

  // 清理函数
  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // 忽略停止时的错误
      }
      recognitionRef.current = null
    }
    setIsRecording(false)
    setRecordingTime(0)
  }, [])

  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  // 格式化时间显示
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const startRecording = () => {
    if (!isSpeechRecognitionSupported()) {
      setShowUnsupported(true)
      return
    }

    setError('')
    setTranscript('')
    setInterimTranscript('')
    setRecordingTime(0)

    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      const recognition = new SpeechRecognition()
      recognition.lang = 'zh-CN'
      recognition.continuous = true
      recognition.interimResults = true
      recognition.maxAlternatives = 1

      recognition.onstart = () => {
        setIsRecording(true)
        // 开始计时
        timerRef.current = setInterval(() => {
          setRecordingTime((prev) => {
            if (prev >= maxDuration - 1) {
              // 到达6分钟上限，自动停止
              stopRecording()
              return prev
            }
            return prev + 1
          })
        }, 1000)
      }

      recognition.onresult = (event: any) => {
        let finalText = ''
        let interimText = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          if (result.isFinal) {
            finalText += result[0].transcript
          } else {
            interimText += result[0].transcript
          }
        }

        if (finalText) {
          setTranscript((prev) => prev + finalText)
        }
        setInterimTranscript(interimText)
      }

      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech') {
          // 没有检测到语音，不显示错误
          return
        }
        if (event.error === 'aborted') {
          // 用户中止，不显示错误
          return
        }
        setError(`识别错误: ${event.error}`)
        cleanup()
      }

      recognition.onend = () => {
        // 如果还在录音状态（不是手动停止），可能是被系统中断
        if (isRecording) {
          cleanup()
        }
      }

      recognitionRef.current = recognition
      recognition.start()
    } catch (err) {
      setError('启动录音失败，请检查麦克风权限')
      setIsRecording(false)
    }
  }

  const stopRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // 忽略停止时的错误
      }
    }

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    // 合并最终结果
    const finalText = transcript + interimTranscript
    if (finalText.trim()) {
      onTranscript(finalText.trim())
    }

    setIsRecording(false)
    setInterimTranscript('')
    setRecordingTime(0)
  }

  // 不支持浏览器的提示
  if (showUnsupported) {
    return (
      <div className="inline-flex items-center gap-2">
        <button
          onClick={() => setShowUnsupported(false)}
          className="text-xs text-slate-400 hover:text-slate-600 underline"
        >
          关闭提示
        </button>
        <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
          您的浏览器不支持语音功能，请更换 Chrome 或 Edge 浏览器
        </span>
      </div>
    )
  }

  return (
    <div className="inline-flex flex-col gap-2">
      {/* 录音中状态 */}
      {isRecording && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {/* 录音动画 */}
          <div className="flex items-center gap-1">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
          </div>

          {/* 计时器 */}
          <span className="text-sm font-mono font-medium text-red-700">
            {formatTime(recordingTime)} / 06:00
          </span>

          {/* 实时文字预览 */}
          <span className="text-sm text-slate-600 truncate max-w-[200px]">
            {interimTranscript || transcript || '正在聆听...'}
          </span>

          {/* 结束按钮 */}
          <button
            onClick={stopRecording}
            className="ml-auto bg-red-600 hover:bg-red-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            结束录音
          </button>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <span className="text-xs text-red-600">{error}</span>
      )}

      {/* 开始录音按钮 */}
      {!isRecording && (
        <button
          onClick={startRecording}
          disabled={disabled}
          className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="语音答题"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
          语音答题
        </button>
      )}
    </div>
  )
}
