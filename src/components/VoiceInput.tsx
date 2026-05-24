'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface VoiceInputProps {
  onTranscript: (text: string) => void
  disabled?: boolean
  mode?: 'xfyun' | 'browser'
}

// 检测浏览器是否支持Web Speech API
const isBrowserSpeechSupported = () => {
  return typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
}

export default function VoiceInput({ onTranscript, disabled, mode = 'browser' }: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState('')
  const [engine, setEngine] = useState<'xfyun' | 'browser'>(mode)
  const [showTips, setShowTips] = useState(false)

  // Refs
  const recognitionRef = useRef<any>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)
  const xfyunRecognizerRef = useRef<any>(null)

  // 6分钟超时
  const MAX_DURATION = 6 * 60 * 1000

  // 清理函数
  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch (e) {}
      recognitionRef.current = null
    }
    if (xfyunRecognizerRef.current) {
      try {
        xfyunRecognizerRef.current.destroy()
      } catch (e) {}
      xfyunRecognizerRef.current = null
    }
  }, [])

  useEffect(() => {
    return cleanup
  }, [cleanup])

  // 开始浏览器原生录音
  const startBrowserRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('您的浏览器不支持语音功能，请更换Chrome或Edge浏览器')
      return false
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'zh-CN'

    recognition.onstart = () => {
      setIsRecording(true)
      setError('')
      setTranscript('')
      startTimeRef.current = Date.now()

      // 启动定时器，6分钟超时
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current
        if (elapsed >= MAX_DURATION) {
          stopRecording()
        }
      }, 1000)
    }

    recognition.onresult = (event: any) => {
      let finalTranscript = ''
      let interimTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript
        } else {
          interimTranscript += transcript
        }
      }

      const displayText = finalTranscript || interimTranscript
      setTranscript(displayText)

      if (finalTranscript) {
        onTranscript(finalTranscript)
        setTranscript('')
      }
    }

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error)
      if (event.error === 'no-speech') {
        // 无语音输入，可以继续
        return
      }
      if (event.error === 'not-allowed') {
        setError('麦克风权限被拒绝，请在浏览器设置中允许使用麦克风')
      } else {
        setError(`语音识别错误: ${event.error}`)
      }
      setIsRecording(false)
      cleanup()
    }

    recognition.onend = () => {
      setIsRecording(false)
      cleanup()
    }

    recognitionRef.current = recognition
    recognition.start()
    return true
  }, [onTranscript, cleanup])

  // 停止浏览器原生录音
  const stopBrowserRecognition = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    // 如果还有临时文字没发送，发送它
    if (transcript) {
      onTranscript(transcript)
    }
    setIsRecording(false)
    setTranscript('')
  }, [transcript, onTranscript])

  // 开始讯飞录音
  const startXfyunRecognition = useCallback(async () => {
    try {
      // 动态导入SDK
      const { XfyunASR } = await import('xfyun-sdk')

      const recognizer = new XfyunASR({
        appId: '57c0ec9c',
        apiKey: 'b7ed51fb8d8a0bbb7277278f6e120bfb',
        apiSecret: 'NjQxZjgzNzdlNWZkNjM3NWQ3ZTA0MzI1',
        language: 'zh_cn',
        domain: 'iat',
        accent: 'mandarin',
        vadEos: 5000, // 5秒静音停止
        enableReconnect: false,
        maxAudioSize: 30 * 1024 * 1024, // 30MB
      }, {
        onStart: () => {
          setIsRecording(true)
          setError('')
          setTranscript('')
          startTimeRef.current = Date.now()

          // 启动定时器，6分钟超时
          timerRef.current = setInterval(() => {
            const elapsed = Date.now() - startTimeRef.current
            if (elapsed >= MAX_DURATION) {
              stopRecording()
            }
          }, 1000)
        },
        onRecognitionResult: (text: string, isEnd: boolean) => {
          console.log('讯飞识别结果:', text, isEnd)
          setTranscript(text)
          if (isEnd) {
            onTranscript(text)
            setTranscript('')
          }
        },
        onProcess: (volume: number) => {
          // 音量回调，可用于显示音量指示
        },
        onError: (err: any) => {
          console.error('讯飞识别错误:', err)
          setError(`讯飞识别错误: ${err.message || err.desc || '未知错误'}`)
          setIsRecording(false)
          cleanup()
        },
        onStateChange: (state: string) => {
          console.log('讯飞状态:', state)
        }
      })

      xfyunRecognizerRef.current = recognizer

      await recognizer.start()

    } catch (err: any) {
      console.error('启动讯飞识别失败:', err)
      setError(`启动讯飞识别失败: ${err.message || '未知错误'}`)
      cleanup()
    }
  }, [onTranscript, cleanup])

  // 停止讯飞录音
  const stopXfyunRecognition = useCallback(async () => {
    if (xfyunRecognizerRef.current) {
      try {
        await xfyunRecognizerRef.current.stop()
        // 如果还有临时文字没发送，发送它
        if (transcript) {
          onTranscript(transcript)
        }
      } catch (err) {
        console.error('停止讯飞识别失败:', err)
      }
      xfyunRecognizerRef.current = null
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setIsRecording(false)
    setTranscript('')
  }, [transcript, onTranscript])

  // 开始录音
  const startRecording = useCallback(async () => {
    setError('')

    if (engine === 'xfyun') {
      await startXfyunRecognition()
    } else {
      startBrowserRecognition()
    }
  }, [engine, startBrowserRecognition, startXfyunRecognition])

  // 停止录音
  const stopRecording = useCallback(async () => {
    if (engine === 'xfyun') {
      await stopXfyunRecognition()
    } else {
      stopBrowserRecognition()
    }
  }, [engine, stopBrowserRecognition, stopXfyunRecognition])

  // 切换引擎
  const toggleEngine = useCallback(() => {
    if (isRecording) return
    const newEngine = engine === 'browser' ? 'xfyun' : 'browser'
    setEngine(newEngine)
    setShowTips(newEngine === 'xfyun')
  }, [engine, isRecording])

  // 渲染
  return (
    <div className="inline-flex items-center gap-2">
      {isRecording && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg">
          {/* 录音指示器 */}
          <div className="flex gap-0.5 items-end h-4">
            <div className="w-0.5 h-2 bg-red-500 rounded animate-pulse" style={{ animationDuration: '0.5s' }}></div>
            <div className="w-0.5 h-3 bg-red-500 rounded animate-pulse" style={{ animationDuration: '0.7s' }}></div>
            <div className="w-0.5 h-1.5 bg-red-500 rounded animate-pulse" style={{ animationDuration: '0.3s' }}></div>
            <div className="w-0.5 h-2.5 bg-red-500 rounded animate-pulse" style={{ animationDuration: '0.6s' }}></div>
          </div>
          <span className="text-xs text-red-600 font-medium">录音中</span>
          {/* 计时器 */}
          {startTimeRef.current > 0 && (
            <span className="text-xs text-red-500">
              {Math.floor((Date.now() - startTimeRef.current) / 1000)}s
            </span>
          )}
        </div>
      )}

      {/* 切换引擎按钮 */}
      {!disabled && (
        <button
          onClick={toggleEngine}
          disabled={isRecording}
          className="text-xs px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50"
          title="切换语音引擎"
        >
          {engine === 'xfyun' ? '讯飞' : '浏览器'}
        </button>
      )}

      {/* 主按钮 */}
      {!disabled && (
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            isRecording
              ? 'bg-red-100 text-red-700 border border-red-200 hover:bg-red-150'
              : 'bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100'
          }`}
        >
          {isRecording ? (
            <>
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              结束录音
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              语音答题
            </>
          )}
        </button>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-100 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm shadow-lg z-50">
          {error}
        </div>
      )}
    </div>
  )
}
