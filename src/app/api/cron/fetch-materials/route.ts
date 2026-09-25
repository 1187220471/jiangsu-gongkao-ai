import { NextRequest, NextResponse } from 'next/server'
import { jsonrepair } from 'jsonrepair'
import { prisma } from '@/lib/db'
import { CORE_THEMES, SECONDARY_THEMES } from '@/lib/newsThemes'

// 强制动态渲染，防止边缘缓存
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// ============ 周标识（北京时间本周一日期） ============

function getWeekKey(now = new Date()): string {
  const bj = new Date(now.getTime() + 8 * 3600 * 1000)
  const day = bj.getUTCDay() // 0=周日
  const offset = day === 0 ? 6 : day - 1
  const monday = new Date(bj.getTime() - offset * 86400000)
  return monday.toISOString().slice(0, 10)
}

// ============ 站点配置 ============

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

interface ListItem {
  title: string
  url: string
  publishDate?: string
  teaser?: string // 南方网列表自带导语
}

function withinDays(dateStr: string | undefined, days: number): boolean {
  if (!dateStr) return true // 无日期的不过滤
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return true
  return Date.now() - d.getTime() <= days * 86400000
}

const MATERIAL_SITES = [
  {
    name: '共产党员网·投稿推荐',
    listUrl: 'https://tougao.12371.cn/tuijian.php',
    extractList: (html: string): ListItem[] => {
      const results: ListItem[] = []
      const re = /href="(gaojian\.php\?tid=\d+)"[^>]*>([^<]{6,80})</g
      let m
      while ((m = re.exec(html)) && results.length < 12) {
        const title = m[2].trim()
        if (title.includes('投稿须知') || title.includes('须知')) continue // 过滤置顶规则帖
        results.push({ title, url: 'https://tougao.12371.cn/' + m[1] })
      }
      return results
    },
  },
  {
    name: '甘肃网·理论频道',
    listUrl: 'https://theory.gscn.com.cn/llqy/',
    extractList: (html: string): ListItem[] => {
      const results: ListItem[] = []
      const re = /href="(\/\/theory\.gscn\.com\.cn\/system\/(\d{4})\/(\d{2})\/(\d{2})\/\d+\.shtml)"[^>]*>([^<]{6,80})</g
      let m
      while ((m = re.exec(html)) && results.length < 12) {
        const date = `${m[2]}-${m[3]}-${m[4]}`
        if (!withinDays(date, 10)) continue // 只取近 10 天
        results.push({ title: m[5].trim(), url: 'https:' + m[1], publishDate: date })
      }
      return results
    },
  },
  {
    name: '南方网·评论频道',
    listUrl: 'https://opinion.southcn.com/node_0f2134f032?cms_node_post_list_page=1',
    extractList: (html: string): ListItem[] => {
      const results: ListItem[] = []
      const blocks = html.split('<div class="itm j-link"').slice(1)
      for (const block of blocks) {
        if (results.length >= 12) break
        const urlM = block.match(/data-link="(https:\/\/opinion\.southcn\.com\/[^"]+\.shtml)"/)
        const titleM = block.match(/<h3>\s*<a[^>]*>([^<]{4,80})<\/a>/)
        const teaserM = block.match(/<div class="pa">([^<]+)<\/div>/)
        const timeM = block.match(/<div class="time">([\d-]+)[\s\d:]*<\/div>/)
        if (!urlM || !titleM) continue
        const date = timeM ? timeM[1] : undefined
        if (!withinDays(date, 10)) continue
        results.push({
          title: titleM[1].trim(),
          url: urlM[1],
          publishDate: date,
          teaser: teaserM ? teaserM[1].trim() : undefined,
        })
      }
      return results
    },
  },
]

// ============ 抓取工具 ============

async function fetchHtml(url: string, timeoutMs = 15000): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9' },
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

// HTML 实体解码（新闻站正文常见 &ldquo; &rdquo; 等）
function decodeHtmlEntities(text: string): string {
  const named: Record<string, string> = {
    '&ldquo;': '“',
    '&rdquo;': '”',
    '&lsquo;': '‘',
    '&rsquo;': '’',
    '&mdash;': '—',
    '&ndash;': '–',
    '&hellip;': '…',
    '&middot;': '·',
    '&copy;': '©',
    '&reg;': '®',
    '&trade;': '™',
    '&nbsp;': ' ',
    '&quot;': '"',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&times;': '×',
  }
  let out = text
  for (const [k, v] of Object.entries(named)) out = out.split(k).join(v)
  out = out.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  out = out.replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  return out
}

