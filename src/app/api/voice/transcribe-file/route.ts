import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

/**
 * 阿里云录音文件识别（后端中转）
 * 前端上传音频文件 → 后端调阿里云API → 返回识别结果
 * 解决CORS问题和Base64数据量问题
 */

const ALIYUN_CONFIG = {
  accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID || '',
  accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET || '',
  appKey: process.env.ALIYUN_APP_KEY || 'CbQtvzJ4k8mmaRLS',
}

// 获取阿里云Token
async function getAliyunToken() {
  const RPCClient = require('@alicloud/pop-core').RPCClient

  const client = new RPCClient({
    accessKeyId: ALIYUN_CONFIG.accessKeyId,
    accessKeySecret: ALIYUN_CONFIG.accessKeySecret,
    endpoint: 'http://nls-meta.cn-shanghai.aliyuncs.com',
    apiVersion: '2019-02-28'
  })

  const result = await client.request('CreateToken')
  if (!result?.Token?.Id) {
    throw new Error('获取Token失败')
  }
  return result.Token.Id
}

// 获取音频格式
function getAudioFormat(file: File): string {
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
async function pollResult(token: string, taskId: string): Promise<string> {
  const maxAttempts = 60 // 最多轮询2分钟
  const queryUrl = `https://nls-gateway.cn-shanghai.aliyuncs.com/stream/v1/FileTranscriber`

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, 2000)) // 每2秒查一次

    const response = await fetch(`${queryUrl}?appkey=${ALIYUN_CONFIG.appKey}&task_id=${taskId}`, {
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

    if (result.error_code && result.error_code !== 0) {
      throw new Error(result.error_message || `识别失败: ${result.error_code}`)
    }

    const status = result.status_text
    if (status === 'SUCCESS') {
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
  }

  throw new Error('识别超时，请重试')
}

export async function POST(req: NextRequest) {
  try {
    // 认证
    const auth = requireAuth(req)
    if (!auth.success) {
      return auth.response
    }

    // 读取上传的文件
    const formData = await req.formData()
    const file = formData.get('audio') as File

    if (!file) {
      return NextResponse.json({ error: '没有音频文件' }, { status: 400 })
    }

    // 限制文件大小（10MB）
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: '文件超过10MB，请压缩后上传' }, { status: 400 })
    }

    const format = getAudioFormat(file)

    // 1. 获取阿里云Token
    const token = await getAliyunToken()

    // 2. 读取文件并转Base64
    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    // 3. 提交识别任务
    const submitUrl = 'https://nls-gateway.cn-shanghai.aliyuncs.com/stream/v1/FileTranscriber'

    const submitResponse = await fetch(submitUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-NLS-Token': token,
      },
      body: JSON.stringify({
        appkey: ALIYUN_CONFIG.appKey,
        file_link: `data:audio/${format};base64,${base64}`,
        format: format,
        sample_rate: 16000,
        enable_punctuation_prediction: true,
        enable_inverse_text_normalization: true,
      }),
    })

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text()
      return NextResponse.json({ error: `提交识别任务失败: ${errorText}` }, { status: 500 })
    }

    const submitResult = await submitResponse.json()
    console.log('提交识别任务结果:', submitResult)

    if (submitResult.error_code && submitResult.error_code !== 0) {
      return NextResponse.json(
        { error: submitResult.error_message || '提交识别任务失败' },
        { status: 500 }
      )
    }

    const taskId = submitResult.task_id
    if (!taskId) {
      return NextResponse.json({ error: '未获取到任务ID' }, { status: 500 })
    }

    // 4. 轮询查询结果
    const transcript = await pollResult(token, taskId)

    return NextResponse.json({ transcript })

  } catch (error: any) {
    console.error('录音文件识别失败:', error)
    return NextResponse.json(
      { error: error.message || '识别失败' },
      { status: 500 }
    )
  }
}
