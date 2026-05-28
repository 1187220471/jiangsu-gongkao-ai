'use client'

import { useState, useRef } from 'react'
import { getAuthHeaders } from '@/lib/auth'

interface AudioUploaderProps {
  onTranscript: (text: string) => void
  disabled?: boolean
}

/**
 * 阿里云录音文件识别
 * 通过Web Audio API解码音频文件，然后通过WebSocket实时识别
 * 支持任意时长的音频文件
 */
export default function AudioUploader({ onTranscript, disabled }: AudioUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef(false)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 限制文件大小（20MB）
    if (file.size > 20 * 1024 * 1024) {
      setProgress('文件超过20MB，请压缩后上传')
      setTimeout(() => setProgress(''), 3000)
      return
    }

    setIsUploading(true)
    setProgress('正在准备识别...')
    abortRef.current = false

    let ws: WebSocket | null = null
    let audioContext: AudioContext | null = null

    try {
      // 1. 获取阿里云Token
      const tokenRes = await fetch('/api/voice/aliyun-token', {
        headers: getAuthHeaders(),
      })
      const tokenData = await tokenRes.json()

      if (!tokenData.token) {
        throw new Error('获取Token失败: ' + (tokenData.error || '未知错误'))
      }

      setProgress('正在解码音频...')

      // 2. 用Web Audio API解码音频文件
      const fileBuffer = await file.arrayBuffer()
      audioContext = new AudioContext()
      const audioBuffer = await audioContext.decodeAudioData(fileBuffer)

      if (abortRef.current) return

      setProgress('正在识别...')

      // 3. 连接阿里云WebSocket
      const wsUrl = `wss://nls-gateway.cn-shanghai.aliyuncs.com/ws/v1?token=${tokenData.token}`
      ws = new WebSocket(wsUrl)

      // 生成32位十六进制ID
      const generateId = () => {
        return Array.from({ length: 32 }, () =>
          Math.floor(Math.random() * 16).toString(16)
        ).join('')
      }

      const taskId = generateId()
      let fullText = ''
      let lastText = ''
      let isResolved = false // 标记是否已返回结果，防止重复resolve/reject

      // 执行识别，返回完整文字
      const transcript = await new Promise<string>((resolve, reject) => {
        // 设置总超时（5分钟）
        const timeoutId = setTimeout(() => {
          if (!isResolved) {
            isResolved = true
            reject(new Error('识别超时，请重试'))
          }
        }, 5 * 60 * 1000)

        ws!.onopen = () => {
          console.log('阿里云WebSocket连接成功')

          const messageId = generateId()

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
          ws!.send(JSON.stringify(startCmd))
          console.log('已发送StartRecognition指令')

          // 开始发送音频数据（不等待，异步发送）
          sendAudioData(ws!, audioBuffer, () => abortRef.current)
            .then(() => {
              console.log('音频数据发送完成')
              // 发送停止指令
              const stopCmd = {
                header: {
                  message_id: generateId(),
                  task_id: taskId,
                  namespace: 'SpeechRecognizer',
                  name: 'StopRecognition',
                },
              }
              ws!.send(JSON.stringify(stopCmd))
              console.log('已发送StopRecognition指令')
            })
            .catch((err) => {
              if (!isResolved) {
                isResolved = true
                clearTimeout(timeoutId)
                reject(err)
              }
            })
        }

        ws!.onmessage = (event) => {
          const data = JSON.parse(event.data)
          const name = data.header?.name
          console.log('阿里云消息:', name, data.header?.status_code || '')

          if (name === 'RecognitionStarted') {
            console.log('识别已开始')
          } else if (name === 'RecognitionResultChanged') {
            const text = data.payload?.result || ''
            if (text) {
              const newPart = getIncrementalText(lastText, text)
              lastText = text
              fullText = text
              if (newPart) {
                onTranscript(newPart)
              }
            }
          } else if (name === 'RecognitionCompleted') {
            const text = data.payload?.result || ''
            if (text) {
              fullText = text
              const correction = getIncrementalText(lastText, text)
              if (correction) {
                onTranscript(correction)
              }
            }
            console.log('识别完成，最终文本:', fullText)
            if (!isResolved) {
              isResolved = true
              clearTimeout(timeoutId)
              resolve(fullText)
            }
          } else if (name === 'Error') {
            const errMsg = data.payload?.message || data.header?.status_message || '未知识别错误'
            console.error('阿里云识别错误:', errMsg)
            if (!isResolved) {
              isResolved = true
              clearTimeout(timeoutId)
              reject(new Error(errMsg))
            }
          } else if (name === 'TaskFailed') {
            const errMsg = data.payload?.message || '任务失败'
            console.error('阿里云任务失败:', errMsg)
            if (!isResolved) {
              isResolved = true
              clearTimeout(timeoutId)
              reject(new Error(errMsg))
            }
          }
        }

        ws!.onerror = (error) => {
          console.error('阿里云WebSocket错误:', error)
          if (!isResolved) {
            isResolved = true
            clearTimeout(timeoutId)
            reject(new Error('WebSocket连接错误'))
          }
        }

        ws!.onclose = (closeEvent) => {
          console.log('阿里云WebSocket关闭:', closeEvent.code, closeEvent.reason)
          // 如果已经有完整结果，正常结束
          if (fullText && !isResolved) {
            isResolved = true
            clearTimeout(timeoutId)
            resolve(fullText)
          } else if (!isResolved) {
            isResolved = true
            clearTimeout(timeoutId)
            reject(new Error(`连接已关闭 (${closeEvent.code})，未获取到识别结果`))
          }
        }
      })

      setProgress('识别完成')
      if (transcript) {
        console.log('上传录音识别结果:', transcript)
      }
    } catch (err: any) {
      console.error('录音识别失败:', err)
      setProgress('识别失败: ' + err.message)
    } finally {
      // 清理资源
      if (ws) {
        try { ws.close() } catch (e) {}
        ws = null
      }
      if (audioContext) {
        try { audioContext.close() } catch (e) {}
        audioContext = null
      }
      setIsUploading(false)
      if (inputRef.current) inputRef.current.value = ''
      setTimeout(() => setProgress(''), 3000)
    }
  }

  // 发送音频数据（将AudioBuffer分块发送）
  async function sendAudioData(
    ws: WebSocket,
    audioBuffer: AudioBuffer,
    isAborted: () => boolean
  ): Promise<void> {
    const targetSampleRate = 16000
    const channelData = audioBuffer.getChannelData(0) // 取第一声道

    // 重采样到16000Hz（如果原始采样率不同）
    let resampledData: Float32Array
    if (audioBuffer.sampleRate !== targetSampleRate) {
      resampledData = resampleAudio(channelData, audioBuffer.sampleRate, targetSampleRate)
      console.log(`重采样: ${audioBuffer.sampleRate}Hz → ${targetSampleRate}Hz, ${resampledData.length} 样本`)
    } else {
      resampledData = channelData
    }

    // 分块发送，每块约100ms的数据（1600个样本）
    const chunkSize = 1600
    const totalChunks = Math.ceil(resampledData.length / chunkSize)
    console.log(`开始发送音频数据: ${totalChunks} 块, ${resampledData.length} 样本`)

    // 等待StartRecognition确认后再发送音频数据
    await new Promise<void>((resolve) => {
      const checkReady = () => {
        if (ws.readyState === WebSocket.OPEN) {
          resolve()
        } else {
          setTimeout(checkReady, 100)
        }
      }
      checkReady()
    })

    for (let i = 0; i < totalChunks; i++) {
      if (isAborted()) {
        throw new Error('识别已取消')
      }

      if (ws.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket已断开')
      }

      const start = i * chunkSize
      const end = Math.min(start + chunkSize, resampledData.length)
      const chunk = resampledData.slice(start, end)

      // Float32转Int16
      const int16Data = new Int16Array(chunk.length)
      for (let j = 0; j < chunk.length; j++) {
        const s = Math.max(-1, Math.min(1, chunk[j]))
        int16Data[j] = s < 0 ? s * 0x8000 : s * 0x7FFF
      }

      ws.send(int16Data.buffer)

      // 控制发送速度：每100ms发送100ms的数据（实时速率）
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 10))
      }

      // 更新进度
      if (i % Math.max(1, Math.floor(totalChunks / 50)) === 0) {
        const pct = Math.round((i / totalChunks) * 100)
        setProgress(`识别中...${pct}%`)
      }
    }

    console.log('音频数据全部发送完成')
  }

  // 简单的线性重采样
  function resampleAudio(input: Float32Array, inputRate: number, outputRate: number): Float32Array {
    if (inputRate === outputRate) return input

    const ratio = inputRate / outputRate
    const outputLength = Math.floor(input.length / ratio)
    const output = new Float32Array(outputLength)

    for (let i = 0; i < outputLength; i++) {
      const inputIndex = i * ratio
      const index = Math.floor(inputIndex)
      const fraction = inputIndex - index

      if (index + 1 < input.length) {
        output[i] = input[index] * (1 - fraction) + input[index + 1] * fraction
      } else {
        output[i] = input[index]
      }
    }

    return output
  }

  // 计算增量文本（和VoiceInput.tsx用同样的算法）
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
