import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { jsonrepair } from 'jsonrepair'

// 强制动态渲染，防止边缘缓存导致日期错误
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const prisma = new PrismaClient()

// ============ 网站配置 ============

function extractDate(url: string, _html: string): string {
  const patterns = [
    /t(\d{4})(\d{2})(\d{2})_/,
    /\/(\d{4})(\d{2})\//,
    /\/(\d{4})-(\d{2})-(\d{2})\//,
    /\/(\d{4})\/(\d{2})(\d{2})\//,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return `${m[1]}-${m[2]}-${m[3]}`
  }
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

const SITES = [
  {
    name: '江苏省人民政府网',
    url: 'https://www.jiangsu.gov.cn/',
    encoding: 'utf-8' as const,
    extract: (html: string) => {
      const results: any[] = []
      const regex = /<a[^>]*href="([^"]*\/art\/[^"]*)"[^>]*>([^<]{10,80})<\/a>/gi
      let match
      while ((match = regex.exec(html)) && results.length < 15) {
        const url = match[1]
        results.push({
          title: match[2].replace(/<[^>]+>/g, '').trim(),
          url: url.startsWith('http') ? url : 'https://www.jiangsu.gov.cn' + url,
          source: '江苏省人民政府网',
          date: extractDate(url, ''),
        })
      }
      return results
    },
  },
  {
    name: '中共江苏省委新闻网',
    url: 'http://www.zgjssw.gov.cn/',
    encoding: 'utf-8' as const,
    extract: (html: string) => {
      const results: any[] = []
      const regex = /<a[^>]*href="([^"]*(?:yaowen|fabuting|zhiduhuibian)[^"]*)"[^>]*>([^<]{10,80})<\/a>/gi
      let match
      while ((match = regex.exec(html)) && results.length < 15) {
        const url = match[1]
        results.push({
          title: match[2].replace(/<[^>]+>/g, '').trim(),
          url: url.startsWith('http') ? url : 'http://www.zgjssw.gov.cn' + url,
          source: '中共江苏省委新闻网',
          date: extractDate(url, ''),
        })
      }
      return results
    },
  },
  {
    name: '中国江苏网',
    url: 'https://jsnews.jschina.com.cn/jsyw/',
    encoding: 'utf-8' as const,
    extract: (html: string) => {
      const results: any[] = []
      const regex = /<a[^>]*href="([^"]*\/jsyw\/[^"]*)"[^>]*>([^<]{10,80})<\/a>/gi
      let match
      while ((match = regex.exec(html)) && results.length < 15) {
        const url = match[1]
        results.push({
          title: match[2].replace(/<[^>]+>/g, '').trim(),
          url: url.startsWith('http') ? url : 'https:' + url,
          source: '中国江苏网',
          date: extractDate(url, html),
        })
      }
      return results
    },
  },
  {
    name: '新华报业网',
    url: 'https://www.xhby.net/xjiangsu',
    encoding: 'utf-8' as const,
    extract: (html: string) => {
      const results: any[] = []
      const regex = /<div class="article-li"[^>]*>[\s\S]*?<a[^>]*href="([^"]*\/content\/s[0-9a-z]+\.html)"[^>]*>[\s\S]*?<div class="title">([^<]{10,80})<\/div>/gi
      let match
      while ((match = regex.exec(html)) && results.length < 15) {
        const url = match[1]
        results.push({
          title: match[2].replace(/<[^>]+>/g, '').trim(),
          url: url.startsWith('http') ? url : 'https:' + url,
          source: '新华报业网',
          date: extractDate(url, html),
        })
      }
      return results
    },
  },
  {
    name: '中国新闻网|江苏',
    url: 'https://www.js.chinanews.com.cn/',
    encoding: 'gb2312' as const,
    extract: (html: string) => {
      const results: any[] = []
      const simpleRegex = /<a[^>]*href="([^"]*\/news\/[^"]*)"[^>]*>([^<]{10,80})<\/a>/gi
      let match
      while ((match = simpleRegex.exec(html)) && results.length < 15) {
        const url = match[1]
        results.push({
          title: match[2].replace(/<[^>]+>/g, '').trim(),
          url: url.startsWith('http') ? url : 'https://www.js.chinanews.com.cn' + url,
          source: '中国新闻网|江苏',
          date: extractDate(url, html),
        })
      }
      return results
    },
  },
  {
    name: '扬子晚报网',
    url: 'https://www.yzwb.net/',
    encoding: 'utf-8' as const,
    extract: (html: string) => {
      const results: any[] = []
      const simpleRegex = /<a[^>]*href="([^"]*\/news\/[^"]*)"[^>]*>([^<]{10,80})<\/a>/gi
      let match
      while ((match = simpleRegex.exec(html)) && results.length < 15) {
        const url = match[1]
        results.push({
          title: match[2].replace(/<[^>]+>/g, '').trim(),
          url: url.startsWith('http') ? url : 'https://www.yzwb.net' + url,
          source: '扬子晚报网',
          date: extractDate(url, html),
        })
      }
      return results
    },
  },
]

