import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import * as crypto from 'crypto'
import * as https from 'https'

export const dynamic = 'force-dynamic'

// 阿里云 OCR 手写识别 API 签名
function makeAliyunSignature(params: Record<string, string>, secret: string): string {
  const sortedKeys = Object.keys(params).sort()
  const canonicalizedQueryString = sortedKeys
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&')
  const stringToSign = 'POST&%2F&' + encodeURIComponent(canonicalizedQueryString)
  const hmac = crypto.createHmac('sha1', secret + '&')
  hmac.update(stringToSign)
  return hmac.digest('base64')
}

// 调用阿里云 OCR API（直接 HTTP POST 二进制图片）
async function callAliyunOCR(imageBuffer: Buffer): Promise<string> {
  const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID?.replace(/^"|"$/g, '')
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET?.replace(/^"|"$/g, '')

  if (!accessKeyId || !accessKeySecret) {
    throw new Error('阿里云 OCR 未配置')
  }

  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
  const nonce = Math.random().toString(36).substring(2, 15)

  const publicParams: Record<string, string> = {
    Format: 'JSON',
    Version: '2021-07-07',
    AccessKeyId: accessKeyId,
    SignatureMethod: 'HMAC-SHA1',
    Timestamp: timestamp,
    SignatureVersion: '1.0',
    SignatureNonce: nonce,
    Action: 'RecognizeHandwriting',
  }

  const signature = makeAliyunSignature(publicParams, accessKeySecret)
  publicParams['Signature'] = signature

  const queryString = Object.keys(publicParams)
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(publicParams[key])}`)
    .join('&')

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'ocr-api.cn-hangzhou.aliyuncs.com',
        path: '/?' + queryString,
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': imageBuffer.length,
          Accept: 'application/json',
        },
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`OCR API 错误: ${res.statusCode} - ${data}`))
            return
          }
          try {
            const result = JSON.parse(data)
            if (result.Code && result.Code !== 'Success') {
              reject(new Error(`OCR 识别失败: ${result.Message}`))
              return
            }
            // Data 字段是 JSON 字符串，需要二次解析
            const dataObj = typeof result.Data === 'string' ? JSON.parse(result.Data) : result.Data
            const content = dataObj?.content || dataObj?.Content
            if (!content) {
              reject(new Error('未能识别出文字内容'))
              return
            }
            resolve(content)
          } catch (e) {
            reject(new Error('OCR 响应解析失败'))
          }
        })
      }
    )

    req.on('error', reject)
    req.write(imageBuffer)
    req.end()
  })
}

export async function POST(request: Request) {
  try {
    const auth = requireAuth(request)
    if (!auth.success) {
      return auth.response
    }

    const { image } = await request.json()

    if (!image || typeof image !== 'string') {
      return NextResponse.json({ error: '图片数据不能为空' }, { status: 400 })
    }

    if (!image.startsWith('data:image/')) {
      return NextResponse.json({ error: '无效的图片格式' }, { status: 400 })
    }

    // 去掉 data:image/xxx;base64, 前缀，只保留纯 base64
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '')

    // Base64 转 Buffer（二进制）
    const imageBuffer = Buffer.from(base64Data, 'base64')

    if (imageBuffer.length === 0) {
      return NextResponse.json({ error: '图片数据为空' }, { status: 400 })
    }

    if (imageBuffer.length > 10 * 1024 * 1024) {
      return NextResponse.json({ error: '图片大小不能超过 10MB' }, { status: 400 })
    }

    // 调用阿里云 OCR 手写识别
    const text = await callAliyunOCR(imageBuffer)

    return NextResponse.json({ text: text.trim() })
  } catch (error) {
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    console.error(`[${errorId}] OCR error:`, error)
    return NextResponse.json(
      { error: '识别失败，请稍后重试', errorId },
      { status: 500 }
    )
  }
}