// 通用正文提取：去 script/style → 去标签 → 解码实体 → 拼接长段落（\n 分段）
function extractBodyText(html: string, maxLen = 6000): string {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
  const plain = decodeHtmlEntities(cleaned.replace(/<[^>]+>/g, '\n'))
  const lines = plain
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length >= 40)
    .filter((l) => !/(tel\s*[:：])|负责制作维护|版权所有|ICP备|责任编辑|纠错：|扫码|扫描二维码|copyright|all rights reserved/i.test(l))

  // 尾部修剪：从结尾向前剔除页脚特征段落（法律顾问声明、联系方式等，最多 5 段防误删）
  const FOOTER_PARA =
    /(律师事务所|法律顾问|特别声明|免责声明|版权声明|违法和不良信息|举报电话|值班电话|联系方式|地址[:：]|邮编[:：]|copyright|all rights reserved|负责制作维护|版权所有|ICP备|责任编辑|作者系|作者单位|作者简介|作者：)/i
  let trimmed = 0
  while (lines.length > 0 && trimmed < 5 && FOOTER_PARA.test(lines[lines.length - 1])) {
    lines.pop()
    trimmed++
  }
  const body: string[] = []
  let total = 0
  for (const l of lines) {
    if (total >= maxLen) break
    const remaining = maxLen - total
    if (l.length <= remaining) {
      body.push(l)
      total += l.length
    } else {
      // 兜底截断：在句子边界（。！？）切断，避免段落戛然而止
      const cut = l.slice(0, remaining)
      const lastStop = Math.max(cut.lastIndexOf('。'), cut.lastIndexOf('！'), cut.lastIndexOf('？'))
      body.push(lastStop > 0 ? cut.slice(0, lastStop + 1) : cut)
      total = maxLen
    }
  }
  return body.join('\n').trim()
}

async function fetchArticleBody(url: string): Promise<string> {
  const html = await fetchHtml(url, 12000)
  if (!html) return ''
  return extractBodyText(html)
}

// ============ AI 提炼 ============

const THEME_NAMES = [...CORE_THEMES, ...SECONDARY_THEMES].map((t) => t.name)

interface CuratedArticle {
  topic: string
  title: string
  source: string
  url: string
  publishDate: string
  thesis: string
  subPoints: string[]
  quotes: string[]
  content: string
  analysis: string
}

function sanitizeForJSON(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\n\r\t]/g, ' ')
}

async function aiCurate(articles: { title: string; source: string; body: string }[], apiKey: string) {
  const articlesText = articles
    .map(
      (a, i) =>
        `【第${i + 1}篇】标题：${sanitizeForJSON(a.title)}（来源：${sanitizeForJSON(a.source)}）\n正文摘录：${sanitizeForJSON(a.body.slice(0, 2000))}`
    )
    .join('\n\n')

  const prompt = `你是资深申论写作素材编辑。以下是${articles.length}篇时评文章（已注明来源），请逐篇提炼写作素材。

对每篇输出：
1. topic：从考情主题清单中选最贴切的一个主题名；确实不属于任何主题时可自拟简短主题名（4-6字）
2. thesis：全文总论点（1句，不超过40字）。优先从首段摘录原文原句（首段末尾的中心句通常是总论点）；首段无明确论点句时才归纳，归纳须忠实原文立意
3. subPoints：全文分论点（2-4个，每个不超过30字）。优先逐段摘录各段段首中心句原句（时评常见排比/对仗结构）；原文分论点为隐性递进结构时才归纳提纯，保持简练对仗
4. quotes：从原文摘录 2-3 句最值得积累的金句（保持原文，每句不超过 60 字，不与 thesis/subPoints 重复）
5. analysis：80-120字点评——这篇文章的论证结构（如"总-分-总""排比铺陈""正反对比"）、可套用的申论题型或面试场景

考情主题清单：${THEME_NAMES.join('、')}

${articlesText}

输出严格 JSON（不要 markdown 代码块，不要截断）：
{"items":[{"index":1,"topic":"主题名","thesis":"总论点","subPoints":["分论点1","分论点2"],"quotes":["金句1","金句2"],"analysis":"点评"}]}`

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 8000,
    }),
  })

  if (!response.ok) throw new Error(`AI API error: ${response.status}`)

  const data = await response.json()
  const content = data.choices[0].message.content

  let jsonStr = content
  const codeBlock = content.match(/```(?:json)?\n?([\s\S]*?)```/)
  if (codeBlock) jsonStr = codeBlock[1].trim()

  try {
    return JSON.parse(jsonStr)
  } catch {
    try {
      return JSON.parse(jsonrepair(jsonStr))
    } catch {
      const m = content.match(/\{[\s\S]*\}/)
      if (m) return JSON.parse(jsonrepair(m[0]))
      throw new Error('无法解析AI返回的JSON')
    }
  }
}

// ============ Cron 入口 ============

