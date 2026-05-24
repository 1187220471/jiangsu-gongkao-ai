'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { getAuthHeaders } from '@/lib/auth'

interface VoiceInputProps {
  onTranscript: (text: string) => void
  disabled?: boolean
}

// 检测浏览器是否支持Web Speech API
const isBrowserSpeechSupported = () => {
  return typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
}

export default function VoiceInput({ onTranscript, disabled }: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState('')
  const [engine, setEngine] = useState<'aliyun' | 'browser'>('aliyun')
  const [elapsedTime, setElapsedTime] = useState(0)

  // Refs
  const recognitionRef = useRef<any>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)
  const wsRef = useRef<WebSocket | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)

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
    if (wsRef.current) {
      try {
        wsRef.current.close()
      } catch (e) {}
      wsRef.current = null
    }
    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.stop()
      } catch (e) {}
      mediaRecorderRef.current = null
    }
    if (processorRef.current) {
      try {
        processorRef.current.disconnect()
      } catch (e) {}
      processorRef.current = null
    }
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect()
      } catch (e) {}
      sourceRef.current = null
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close()
      } catch (e) {}
      audioContextRef.current = null
    }
  }, [])

  useEffect(() => {
    return cleanup
  }, [cleanup])

  // 开始阿里云录音
  const startAliyunRecording = useCallback(async () => {
    try {
      setError('')

      // 1. 获取Token
      const tokenRes = await fetch('/api/voice/aliyun-token', {
        headers: getAuthHeaders(),
      })
      const tokenData = await tokenRes.json()

      if (!tokenData.token) {
        setError('获取语音识别Token失败')
        return
      }

      // 2. 获取麦克风权限（指定PCM格式参数）
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      })

      // 3. 创建音频上下文和处理节点
      const audioContext = new AudioContext({ sampleRate: 16000 })
      const source = audioContext.createMediaStreamSource(stream)
      const processor = audioContext.createScriptProcessor(4096, 1, 1)

      // 4. 连接阿里云WebSocket
      const wsUrl = `wss://nls-gateway.cn-shanghai.aliyuncs.com/ws/v1?token=${tokenData.token}`
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      let fullText = ''

      ws.onopen = () => {
        console.log('阿里云WebSocket连接成功')

        // 生成符合阿里云要求的ID（32位十六进制字符串，不带横线）
        const generateId = () => {
          return Array.from({length: 32}, () => 
            Math.floor(Math.random() * 16).toString(16)
          ).join('')
        }

        const messageId = generateId()
        const taskId = generateId()

        // 发送开始识别指令
        const startCmd = {
          header: {
            message_id: messageId,
            task_id: taskId,
            namespace: 'SpeechRecognizer',
            name: 'StartRecognition',
            appkey: tokenData.appKey,
          },
          payload: {
            format: 'pcm',
            sample_rate: 16000,
            enable_intermediate_result: true,
            enable_punctuation_prediction: true,
            enable_inverse_text_normalization: true,
          },
        }
        ws.send(JSON.stringify(startCmd))

        // 开始录音 - 使用ScriptProcessor获取PCM数据
        processor.onaudioprocess = (e) => {
          if (ws.readyState === WebSocket.OPEN) {
            const inputData = e.inputBuffer.getChannelData(0)
            // 将Float32转换为Int16
            const int16Data = new Int16Array(inputData.length)
            for (let i = 0; i < inputData.length; i++) {
              const s = Math.max(-1, Math.min(1, inputData[i]))
              int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
            }
            ws.send(int16Data.buffer)
          }
        }

        // 保存引用以便清理
        sourceRef.current = source
        processorRef.current = processor
        audioContextRef.current = audioContext

        source.connect(processor)
        processor.connect(audioContext.destination)

        setIsRecording(true)
        startTimeRef.current = Date.now()
        setElapsedTime(0)

        // 启动定时器
        timerRef.current = setInterval(() => {
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
          setElapsedTime(elapsed)
          if (elapsed * 1000 >= MAX_DURATION) {
            stopRecording()
          }
        }, 1000)
      }

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        console.log('阿里云消息:', JSON.stringify(data, null, 2))

        if (data.header?.name === 'RecognitionStarted') {
          console.log('识别已开始')
        } else if (data.header?.name === 'RecognitionResultChanged') {
          // 中间结果
          const text = data.payload?.result || ''
          setTranscript(text)
        } else if (data.header?.name === 'RecognitionCompleted') {
          // 最终结果
          const text = data.payload?.result || ''
          fullText += text
          setTranscript(fullText)
          onTranscript(fullText)
        } else if (data.header?.name === 'Error') {
          console.error('阿里云识别错误:', JSON.stringify(data, null, 2))
          setError(`识别错误: ${data.payload?.message || data.header?.status_message || '未知错误'}`)
          stopRecording()
        } else {
          console.log('阿里云其他消息:', data.header?.name)
        }
      }

      ws.onerror = (error) => {
        console.error('阿里云WebSocket错误:', error)
        setError('语音识别连接错误')
        stopRecording()
      }

      ws.onclose = (event) => {
        console.log('阿里云WebSocket关闭:', event.code, event.reason)
        if (!fullText && !transcript) {
          setError(`连接已关闭 (${event.code})，请重试`)
        }
        stopRecording()
      }


    } catch (err: any) {
      console.error('启动阿里云录音失败:', err)
      setError(`启动录音失败: ${err.message || '未知错误'}`)
      cleanup()
    }
  }, [onTranscript, cleanup])

  // 停止阿里云录音
  const stopAliyunRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // 发送停止识别指令
      const stopCmd = {
        header: {
          message_id: Date.now().toString(),
          task_id: Date.now().toString(),
          namespace: 'SpeechRecognizer',
          name: 'StopRecognition',
        },
      }
      wsRef.current.send(JSON.stringify(stopCmd))
    }

    cleanup()
    setIsRecording(false)
    setTranscript('')
    setElapsedTime(0)
  }, [cleanup])

  // 开始浏览器原生录音
  const startBrowserRecording = useCallback(() => {
    setError('')

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('您的浏览器不支持语音功能，请更换Chrome或Edge浏览器')
      return
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
  }, [onTranscript, cleanup])

  // 停止浏览器原生录音
  const stopBrowserRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (transcript) {
      onTranscript(transcript)
    }
    setIsRecording(false)
    setTranscript('')
  }, [transcript, onTranscript])

  // 开始录音
  const startRecording = useCallback(() => {
    if (engine === 'aliyun') {
      startAliyunRecording()
    } else {
      startBrowserRecording()
    }
  }, [engine, startAliyunRecording, startBrowserRecording])

  // 停止录音
  const stopRecording = useCallback(() => {
    if (engine === 'aliyun') {
      stopAliyunRecording()
    } else {
      stopBrowserRecording()
    }
  }, [engine, stopAliyunRecording, stopBrowserRecording])

  // 切换引擎
  const toggleEngine = useCallback(() => {
    if (isRecording) return
    setEngine(prev => prev === 'aliyun' ? 'browser' : 'aliyun')
  }, [isRecording])

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
          {elapsedTime > 0 && (
            <span className="text-xs text-red-500">
              {elapsedTime}s
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
          {engine === 'aliyun' ? '阿里云' : '浏览器'}
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
