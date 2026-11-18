import { NextRequest, NextResponse } from 'next/server'
import { jsonrepair } from 'jsonrepair'
import { prisma } from '@/lib/db'
import { formatThemesForPrompt } from '@/lib/newsThemes'
import { requireCronSecret } from '@/lib/cronAuth'

// 强制动态渲染，防止边缘缓存导致日期错误
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// ============ 网站配置 ============

// ============ 日期解析 ============

/** 只保留近 N 天发布的新闻（有日期但超期 → 丢弃；无日期 → 保留并标注「日期未知」） */
const RECENT_DAYS = 3
const UNKNOWN_DATE = '日期未知'

const DATE_PATTERNS: RegExp[] = [
  /t(\d{4})(\d{2})(\d{2})_/, // t20261012_
  /\/(\d{4})\/(\d{2})\/(\d{2})\//, // /2026/10/12/
  /\/(\d{4})\/(\d{2})(\d{2})\//, // /2026/1012/
  /\/(\d{4})-(\d{2})-(\d{2})\//, // /2026-10-12/
]

function validYmd(y: string, m: string, d: string): string | null {
  const yy = +y, mm = +m, dd = +d
  if (yy < 2020 || yy > 2030 || mm < 1 || mm > 12 || dd < 1 || dd > 31) return null
  return `${y}-${m}-${d}`
}

/**
 * 从 URL 解析发布日期。
 * ⚠️ 解析不出时返回 null —— 绝不兜底为「今天」（旧实现兜底为今天，导致 53% 的新闻
 *    日期被伪造为抓取当天）。
 */
function dateFromUrl(url: string): string | null {
  for (const p of DATE_PATTERNS) {
    const m = url.match(p)
    if (m) {
      const v = validYmd(m[1], m[2], m[3])
      if (v) return v
    }
  }
  // 新华报业网/交汇点：/content/s<24位hex>.html，前 8 位 hex 即 MongoDB ObjectId 时间戳
  const oid = url.match(/\/s([0-9a-f]{24})\.html/i)
  if (oid) {
    const ts = parseInt(oid[1].slice(0, 8), 16) * 1000
    if (ts > 1577836800000 && ts < 1893456000000) {
      // 转为北京时间自然日
      return new Date(ts + 8 * 3600 * 1000).toISOString().slice(0, 10)
    }
  }
  return null
}

/** 相对/协议相对链接 → 绝对链接 */
function absUrl(origin: string, href: string): string {
  if (href.startsWith('//')) return 'https:' + href
  if (href.startsWith('http')) return href
  if (href.startsWith('/')) return origin + href
  return origin + '/' + href.replace(/^\.\//, '')
}

/** 北京时间「今天」 */
function beijingToday(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)
}

/** 导航/栏目类噪声标题 */
const NOISE_TITLE = /^(要闻|时政|国内|国际|社会|评论|观点|图片|视频|专题|更多|首页|登录|注册|·?\s*更\s*多\s*·?|.*&middot;.*|.*&nbsp;.*)$/

interface NewsLink {
  title: string
  url: string
  source: string
}

interface SiteConfig {
  name: string
  url: string
  encoding: 'utf-8' | 'gb2312'
  origin: string
  /** 文章链接形态（收紧后天然排除导航/栏目链接，且 URL 自带日期） */
  href?: RegExp
  /** 结构特殊的站点自定义提取 */
  custom?: (html: string) => NewsLink[]
}

/**
 * 通用提取器：只接受「符合该站真实文章 URL 形态」的链接。
 * 收紧链接形态可一并解决两个问题——排除导航/栏目链接，且 URL 自带日期。
 */
function extractAnchors(html: string, origin: string, source: string, hrefPattern: RegExp, limit = 15): NewsLink[] {
  const results: NewsLink[] = []
  const re = /<a[^>]*href="([^"]+)"[^>]*>([^<]{8,90})<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) && results.length < limit) {
    if (!hrefPattern.test(m[1])) continue
    const title = m[2].replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, '').trim()
    if (!title || title.length < 8 || NOISE_TITLE.test(title)) continue
    results.push({ title, url: absUrl(origin, m[1]), source })
  }
  return results
}

