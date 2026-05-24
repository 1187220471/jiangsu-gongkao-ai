import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

/**
 * 讯飞语音识别API代理
 * 使用录音文件转写API
 * 文档：https://www.xfyun.cn/doc/asr/lfasr/API.html
 */

// HmacSHA1签名
async function hmacSha1(key: string, data: string): Promise<string> {
  const encoder = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data))
  const signatureArray = Array.from(new Uint8Array(signature))
  return btoa(String.fromCharCode(...signatureArray))
}

// MD5哈希
async function md5(message: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(message)
  const hashBuffer = await crypto.subtle.digest('MD5', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// 生成签名
async function generateSigna(appId: string, apiSecret: string, timestamp: string): Promise<string> {
  const baseString = await md5(appId + timestamp)
  return hmacSha1(apiSecret, baseString)
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

    // 讯飞配置
    const appId = '57c0ec9c'
    const apiSecret = 'NjQxZjgzNzdlNWZkNjM3NWQ3ZTA0MzI1'

    // 将base64转为二进制，计算实际文件大小
    const audioBuffer = Buffer.from(audio, 'base64')
    const fileLen = audioBuffer.length

    console.log('音频信息:', { fileLen, base64Len: audio.length })

    // 1. 预处理 - 获取task_id
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const signa = await generateSigna(appId, apiSecret, timestamp)

    console.log('讯飞预处理请求:', { app_id: appId, ts: timestamp, file_len: fileLen })

    const prepareResponse = await fetch('https://raasr.xfyun.cn/api/prepare', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: new URLSearchParams({
        app_id: appId,
        signa: signa,
        ts: timestamp,
        file_len: fileLen.toString(),
        file_name: 'voice.wav',
        slice_num: '1',
        language: 'cn',
      }),
    })

    const prepareResult = await prepareResponse.json()
    console.log('讯飞预处理结果:', prepareResult)

    if (prepareResult.ok !== 0) {
      const errorMsg = prepareResult.failed || `预处理失败(err_no:${prepareResult.err_no})`
      console.error('预处理失败:', errorMsg)
      return NextResponse.json(
        { error: errorMsg },
        { status: 500 }
      )
    }

    const taskId = prepareResult.data
    if (!taskId) {
      return NextResponse.json(
        { error: '未获取到任务ID' },
        { status: 500 }
      )
    }

    console.log('获取到taskId:', taskId)

    // 2. 上传文件（multipart/form-data）
    const uploadTimestamp = Math.floor(Date.now() / 1000).toString()
    const uploadSigna = await generateSigna(appId, apiSecret, uploadTimestamp)

    const formData = new FormData()
    formData.append('app_id', appId)
    formData.append('signa', uploadSigna)
    formData.append('ts', uploadTimestamp)
    formData.append('task_id', taskId)
    formData.append('slice_id', 'aaaaaaaaaa')
    formData.append('content', new Blob([audioBuffer]))

    const uploadResponse = await fetch('https://raasr.xfyun.cn/api/upload', {
      method: 'POST',
      body: formData,
    })

    const uploadResult = await uploadResponse.json()
    console.log('讯飞上传结果:', uploadResult)

    if (uploadResult.ok !== 0) {
      const errorMsg = uploadResult.failed || `上传失败(err_no:${uploadResult.err_no})`
      console.error('上传失败:', errorMsg)
      return NextResponse.json(
        { error: errorMsg },
        { status: 500 }
      )
    }

    // 3. 合并文件
    const mergeTimestamp = Math.floor(Date.now() / 1000).toString()
    const mergeSigna = await generateSigna(appId, apiSecret, mergeTimestamp)

    const mergeResponse = await fetch('https://raasr.xfyun.cn/api/merge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: new URLSearchParams({
        app_id: appId,
        signa: mergeSigna,
        ts: mergeTimestamp,
        task_id: taskId,
      }),
    })

    const mergeResult = await mergeResponse.json()
    console.log('讯飞合并结果:', mergeResult)

    if (mergeResult.ok !== 0) {
      const errorMsg = mergeResult.failed || `合并失败(err_no:${mergeResult.err_no})`
      console.error('合并失败:', errorMsg)
      return NextResponse.json(
        { error: errorMsg },
        { status: 500 }
      )
    }

    // 4. 轮询获取结果
    let text = ''
    let attempts = 0
    const maxAttempts = 30 // 最多轮询30次，每次2秒，共60秒

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      attempts++

      const queryTimestamp = Math.floor(Date.now() / 1000).toString()
      const querySigna = await generateSigna(appId, apiSecret, queryTimestamp)

      // 查询进度
      const progressResponse = await fetch('https://raasr.xfyun.cn/api/getProgress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        body: new URLSearchParams({
          app_id: appId,
          signa: querySigna,
          ts: queryTimestamp,
          task_id: taskId,
        }),
      })

      const progressResult = await progressResponse.json()
      console.log(`讯飞进度查询(${attempts}):`, progressResult)

      if (progressResult.ok !== 0) {
        continue
      }

      const progressData = JSON.parse(progressResult.data || '{}')
      
      // 状态码：9表示转写结果上传完成
      if (progressData.status === 9) {
        // 获取结果
        const resultTimestamp = Math.floor(Date.now() / 1000).toString()
        const resultSigna = await generateSigna(appId, apiSecret, resultTimestamp)

        const resultResponse = await fetch('https://raasr.xfyun.cn/api/getResult', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          },
          body: new URLSearchParams({
            app_id: appId,
            signa: resultSigna,
            ts: resultTimestamp,
            task_id: taskId,
          }),
        })

        const resultData = await resultResponse.json()
        console.log('讯飞最终结果:', resultData)

        if (resultData.ok === 0 && resultData.data) {
          const results = JSON.parse(resultData.data)
          if (Array.isArray(results)) {
            text = results.map((item: any) => item.onebest || '').join('')
          }
        }
        break
      }

      // 状态码：-1表示失败
      if (progressData.status === -1) {
        return NextResponse.json(
          { error: progressData.desc || '转写失败' },
          { status: 500 }
        )
      }
    }

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
