import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

/**
 * 获取阿里云语音识别的Token
 * 文档：https://help.aliyun.com/document_detail/113251.html
 */

// 阿里云配置（从环境变量读取敏感信息）
const ALIYUN_CONFIG = {
  accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID || '',
  accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET || '',
  appKey: process.env.ALIYUN_APP_KEY || 'CbQtvzJ4k8mmaRLS',
  endpoint: 'http://nls-meta.cn-shanghai.aliyuncs.com',
  apiVersion: '2019-02-28',
}

export async function GET(request: Request) {
  try {
    // 认证
    const auth = requireAuth(request)
    if (!auth.success) {
      return auth.response
    }

    // 动态导入SDK（避免构建时问题）
    const getToken = require('alibabacloud-nls/lib/token')

    // 获取Token
    const result = await getToken({
      akid: ALIYUN_CONFIG.accessKeyId,
      akkey: ALIYUN_CONFIG.accessKeySecret,
      endpoint: ALIYUN_CONFIG.endpoint,
      apiVer: ALIYUN_CONFIG.apiVersion,
    })

    console.log('阿里云Token生成结果:', result)

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