export async function GET(request: NextRequest) {
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
        data: { jobName: 'fetch-materials', status: logStatus, message: logMessage },
      })
      return NextResponse.json({ error: 'AI API Key not configured' }, { status: 500 })
    }

    const weekKey = getWeekKey()
    const existing = await prisma.weeklyMaterial.findUnique({ where: { week: weekKey } })
    if (existing) {
      logStatus = 'skipped'
      logMessage = `本周素材已存在 (${weekKey})，跳过重复执行`
      await prisma.cronExecutionLog.create({
        data: { jobName: 'fetch-materials', status: logStatus, message: logMessage },
      })
      return NextResponse.json({ success: true, week: weekKey, message: '本周素材已存在，跳过', skipped: true })
    }

    console.log(`[${new Date().toISOString()}] 开始抓取每周素材 (week=${weekKey})...`)

    // 1. 并行抓三站列表
    const listResults = await Promise.all(
      MATERIAL_SITES.map(async (site) => {
        const html = await fetchHtml(site.listUrl)
        if (!html) return { site: site.name, error: '列表页抓取失败', items: [] as ListItem[] }
        const items = site.extractList(html).slice(0, 8)
        return { site: site.name, items }
      })
    )

    // 2. 汇总 + 当期 URL 去重
    const seen = new Set<string>()
    const pending: { title: string; source: string; url: string; publishDate: string; teaser?: string }[] = []
    const siteErrors: string[] = []
    for (const r of listResults) {
      if (r.error) siteErrors.push(`${r.site}: ${r.error}`)
      for (const item of r.items) {
        if (seen.has(item.url)) continue
        seen.add(item.url)
        pending.push({
          title: item.title,
          source: r.site,
          url: item.url,
          publishDate: item.publishDate || weekKey,
          teaser: item.teaser,
        })
      }
    }

    console.log(`📊 列表抓取：${pending.length} 篇待处理`)
    if (pending.length === 0) {
      logStatus = 'failed'
      logMessage = '未抓取到任何素材文章'
      logDetail = siteErrors.join('; ')
      await prisma.cronExecutionLog.create({
        data: { jobName: 'fetch-materials', status: logStatus, message: logMessage, detail: logDetail },
      })
      return NextResponse.json({ error: '未抓取到任何素材文章' }, { status: 500 })
    }

    // 3. 并发抓正文（并发 6）
    const bodies: string[] = []
    const valid: typeof pending = []
    const CONCURRENCY = 6
    for (let i = 0; i < pending.length; i += CONCURRENCY) {
      const batch = pending.slice(i, i + CONCURRENCY)
      const contents = await Promise.all(batch.map((p) => fetchArticleBody(p.url)))
      contents.forEach((body, j) => {
        // 正文过短（<200字）视为失败；南方网用列表导语兜底
        const p = batch[j]
        if (body && body.length >= 200) {
          bodies.push(body)
          valid.push(p)
        } else if (p.teaser && p.teaser.length >= 30) {
          bodies.push(decodeHtmlEntities(p.teaser))
          valid.push(p)
        }
      })
    }

    console.log(`✅ 正文抓取成功：${valid.length}/${pending.length} 篇`)
    if (valid.length === 0) {
      logStatus = 'failed'
      logMessage = '所有文章正文抓取失败'
      logDetail = siteErrors.join('; ')
      await prisma.cronExecutionLog.create({
        data: { jobName: 'fetch-materials', status: logStatus, message: logMessage, detail: logDetail },
      })
      return NextResponse.json({ error: '所有文章正文抓取失败' }, { status: 500 })
    }

    // 4. AI 提炼
    console.log('🤖 开始AI素材提炼...')
    const aiResult = await aiCurate(
      valid.map((p, i) => ({ title: p.title, source: p.source, body: bodies[i] })),
      apiKey
    )
    const items = (aiResult.items || []) as {
      index: number
      topic: string
      thesis: string
      subPoints: string[]
      quotes: string[]
      analysis: string
    }[]

    const articles: CuratedArticle[] = valid.map((p, i) => {
      const c = items.find((it) => it.index === i + 1)
      return {
        topic: c?.topic || '综合',
        title: p.title,
        source: p.source,
        url: p.url,
        publishDate: p.publishDate,
        thesis: c?.thesis || '',
        subPoints: Array.isArray(c?.subPoints) ? c.subPoints.slice(0, 4) : [],
        quotes: Array.isArray(c?.quotes) ? c.quotes.slice(0, 3) : [],
        content: bodies[i],
        analysis: c?.analysis || '',
      }
    })

    console.log(`✅ AI提炼完成：${articles.length} 篇`)

    // 5. 入库
    await prisma.weeklyMaterial.upsert({
      where: { week: weekKey },
      update: { articles: JSON.stringify(articles) },
      create: { week: weekKey, articles: JSON.stringify(articles) },
    })

    const duration = Date.now() - startTime
    logMessage = `成功: ${weekKey}, articles=${articles.length}, 耗时${duration}ms`
    if (siteErrors.length > 0) logDetail = `部分站点失败: ${siteErrors.join('; ')}`
    await prisma.cronExecutionLog.create({
      data: { jobName: 'fetch-materials', status: logStatus, message: logMessage, detail: logDetail },
    })

    return NextResponse.json({ success: true, week: weekKey, count: articles.length, articles })
  } catch (error: any) {
    console.error('抓取每周素材失败:', error)
    logStatus = 'failed'
    logMessage = error.message || '执行失败'
    logDetail = error.stack || ''
    await prisma.cronExecutionLog.create({
      data: { jobName: 'fetch-materials', status: logStatus, message: logMessage, detail: logDetail },
    })
    return NextResponse.json({ error: error.message || '执行失败' }, { status: 500 })
  }
}
