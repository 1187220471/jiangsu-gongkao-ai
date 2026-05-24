import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createHash, createHmac } from 'crypto'

/**
 * 讯飞语音识别 - 语音听写一句话识别API
 * 文档：https://www.xfyun.cn/doc/asr/voicedictation/API.html
 */

// MD5哈希
function md5(message: string): string {
  return createHash('md5').update(message).digest('hex')
}

// HmacSHA1签名
function hmacSha1(key: string, data: string): string {
  return createHmac('sha1', key).update(data).digest('base64')
}

// 生成讯飞语音听写API签名
// 算法: md5(appid + ts) -> hmac-sha1(结果, apiKey)
function generateSigna(appId: string, apiKey: string, timestamp: string): string {
  const baseString = md5(appId + timestamp)
  return hmacSha1(apiKey, baseString)
}

export async function POST(request: Request) {
  try {
    // 认证
    const auth = requireAuth(request)
    if (!auth.success) {
      return auth.response
    }

    const { audio } = await request.json()

    if (!audio) {
      return NextResponse.json(
        { error: '音频数据不能为空' },
        { status: 400 }
      )
    }

    // 讯飞配置 - 语音听写API
    const appId = '57c0ec9c'
    const apiKey = 'b7ed51fb8d8a0bbb7277278f6e120bfb'

    // 将base64转为二进制
    const audioBuffer = Buffer.from(audio, 'base64')
    const audioBase64 = audio.toString()

    console.log('讯飞语音听写请求:', {
      appId,
      audioLen: audioBuffer.length,
      base64Len: audioBase64.length
    })

    // 生成签名
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const signa = generateSigna(appId, apiKey, timestamp)

    console.log('签名:', signa)

    // 调用讯飞语音听写一句话识别API
    // 注意：这里是调用讯飞"语音听写"服务，不是"录音文件转写"
    const response = await fetch('https://api.xf-yun.com/v1/private/SEortSgSjfeClDlD/recognation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        request: {
          common: {
            app_id: appId,
          },
          business: {
            aue: 'lame',  // 音频编码，lame=mp3, raw=pcm, speex=spx
            auf: 'audio/L16;rate=16000',  // 音频格式
            scene: 'main',  // 场景
            vad_eos: 5000,  // 静音超时时间(ms)
          },
          data: {
            status: 2,  // 2=最后一块音频
            format: 'audio/L16;rate=16000',
            encoding: 'raw',
            audio: audioBase64,
          },
        },
        signa: signa,
        ts: timestamp,
        appid: appId,
      }),
    })

    const result = await response.json()
    console.log('讯飞响应:', JSON.stringify(result))

    // 解析结果
    if (result.code !== 0 && result.code !== '0') {
      return NextResponse.json(
        { error: `语音识别失败: ${result.desc || result.message || result.code}` },
        { status: 500 }
      )
    }

    // 提取识别文字
    let text = ''
    if (result.data && result.data.result) {
      const resultData = typeof result.data === 'string' 
        ? JSON.parse(result.data) 
        : result.data.result
      
      if (resultData && resultData.ws) {
        for (const w of resultData.ws) {
          if (w.cw) {
            for (const c of w.cw) {
              text += c.w || ''
            }
          }
        }
      }
    }

    console.log('识别结果:', text)

    return NextResponse.json({
      text: text || '识别结果为空',
    })

  } catch (error) {
    console.error('Voice recognition error:', error)
    return NextResponse.json(
      { error: `语音识别服务异常: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    )
  }
}
