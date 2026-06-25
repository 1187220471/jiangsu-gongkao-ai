import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

/**
 * 获取阿里云语音识别的Token
 * 直接调用阿里云POP API，带超时和重试
 */

const ALIYUN_CONFIG = {
  accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID || '',
  accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET || '',
  appKey: process.env.ALIYUN_APP_KEY || 'CbQtvzJ4k8mmaRLS',
}

async function createAliyunToken(retries = 3) {
  const RPCClient = require('@alicloud/pop-core').RPCClient

  const client = new RPCClient({
    accessKeyId: ALIYUN_CONFIG.accessKeyId,
    accessKeySecret: ALIYUN_CONFIG.accessKeySecret,
    endpoint: 'https://nls-meta.cn-shanghai.aliyuncs.com',
    apiVersion: '2019-02-28',
    timeout: 30000,
    connectTimeout: 15000,
    readTimeout: 15000,
  })

  let lastError: Error | null = null

  for (let i = 0; i < retries; i++) {
    try {
      const result = await client.request('CreateToken')
      console.log('阿里云Token生成结果:', result)
      return result
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.warn(`第 ${i + 1} 次获取阿里云Token失败:`, lastError.message)
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)))
      }
    }
  }

  throw lastError || new Error('获取阿里云Token失败')
}

export async function GET(request: Request) {
  try {
    const auth = requireAuth(request)
    if (!auth.success) {
      return auth.response
    }

    const result = await createAliyunToken()

    if (!result || !result.Token) {
      return NextResponse.json(
        { error: '获取Token失败' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      token: result.Token.Id,
      expireTime: result.Token.ExpireTime,
      appKey: ALIYUN_CONFIG.appKey,
    })
  } catch (error) {
    console.error('获取阿里云Token失败:', error)
    return NextResponse.json(
      { error: `获取Token失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    )
  }
}