const SITES: SiteConfig[] = [
  {
    name: '江苏省人民政府网',
    url: 'https://www.jiangsu.gov.cn/',
    encoding: 'utf-8' as const,
    origin: 'https://www.jiangsu.gov.cn',
    href: /\/art\/\d{4}\/\d{2}\/\d{2}\/art_\d+_\d+\.html/,
  },
  {
    name: '中共江苏省委新闻网',
    url: 'http://www.zgjssw.gov.cn/',
    encoding: 'utf-8' as const,
    origin: 'http://www.zgjssw.gov.cn',
    href: /\/(?:yaowen|fabuting|zhiduhuibian)\/\d{6}\/t\d{8}_\d+\.shtml/,
  },
  {
    name: '中国江苏网',
    url: 'https://jsnews.jschina.com.cn/jsyw/',
    encoding: 'utf-8' as const,
    origin: 'https://jsnews.jschina.com.cn',
    href: /\/jsyw\/\d{6}\/t\d{8}_[0-9a-z]+/,
  },
  {
    // 该站 URL 无日期，但 ID 是 MongoDB ObjectId（前 8 位 hex 可解出发布时间）
    name: '新华报业网',
    url: 'https://www.xhby.net/xjiangsu',
    encoding: 'utf-8' as const,
    origin: 'https://www.xhby.net',
    custom: (html: string): NewsLink[] => {
      const results: NewsLink[] = []
      const re =
        /<div class="article-li"[^>]*>[\s\S]*?<a[^>]*href="([^"]*\/content\/s[0-9a-f]{24}\.html)"[^>]*>[\s\S]*?<div class="title">([^<]{8,90})<\/div>/gi
      let m: RegExpExecArray | null
      while ((m = re.exec(html)) && results.length < 15) {
        const title = m[2].replace(/<[^>]+>/g, '').trim()
        if (!title || NOISE_TITLE.test(title)) continue
        results.push({ title, url: absUrl('https://www.xhby.net', m[1]), source: '新华报业网' })
      }
      return results
    },
  },
  {
    name: '中国新闻网|江苏',
    url: 'https://www.js.chinanews.com.cn/',
    encoding: 'gb2312' as const,
    origin: 'https://www.js.chinanews.com.cn',
    href: /\/news\/\d{4}\/\d{4}\/\d+\.html/,
  },
  {
    name: '扬子晚报网',
    url: 'https://www.yzwb.net/',
    encoding: 'utf-8' as const,
    origin: 'https://www.yzwb.net',
    href: /\/news\/\w+\/\d{6}\/t\d{8}_\d+\.html/,
  },
]