async function fetchSite(site: typeof SITES[0]) {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    const response = await fetch(site.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!response.ok) {
      return { site: site.name, error: `HTTP ${response.status}`, results: [] }
    }

    const buffer = await response.arrayBuffer()
    const html = new TextDecoder(site.encoding || 'utf-8').decode(buffer)
    const results = site.extract(html)

    return { site: site.name, results, count: results.length }
  } catch (err: any) {
    return { site: site.name, error: err.message, results: [] }
  }
}

// ============ AI 过滤 ============

function sanitizeForJSON(text: string): string {
  // 移除或转义可能破坏JSON格式的特殊字符
  return text
    .replace(/\\/g, '\\')   // 转义反斜杠
    .replace(/"/g, '\\"')   // 转义双引号
    .replace(/\n/g, ' ')     // 换行符转空格
    .replace(/\r/g, ' ')     // 回车符转空格
    .replace(/\t/g, ' ')     // 制表符转空格
}

async function aiFilter(newsItems: any[], apiKey: string) {
  // 清理新闻标题，防止特殊字符破坏prompt中的JSON结构
  const cleanedItems = newsItems.map(n => ({
    ...n,
    title: sanitizeForJSON(n.title),
  }))

  const prompt = `你是一位资深公考备考资料编辑，负责从以下江苏地区新闻中筛选出对公务员申论写作和结构化面试最有参考价值的新闻，并精选出今日最重要的消息。

筛选标准：
1. 申论/面试话题相关度（权重40%）：民生保障、产业创新、经济发展、文化繁荣、社会治理、科技创新、乡村振兴、绿色发展、区域协调（长三角一体化）
2. 政策重要性（权重25%）
3. 时效性（权重20%）
4. 信息密度（权重15%）

分值调整：
- 纯人事任免：基础分 -3
- 征地批复等纯行政事务：基础分 -1
- 民生保障/产业创新/经济发展/文化繁荣/基层治理/长三角一体化：基础分 +1

排除项：娱乐八卦、体育赛事、纯商业广告、社会猎奇、天气预报、重复报道、纯会议报道无实质内容

对每条新闻给出评分（1-10分），保留评分≥6分的新闻作为初筛结果。

从初筛结果中，精选8-12条作为"今日要闻"。兼顾话题多样性，优先选有具体数据的新闻。

对每条"今日要闻"撰写100-150字简介，要求：概括核心内容、点明申论/面试关联话题、包含具体数据、语言简洁无空话、可适当展开分析价值。

## 输出格式（严格返回JSON，不要markdown）

返回以下JSON格式（不要加markdown代码块标记，确保JSON完整不截断）：
{
  "allNews": [
    {
      "title": "新闻标题",
      "date": "YYYY-MM-DD",
      "source": "来源网站",
      "score": 7.5,
      "url": "新闻链接"
    }
  ],
  "topNews": [
    {
      "topic": "主题分类（如：民生保障/产业创新/经济发展/文化繁荣/社会治理/科技创新/区域协调/乡村振兴/绿色发展）",
      "title": "新闻标题",
      "date": "YYYY-MM-DD",
      "source": "来源网站",
      "score": 9.5,
      "intro": "100-150字简介",
      "url": "新闻链接"
    }
  ]
}

注意：
1. allNews 包含所有评分≥6分的初筛新闻，按分数从高到低排序
2. topNews 从 allNews 中精选8-12条，每条必须附带100-150字简介
3. 两个列表的新闻不要重复计算，topNews是allNews的子集
4. 必须返回完整、合法的JSON，不要截断，确保最后一个括号闭合

新闻列表（共${cleanedItems.length}条）：
${cleanedItems.map((n, i) => `${i + 1}. [${n.date}] [${n.source}] ${n.title} | ${n.url}`).join('\n')}`

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 8000,
    }),
  })

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status}`)
  }

  const data = await response.json()
  const content = data.choices[0].message.content

  // 解析JSON（处理可能的markdown代码块）
  let jsonStr = content
  const codeBlockMatch = content.match(/```(?:json)?\n?([\s\S]*?)```/)
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim()
  }

  // 尝试多种方式解析JSON
  try {
    return JSON.parse(jsonStr)
  } catch (e) {
    console.log('首次JSON解析失败，尝试修复:', e instanceof Error ? e.message : String(e))
    
    // 尝试使用jsonrepair修复
    try {
      const repaired = jsonrepair(jsonStr)
      const result = JSON.parse(repaired)
      console.log('✅ jsonrepair修复成功')
      return result
    } catch (repairErr) {
      console.log('jsonrepair修复失败:', repairErr instanceof Error ? repairErr.message : String(repairErr))
    }
    
    // 尝试从文本中提取最外层JSON对象
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        const extracted = jsonMatch[0]
        const repaired = jsonrepair(extracted)
        return JSON.parse(repaired)
      } catch (extractErr) {
        console.log('提取后修复失败:', extractErr instanceof Error ? extractErr.message : String(extractErr))
      }
    }
    
    throw new Error('无法解析AI返回的JSON')
  }
}

// ============ Cron 入口 ============

export async function GET(request: NextRequest) {
  try {
    // Vercel Cron 会携带 Authorization header，可以简单校验（可选）
    // 也可以在 vercel.json 中配置 cron secret

    const apiKey = process.env.DEEPSEEK_API_KEY || process.env.DASHSCOPE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'AI API Key not configured' }, { status: 500 })
    }

    // 检查今天是否已经有数据，防止重复执行（Vercel Cron 漂移或本地构建触发）
    // 使用北京时间（UTC+8）
    const now = new Date()
    const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000)
    const today = beijingTime.toISOString().split('T')[0]
    const existing = await prisma.dailyNews.findUnique({
      where: { date: today },
    })
    if (existing) {
      console.log(`[${new Date().toISOString()}] 今日新闻已存在 (${today})，跳过重复执行`)
      return NextResponse.json({
        success: true,
        date: today,
        message: '今日新闻已存在，跳过重复执行',
        skipped: true,
      })
    }

    console.log(`[${new Date().toISOString()}] 开始抓取每日新闻...`)

    // 1. 抓取所有网站
    const results = await Promise.all(SITES.map(fetchSite))
    let rawNews: any[] = []
    for (const r of results) {
      if (r.error) {
        console.log(`❌ ${r.site}: ${r.error}`)
      } else {
        console.log(`✅ ${r.site}: ${r.count} 条`)
        rawNews = rawNews.concat(r.results)
      }
    }

    // 去重
    const seen = new Set()
    const uniqueNews = rawNews.filter(n => {
      const key = n.title.slice(0, 20)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    console.log(`📊 原始抓取: ${rawNews.length} 条，去重后: ${uniqueNews.length} 条`)

    if (uniqueNews.length === 0) {
      return NextResponse.json({ error: '未抓取到任何新闻' }, { status: 500 })
    }

    // 2. AI过滤精选
    console.log('🤖 开始AI过滤...')
    const aiResult = await aiFilter(uniqueNews, apiKey)
    const topNews = aiResult.topNews || []
    const allNews = aiResult.allNews || []

    console.log(`✅ AI初筛完成，共 ${allNews.length} 条（≥6分）`)
    console.log(`✅ AI精选完成，共 ${topNews.length} 条`)

    // 3. 存入数据库（today 已在开头定义）
    await prisma.dailyNews.upsert({
      where: { date: today },
      update: {
        topNews: JSON.stringify(topNews),
        allNews: JSON.stringify(allNews),
      },
      create: {
        date: today,
        topNews: JSON.stringify(topNews),
        allNews: JSON.stringify(allNews),
      },
    })

    console.log(`✅ 已存入数据库: ${today}`)

    return NextResponse.json({
      success: true,
      date: today,
      topCount: topNews.length,
      allCount: allNews.length,
      topNews,
      allNews,
    })
  } catch (error: any) {
    console.error('抓取每日新闻失败:', error)
    return NextResponse.json(
      { error: error.message || '执行失败' },
      { status: 500 }
    )
  }
}
