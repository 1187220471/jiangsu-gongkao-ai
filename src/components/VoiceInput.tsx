'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { getAuthHeaders } from '@/lib/auth'

interface VoiceInputProps {
  onTranscript: (text: string) => void
  disabled?: boolean
  onRecordingChange?: (recording: boolean) => void
}

/**
 * 计算增量文本：阿里云语音识别返回的文本可能包含对前面内容的修正，
 * 不能简单用 startsWith，需要用最长公共后缀找到真正的增量部分。
 */
function getIncrementalText(last: string, current: string): string {
  if (!last) return current
  if (current === last) return ''

  let commonLen = 0
  const minLen = Math.min(last.length, current.length)
  for (let i = 1; i <= minLen; i++) {
    if (last[last.length - i] === current[current.length - i]) {
      commonLen++
    } else {
      break
    }
  }

  if (commonLen >= 2) {
    const lastPrefix = last.slice(0, last.length - commonLen)
    const currentPrefix = current.slice(0, current.length - commonLen)
    if (currentPrefix.startsWith(lastPrefix)) {
      return current.slice(lastPrefix.length)
    }
    return current.slice(Math.max(0, last.length - commonLen))
  }

  if (current.startsWith(last)) {
    return current.slice(last.length)
  }

  return current
}

export default function VoiceInput({ onTranscript, disabled, onRecordingChange }: VoiceInputProps) {
  // 录音状态：idle / recording / paused
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'paused'>('idle')
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState('')
  const [engine, setEngine] = useState<'aliyun' | 'browser'>('aliyun')
  const [elapsedTime, setElapsedTime] = useState(0)

  // Refs
  const recognitionRef = useRef<any>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const pauseStartRef = useRef<number>(0)    // 暂停开始时间，用于计算暂停时长
  const totalPauseRef = useRef<number>(0)    // 累计暂停时长
  const startTimeRef = useRef<number>(0)
  const wsRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)  // 保存 MediaStream 以便暂停后恢复
  const fullTextRef = useRef<string>('')
  const lastTextRef = useRef<string>('')
  // 暂停/恢复时需要跨会话累积文本
  const accumulatedTextRef = useRef<string>('')
  // 是否正在主动暂停（区分"用户点暂停"和"阿里云 WS 自动 close"）
  const pausingRef = useRef<boolean>(false)
  // 录音状态 ref（供 WS 回调使用，避免闭包陈旧值）
  const recordingStateRef = useRef<'idle' | 'recording' | 'paused'>('idle')

  // 同步 state → ref
  useEffect(() => {
    recordingStateRef.current = recordingState
  }, [recordingState])

  const MAX_DURATION = 6 * 60 * 1000

  // ==================== 清理 ====================
  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch (e) {}
      recognitionRef.current = null
    }
    if (wsRef.current) {
      try { wsRef.current.close() } catch (e) {}
      wsRef.current = null
    }
    if (processorRef.current) {
      try { processorRef.current.disconnect() } catch (e) {}
      processorRef.current = null
    }
    if (sourceRef.current) {
      try { sourceRef.current.disconnect() } catch (e) {}
      sourceRef.current = null
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close() } catch (e) {}
      audioContextRef.current = null
    }
    // 停止 MediaStream 的所有轨道，释放麦克风
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [])

  useEffect(() => {
    return cleanup
  }, [cleanup])

  // 通知父组件录音状态
  useEffect(() => {
    onRecordingChange?.(recordingState === 'recording')
  }, [recordingState, onRecordingChange])

  // ==================== 阿里云 ====================
  const startAliyunRecording = useCallback(async (isResume: boolean = false) => {
    try {
      setError('')

      // 获取 Token
      const tokenRes = await fetch('/api/voice/aliyun-token', {
        headers: getAuthHeaders(),
      })
      const tokenData = await tokenRes.json()
      if (!tokenData.token) {
        setError('获取语音识别Token失败')
        return
      }

      // 获取麦克风（暂停恢复时复用已有 stream；新开始才申请）
      let stream = streamRef.current
      if (!stream || !stream.active) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
          }
        })
        streamRef.current = stream
      }

      const audioContext = new AudioContext({ sampleRate: 16000 })
      const source = audioContext.createMediaStreamSource(stream)
      const processor = audioContext.createScriptProcessor(4096, 1, 1)

      const wsUrl = `wss://nls-gateway.cn-shanghai.aliyuncs.com/ws/v1?token=${tokenData.token}`
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      if (!isResume) {
        accumulatedTextRef.current = ''
      }
      fullTextRef.current = ''
      lastTextRef.current = ''

      ws.onopen = () => {
        const generateId = () =>
          Array.from({ length: 32 }, () =>
            Math.floor(Math.random() * 16).toString(16)
          ).join('')

        const startCmd = {
          header: {
            message_id: generateId(),
            task_id: generateId(),
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

        processor.onaudioprocess = (e) => {
          if (ws.readyState === WebSocket.OPEN) {
            const inputData = e.inputBuffer.getChannelData(0)
            const int16Data = new Int16Array(inputData.length)
            for (let i = 0; i < inputData.length; i++) {
              const s = Math.max(-1, Math.min(1, inputData[i]))
              int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
            }
            ws.send(int16Data.buffer)
          }
        }

        sourceRef.current = source
        processorRef.current = processor
        audioContextRef.current = audioContext

        source.connect(processor)
        processor.connect(audioContext.destination)

        setRecordingState('recording')
        if (!isResume) {
          startTimeRef.current = Date.now()
          totalPauseRef.current = 0
          setElapsedTime(0)
        } else {
          // 恢复：从暂停中扣除的时间重新开始计时
          // startTime 保持不变，totalPause 已累加
        }

        timerRef.current = setInterval(() => {
          const now = Date.now()
          const effectiveElapsed = Math.floor((now - startTimeRef.current - totalPauseRef.current) / 1000)
          setElapsedTime(effectiveElapsed)
          if (effectiveElapsed * 1000 >= MAX_DURATION) {
            stopRecording()
          }
        }, 1000)
      }

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        if (data.header?.name === 'RecognitionResultChanged') {
          const text = data.payload?.result || ''
          if (text) {
            const newPart = getIncrementalText(lastTextRef.current, text)
            lastTextRef.current = text
            fullTextRef.current = text
            setTranscript(accumulatedTextRef.current + text)
            if (newPart) {
              onTranscript(newPart)
            }
          }
        } else if (data.header?.name === 'RecognitionCompleted') {
          const text = data.payload?.result || ''
          if (text) {
            fullTextRef.current = text
          }
          setTranscript(accumulatedTextRef.current + text)
          const correction = getIncrementalText(lastTextRef.current, text)
          if (correction) {
            onTranscript(correction)
          }
        } else if (data.header?.name === 'Error') {
          setError(`识别错误: ${data.payload?.message || data.header?.status_message || '未知错误'}`)
          stopRecording()
        }
      }

      ws.onerror = () => {
        setError('语音识别连接错误')
        stopRecording()
      }

      ws.onclose = (event) => {
        console.log('[VoiceInput] WS closed, code:', event.code, 'state:', recordingStateRef.current, 'pausing:', pausingRef.current)
        // 主动暂停导致的 close，不处理
        if (pausingRef.current) {
          pausingRef.current = false
          return
        }
        if (!fullTextRef.current && !transcript) {
          setError(`连接已关闭 (${event.code})，请重试`)
        }
        // 自动 close（如阿里云分段重连），不停止录音，由上层管理
        if (recordingStateRef.current === 'recording') {
          // 不调用 stopRecording()，让录音继续
          // 阿里云长语音分17段时，每段 WS close 后会自动重连新 WS
        }
      }
    } catch (err: any) {
      console.error('启动阿里云录音失败:', err)
      setError(`启动录音失败: ${err.message || '未知错误'}`)
      cleanup()
      setRecordingState('idle')
    }
  }, [onTranscript, cleanup, transcript])

  const stopAliyunRecording = useCallback(() => {
    // 断开音频处理
    if (processorRef.current) {
      try { processorRef.current.disconnect() } catch (e) {}
      processorRef.current = null
    }
    if (sourceRef.current) {
      try { sourceRef.current.disconnect() } catch (e) {}
      sourceRef.current = null
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close() } catch (e) {}
      audioContextRef.current = null
    }

    // 发送停止识别并关闭 WS
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        header: {
          message_id: Date.now().toString(),
          task_id: Date.now().toString(),
          namespace: 'SpeechRecognizer',
          name: 'StopRecognition',
        },
      }))
      setTimeout(() => {
        if (wsRef.current) {
          wsRef.current.close()
          wsRef.current = null
        }
        // 补发最终文本
        if (fullTextRef.current) {
          const correction = getIncrementalText(lastTextRef.current, fullTextRef.current)
          if (correction) {
            onTranscript(correction)
          }
        }
        // 释放麦克风
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop())
          streamRef.current = null
        }
      }, 2000)
    } else {
      cleanup()
    }

    setRecordingState('idle')
    setElapsedTime(0)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [cleanup, onTranscript])

  // ==================== 浏览器原生 ====================
  const startBrowserRecording = useCallback((isResume: boolean = false) => {
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
      setRecordingState('recording')
      if (!isResume) {
        accumulatedTextRef.current = ''
        startTimeRef.current = Date.now()
        totalPauseRef.current = 0
        setTranscript('')
        setElapsedTime(0)
      }
      timerRef.current = setInterval(() => {
        const now = Date.now()
        const effectiveElapsed = Math.floor((now - startTimeRef.current - totalPauseRef.current) / 1000)
        setElapsedTime(effectiveElapsed)
        if (effectiveElapsed * 1000 >= MAX_DURATION) {
          stopRecording()
        }
      }, 1000)
    }

    recognition.onresult = (event: any) => {
      let finalTranscript = ''
      let interimTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += t
        } else {
          interimTranscript += t
        }
      }
      const displayText = finalTranscript || interimTranscript
      setTranscript(accumulatedTextRef.current + displayText)
      if (finalTranscript) {
        accumulatedTextRef.current += finalTranscript
        onTranscript(finalTranscript)
        setTranscript(accumulatedTextRef.current)
      }
    }

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') return
      if (event.error === 'not-allowed') {
        setError('麦克风权限被拒绝，请在浏览器设置中允许使用麦克风')
      } else {
        setError(`语音识别错误: ${event.error}`)
      }
      setRecordingState('idle')
      cleanup()
    }

    recognition.onend = () => {
      // 浏览器引擎的 onend 可能在暂停时触发，不改变状态
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [onTranscript, cleanup])

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
    setRecordingState('idle')
    setTranscript('')
    setElapsedTime(0)
  }, [transcript, onTranscript])

  // ==================== 暂停 / 继续 ====================
  const pauseRecording = useCallback(() => {
    if (recordingState !== 'recording') return

    // 标记主动暂停
    pausingRef.current = true

    // 保存当前累积文本
    accumulatedTextRef.current += fullTextRef.current
    fullTextRef.current = ''
    lastTextRef.current = ''

    // 停止计时器
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    pauseStartRef.current = Date.now()

    // 暂停：断开音频链路 + 关闭 WS（不释放 MediaStream）
    if (processorRef.current) {
      try { processorRef.current.disconnect() } catch (e) {}
      processorRef.current = null
    }
    if (sourceRef.current) {
      try { sourceRef.current.disconnect() } catch (e) {}
      sourceRef.current = null
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close() } catch (e) {}
      audioContextRef.current = null
    }

    if (engine === 'aliyun') {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          header: {
            message_id: Date.now().toString(),
            task_id: Date.now().toString(),
            namespace: 'SpeechRecognizer',
            name: 'StopRecognition',
          },
        }))
        setTimeout(() => {
          if (wsRef.current) {
            wsRef.current.close()
            wsRef.current = null
          }
        }, 1500)
      }
    } else {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
        recognitionRef.current = null
      }
    }

    setRecordingState('paused')
  }, [recordingState, engine])

  const resumeRecording = useCallback(() => {
    if (recordingState !== 'paused') return

    // 累加暂停时长
    totalPauseRef.current += Date.now() - pauseStartRef.current

    if (engine === 'aliyun') {
      // 阿里云需要全新 WS 会话（token 可能过期，重新获取）
      startAliyunRecording(true)
    } else {
      startBrowserRecording(true)
    }
  }, [recordingState, engine, startAliyunRecording, startBrowserRecording])

  // ==================== 开始 / 停止 ====================
  const startRecording = useCallback(() => {
    if (engine === 'aliyun') {
      startAliyunRecording(false)
    } else {
      startBrowserRecording(false)
    }
  }, [engine, startAliyunRecording, startBrowserRecording])

  const stopRecording = useCallback(() => {
    if (engine === 'aliyun') {
      stopAliyunRecording()
    } else {
      stopBrowserRecording()
    }
  }, [engine, stopAliyunRecording, stopBrowserRecording])

  const toggleEngine = useCallback(() => {
    if (recordingState !== 'idle') return
    setEngine(prev => prev === 'aliyun' ? 'browser' : 'aliyun')
  }, [recordingState])

  // ==================== 渲染 ====================
  const isRecording = recordingState === 'recording'
  const isPaused = recordingState === 'paused'

  return (
    <div className="relative inline-block">
      <div className="inline-flex items-center gap-2">
        {/* 录音中指示器 */}
        {isRecording && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex gap-0.5 items-end h-4">
              <div className="w-0.5 h-2 bg-red-500 rounded animate-pulse" style={{ animationDuration: '0.5s' }} />
              <div className="w-0.5 h-3 bg-red-500 rounded animate-pulse" style={{ animationDuration: '0.7s' }} />
              <div className="w-0.5 h-1.5 bg-red-500 rounded animate-pulse" style={{ animationDuration: '0.3s' }} />
              <div className="w-0.5 h-2.5 bg-red-500 rounded animate-pulse" style={{ animationDuration: '0.6s' }} />
            </div>
            <span className="text-xs text-red-600 font-medium">录音中</span>
            {elapsedTime > 0 && (
              <span className="text-xs text-red-500">{elapsedTime}s</span>
            )}
          </div>
        )}

        {/* 暂停中指示器 */}
        {isPaused && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
            <span className="text-xs text-amber-600 font-medium">已暂停</span>
            {elapsedTime > 0 && (
              <span className="text-xs text-amber-500">{elapsedTime}s</span>
            )}
          </div>
        )}

        {/* 切换引擎按钮 */}
        {!disabled && recordingState === 'idle' && (
          <button
            onClick={toggleEngine}
            className="text-xs px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50"
            title="切换语音引擎"
          >
            {engine === 'aliyun' ? '阿里云' : '浏览器'}
          </button>
        )}

        {/* 主按钮区 */}
        {!disabled && (
          <>
            {/* 暂停按钮（录音中时显示）*/}
            {isRecording && (
              <button
                onClick={pauseRecording}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200 transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
                暂停
              </button>
            )}

            {/* 继续按钮（暂停中时显示）*/}
            {isPaused && (
              <button
                onClick={resumeRecording}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-green-100 text-green-700 border border-green-200 hover:bg-green-200 transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <polygon points="6,4 20,12 6,20" />
                </svg>
                继续
              </button>
            )}

            {/* 结束按钮（录音中或暂停中时显示）*/}
            {(isRecording || isPaused) && (
              <button
                onClick={stopRecording}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-100 text-red-700 border border-red-200 hover:bg-red-200 transition-colors"
              >
                <span className="w-2 h-2 bg-red-500 rounded-full" />
                结束
              </button>
            )}

            {/* 开始按钮（空闲时显示）*/}
            {recordingState === 'idle' && (
              <button
                onClick={startRecording}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                语音答题
              </button>
            )}
          </>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-100 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm shadow-lg z-50">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