async function fetchSite(site: SiteConfig) {
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
    const links = site.custom ? site.custom(html) : extractAnchors(html, site.origin, site.name, site.href!)

    // 统一解析发布日期：解析不出 → 标注「日期未知」（绝不兜底为今天）
    const results = links.map((l) => ({ ...l, date: dateFromUrl(l.url) ?? UNKNOWN_DATE }))

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
1. 江苏考情相关度（权重40%）：以下主题清单提炼自近5年江苏省考申论与面试真题，命中清单主题的新闻优先：
${formatThemesForPrompt()}
2. 政策重要性（权重25%）
3. 时效性（权重20%）
4. 信息密度（权重15%）

分值调整：
- 标题命中【核心考点】关键词：基础分 +2
- 标题命中【重要考点】关键词：基础分 +1
- 纯人事任免：基础分 -3
- 征地批复等纯行政事务：基础分 -1

注意：主题清单是加分指引而非硬过滤，未命中清单但确有申论/面试参考价值的政策类新闻（如全国性改革试点、新兴领域治理动态），仍应正常评分。

排除项：娱乐八卦、体育赛事、纯商业广告、社会猎奇、天气预报、重复报道、纯会议报道无实质内容

对每条新闻给出评分（1-10分），保留评分≥6分的新闻作为初筛结果。

从初筛结果中，精选8-12条作为"今日要闻"。要求：
- 兼顾主题多样性：尽量覆盖不同主题域（如基层治理/乡村振兴/民生/经济科技/文化等），避免同类话题扎堆
- 优先选有具体数据的新闻

对每条"今日要闻"撰写100-150字简介，要求：概括核心内容、点明申论/面试关联话题、包含具体数据、语言简洁无空话、可适当展开分析价值。

## 输出格式（严格返回JSON，不要markdown）

返回以下JSON格式（不要加markdown代码块标记，确保JSON完整不截断）：
{
  "allNews": [
    {
      "title": "新闻标题",
      "date": "原样回填输入的日期（形如 2026-10-12，或「日期未知」）",
      "source": "来源网站",
      "score": 7.5,
      "url": "新闻链接"
    }
  ],
  "topNews": [
    {
      "topic": "主题分类（从考情主题中选：基层治理/乡村振兴/政务服务/民生保障/执法法治/科技数字化/文化建设/新业态治理/安全应急/生态环保/区域协调/经济发展等）",
      "title": "新闻标题",
      "date": "原样回填输入的日期（形如 2026-10-12，或「日期未知」）",
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
5. **date 必须原样回填输入中该条新闻的日期**，不得改写、不得推测；输入为「日期未知」时原样输出「日期未知」

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
  const cronDenied = requireCronSecret(request)
  if (cronDenied) return cronDenied

  const startTime = Date.now()
  let logStatus = 'success'
  let logMessage = ''
  let logDetail = ''

  try {
    const apiKey = process.env.DEEPSEEK_API_KEY || process.env.DASHSCOPE_API_KEY
    if (!apiKey) {
      logStatus = 'failed'
      logMessage = 'AI API Key not configured'
      await prisma.cronExecutionLog.create({
        data: { jobName: 'fetch-news', status: logStatus, message: logMessage },
      })
      return NextResponse.json({ error: 'AI API Key not configured' }, { status: 500 })
    }

    // 检查今天是否已经有数据
    const today = beijingToday()
    const existing = await prisma.dailyNews.findUnique({
      where: { date: today },
    })
    if (existing) {
      logStatus = 'skipped'
      logMessage = `今日新闻已存在 (${today})，跳过重复执行`
      await prisma.cronExecutionLog.create({
        data: { jobName: 'fetch-news', status: logStatus, message: logMessage },
      })
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
    const siteErrors: string[] = []
    for (const r of results) {
      if (r.error) {
        console.log(`❌ ${r.site}: ${r.error}`)
        siteErrors.push(`${r.site}: ${r.error}`)
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

    // 时效过滤：有日期但超出 RECENT_DAYS 天的丢弃；「日期未知」的保留（前端标注）
    const cutoff = new Date(Date.now() + 8 * 3600 * 1000 - RECENT_DAYS * 86400000).toISOString().slice(0, 10)
    const recentNews = uniqueNews.filter((n) => n.date === UNKNOWN_DATE || n.date >= cutoff)
    const unknownCount = recentNews.filter((n) => n.date === UNKNOWN_DATE).length

    console.log(
      `📊 原始抓取: ${rawNews.length} 条，去重后: ${uniqueNews.length} 条，时效过滤后: ${recentNews.length} 条（丢弃旧闻 ${uniqueNews.length - recentNews.length} 条，日期未知 ${unknownCount} 条）`
    )

    if (recentNews.length === 0) {
      logStatus = 'failed'
      logMessage = '未抓取到任何新闻'
      logDetail = siteErrors.join('; ')
      await prisma.cronExecutionLog.create({
        data: { jobName: 'fetch-news', status: logStatus, message: logMessage, detail: logDetail },
      })
      return NextResponse.json({ error: '未抓取到任何新闻' }, { status: 500 })
    }

    // 2. AI过滤精选
    console.log('🤖 开始AI过滤...')
    const aiResult = await aiFilter(recentNews, apiKey)
    const topNews = aiResult.topNews || []
    const allNews = aiResult.allNews || []

    console.log(`✅ AI初筛完成，共 ${allNews.length} 条（≥6分）`)
    console.log(`✅ AI精选完成，共 ${topNews.length} 条`)

    // 3. 存入数据库
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

    const duration = Date.now() - startTime
    logMessage = `成功: ${today}, topNews=${topNews.length}, allNews=${allNews.length}, 耗时${duration}ms`
    if (siteErrors.length > 0) {
      logDetail = `部分站点失败: ${siteErrors.join('; ')}`
    }
    await prisma.cronExecutionLog.create({
      data: { jobName: 'fetch-news', status: logStatus, message: logMessage, detail: logDetail },
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
    logStatus = 'failed'
    logMessage = error.message || '执行失败'
    logDetail = error.stack || ''
    await prisma.cronExecutionLog.create({
      data: { jobName: 'fetch-news', status: logStatus, message: logMessage, detail: logDetail },
    })
    return NextResponse.json(
      { error: error.message || '执行失败' },
      { status: 500 }
    )
  }
}
