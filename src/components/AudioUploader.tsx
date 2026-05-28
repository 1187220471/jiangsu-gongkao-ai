'use client'

import { useState, useRef } from 'react'
import { getAuthHeaders } from '@/lib/auth'

interface AudioUploaderProps {
  onTranscript: (text: string) => void
  disabled?: boolean
}

const SAMPLE_RATE = 16000
const CHUNK_SIZE = 1600       // 100ms of audio
const CHUNK_INTERVAL = 100     // 100ms per chunk = 1x real-time speed
const SEGMENT_DURATION = 30    // 30 seconds per segment
const SEGMENT_SAMPLES = SAMPLE_RATE * SEGMENT_DURATION // 480000 samples

/**
 * 阿里云录音文件识别（分片版）
 * 通过Web Audio API解码音频文件，按30秒分片，每片独立WebSocket会话
 * 解决 TOO_LONG_SPEECH (41010104) 错误
 */
export default function AudioUploader({ onTranscript, disabled }: AudioUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef(false)

  /** 生成32位十六进制ID（阿里云要求） */
  const generateId = () =>
    Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')

  /** 识别一段音频PCM数据（30秒），返回该段识别文字 */
  const recognizeSegment = async (
    pcmData: Float32Array,
    segmentIndex: number,
    token: string,
    appKey: string,
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const wsUrl = `wss://nls-gateway.cn-shanghai.aliyuncs.com/ws/v1?token=${token}`
      const ws = new WebSocket(wsUrl)
      const taskId = generateId()

      let segmentFullText = ''
      let segmentLastText = ''
      let isDone = false

      const safeResolve = (text: string) => {
        if (!isDone) { isDone = true; resolve(text) }
      }
      const safeReject = (err: Error) => {
        if (!isDone) { isDone = true; reject(err) }
      }

      // 超时保护（每段最多90秒）
      const timeoutId = setTimeout(() => {
        safeReject(new Error(`第${segmentIndex + 1}段识别超时`))
      }, 90 * 1000)

      let audioStarted = false // 标记是否已开始发送音频数据

      ws.onopen = () => {
        console.log(`[段${segmentIndex + 1}] WebSocket已连接, appKey="${appKey}", 长度=${appKey?.length || 0}`)
        const startCmd = {
          header: {
            message_id: generateId(),
            task_id: taskId,
            namespace: 'SpeechRecognizer',
            name: 'StartRecognition',
            appkey: appKey,
          },
          payload: {
            format: 'pcm',
            sample_rate: SAMPLE_RATE,
            enable_intermediate_result: true,
            enable_punctuation_prediction: true,
            enable_inverse_text_normalization: true,
          },
        }
        const cmdStr = JSON.stringify(startCmd)
        console.log(`[段${segmentIndex + 1}] StartRecognition命令:`, cmdStr)
        ws.send(cmdStr)
        // ⚠️ 不在这里发送音频数据！
        // 必须等收到 RecognitionStarted 后才发送（见 onmessage）
      }

      ws.onmessage = (event) => {
        // 打印完整的原始消息用于调试
        console.log(`[段${segmentIndex + 1}] 阿里云原始消息:`, event.data)
        let data: any
        try {
          data = JSON.parse(event.data)
        } catch {
          console.warn(`[段${segmentIndex + 1}] ⚠️ 无法解析:`, event.data)
          return
        }
        const name = data.header?.name
        const statusCode = data.header?.status_code || ''
        const statusText = data.header?.status_text || ''
        console.log(`[段${segmentIndex + 1}] 类型=${name}, 状态码=${statusCode}, 状态=${statusText}`)

        if (name === 'RecognitionStarted') {
          console.log(`[段${segmentIndex + 1}] ✅ 识别已开始, 开始发送音频数据`)
          if (!audioStarted) {
            audioStarted = true
            sendSegmentData(ws, pcmData).then(() => {
              console.log(`[段${segmentIndex + 1}] 音频数据发送完成，发送StopRecognition`)
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  header: {
                    message_id: generateId(),
                    task_id: taskId,
                    namespace: 'SpeechRecognizer',
                    name: 'StopRecognition',
                    appkey: appKey,
                  },
                }))
              }
            }).catch(safeReject)
          }
        } else if (name === 'RecognitionResultChanged') {
          const text = data.payload?.result || ''
          if (text) {
            segmentFullText = text
            const newPart = getIncrementalText(segmentLastText, text)
            segmentLastText = text
            if (newPart) onTranscript(newPart)
          }
        } else if (name === 'RecognitionCompleted') {
          const text = data.payload?.result || ''
          if (text) {
            segmentFullText = text
            const correction = getIncrementalText(segmentLastText, text)
            if (correction) onTranscript(correction)
          }
          clearTimeout(timeoutId)
          ws.close()
          safeResolve(segmentFullText)
        } else if (name === 'TaskFailed' || name === 'Error') {
          const errMsg = data.payload?.message || data.payload?.status_text || data.header?.status_message || ''
          const errCode = data.header?.status_code || ''
          console.error(`[段${segmentIndex + 1}] ❌ 阿里云错误: 码=${errCode}, 消息=${errMsg}`)
          console.error(`[段${segmentIndex + 1}] ❌ 完整错误数据:`, JSON.stringify(data, null, 2))
          clearTimeout(timeoutId)
          safeReject(new Error(`第${segmentIndex + 1}段: [${errCode}] ${errMsg}`))
        } else {
          // 打印未处理的消息类型
          console.log(`[段${segmentIndex + 1}] 🔔 未处理消息:`, JSON.stringify(data, null, 2))
        }
      }

      ws.onerror = (error) => {
        console.error(`[段${segmentIndex + 1}] 🔌 WebSocket error事件:`, error)
        safeReject(new Error(`第${segmentIndex + 1}段WebSocket连接错误`))
      }
      ws.onclose = (closeEvent) => {
        console.log(`[段${segmentIndex + 1}] 🔒 WebSocket关闭: 码=${closeEvent.code}, 原因="${closeEvent.reason}", 已识别文本="${segmentFullText}"`)
        clearTimeout(timeoutId)
        if (!isDone) safeResolve(segmentFullText)
      }
    })
  }

  /** 发送一段PCM数据到WebSocket（分块发送+实时速率控制） */
  async function sendSegmentData(ws: WebSocket, pcmData: Float32Array): Promise<void> {
    const totalChunks = Math.ceil(pcmData.length / CHUNK_SIZE)

    for (let i = 0; i < totalChunks; i++) {
      if (abortRef.current) throw new Error('识别已取消')
      if (ws.readyState !== WebSocket.OPEN) throw new Error('WebSocket已断开')

      const start = i * CHUNK_SIZE
      const end = Math.min(start + CHUNK_SIZE, pcmData.length)
      const chunk = pcmData.slice(start, end)

      // Float32 → Int16 (PCM 16bit)
      const int16Data = new Int16Array(chunk.length)
      for (let j = 0; j < chunk.length; j++) {
        const s = Math.max(-1, Math.min(1, chunk[j]))
        int16Data[j] = s < 0 ? s * 0x8000 : s * 0x7FFF
      }

      ws.send(int16Data.buffer)

      // 每块等待 CHUNK_INTERVAL ms（2x实时速率，提速不超限）
      await new Promise(r => setTimeout(r, CHUNK_INTERVAL))
    }
  }

  // ---- 主入口 ----
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 20 * 1024 * 1024) {
      setProgress('文件超过20MB，请压缩后上传')
      setTimeout(() => setProgress(''), 3000)
      return
    }

    setIsUploading(true)
    setProgress('正在准备识别...')
    abortRef.current = false

    let audioContext: AudioContext | null = null

    try {
      // 1. 获取Token
      const tokenRes = await fetch('/api/voice/aliyun-token', { headers: getAuthHeaders() })
      const tokenData = await tokenRes.json()
      if (!tokenData.token) throw new Error('获取Token失败: ' + (tokenData.error || '未知错误'))

      // 2. 解码音频
      setProgress('正在解码音频...')
      const fileBuffer = await file.arrayBuffer()
      audioContext = new AudioContext()
      const audioBuffer = await audioContext.decodeAudioData(fileBuffer)
      if (abortRef.current) return

      // 3. 提取并重采样到16000Hz
      const channelData = audioBuffer.getChannelData(0)
      let pcmData: Float32Array
      if (audioBuffer.sampleRate !== SAMPLE_RATE) {
        pcmData = resampleAudio(channelData, audioBuffer.sampleRate, SAMPLE_RATE)
        console.log(`重采样: ${audioBuffer.sampleRate}Hz → ${SAMPLE_RATE}Hz, ${pcmData.length} 样本`)
      } else {
        pcmData = channelData
      }

      // 4. 计算总时长和段数
      const totalSeconds = Math.round(pcmData.length / SAMPLE_RATE)
      const totalSegments = Math.ceil(pcmData.length / SEGMENT_SAMPLES)
      console.log(`音频时长: ${totalSeconds}s, 共${totalSegments}段`)

      // 5. 逐段识别
      let fullTranscript = ''
      for (let segIdx = 0; segIdx < totalSegments; segIdx++) {
        if (abortRef.current) break

        const segStart = segIdx * SEGMENT_SAMPLES
        const segEnd = Math.min(segStart + SEGMENT_SAMPLES, pcmData.length)
        const segmentPcm = pcmData.slice(segStart, segEnd)

        setProgress(`识别中...第 ${segIdx + 1}/${totalSegments} 段`)

        // 每段获取新的Token（阿里云Token可能单次使用）
        let segToken: string
        let segAppKey: string
        if (segIdx === 0) {
          segToken = tokenData.token
          segAppKey = tokenData.appKey
        } else {
          const newTokenRes = await fetch('/api/voice/aliyun-token', { headers: getAuthHeaders() })
          const newTokenData = await newTokenRes.json()
          if (!newTokenData.token) throw new Error(`第${segIdx + 1}段Token获取失败`)
          segToken = newTokenData.token
          segAppKey = newTokenData.appKey
        }

        console.log(`开始识别第 ${segIdx + 1}/${totalSegments} 段 (${segIdx * SEGMENT_DURATION}s - ${Math.min((segIdx + 1) * SEGMENT_DURATION, totalSeconds)}s)`)

        const segmentText = await recognizeSegment(segmentPcm, segIdx, segToken, segAppKey)

        if (segmentText) {
          fullTranscript += (fullTranscript && segmentText ? '' : '') + segmentText
          console.log(`第${segIdx + 1}段识别结果: "${segmentText}"`)
        }

        // 段间间隔（让服务端释放资源）
        if (segIdx < totalSegments - 1) {
          await new Promise(r => setTimeout(r, 500))
        }
      }

      setProgress('识别完成')
      if (fullTranscript) {
        console.log('全部识别结果:', fullTranscript)
      } else {
        console.warn('识别结果为空')
      }
    } catch (err: any) {
      console.error('录音识别失败:', err)
      setProgress('识别失败: ' + err.message)
    } finally {
      if (audioContext) { try { audioContext.close() } catch {} }
      setIsUploading(false)
      if (inputRef.current) inputRef.current.value = ''
      setTimeout(() => setProgress(''), 3000)
    }
  }

  // ---- 工具函数 ----

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

  function getIncrementalText(last: string, current: string): string {
    if (!last) return current
    if (current === last) return ''
    let commonLen = 0
    const minLen = Math.min(last.length, current.length)
    for (let i = 1; i <= minLen; i++) {
      if (last[last.length - i] === current[current.length - i]) commonLen++
      else break
    }
    if (commonLen >= 2) {
      const lastPrefix = last.slice(0, last.length - commonLen)
      const currentPrefix = current.slice(0, current.length - commonLen)
      if (currentPrefix.startsWith(lastPrefix)) return current.slice(lastPrefix.length)
      return current.slice(Math.max(0, last.length - commonLen))
    }
    if (current.startsWith(last)) return current.slice(last.length)
    return current
  }

  // ---- UI ----
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
