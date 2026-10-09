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

// 日期兜底窗口：主要防重复靠跨周 URL 去重，此窗口仅挡极旧陈文
const DATE_WINDOW_DAYS = 30

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
        if (!withinDays(date, DATE_WINDOW_DAYS)) continue // 宽窗口兜底，防重复靠跨周 URL 去重
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
        if (!withinDays(date, DATE_WINDOW_DAYS)) continue
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
  // 噪声判定：短行做更严格的过滤（导航/来源/作者单位/页面标题等），长行仅通用黑名单
  const META_NOISE =
    /(tel\s*[:：])|负责制作维护|版权所有|ICP备|责任编辑|纠错：|扫码|扫描二维码|copyright|all rights reserved/i
  const SHORT_NOISE_PREFIX =
    /^(来源|发布时间|时间|日期|编辑|作者|审核|监审|责编|浏览量|阅读量|分享|打印|字号|上一篇|下一篇|返回|相关阅读|推荐阅读|热点|专题|更多|首页|登录|注册|搜索|评论|点赞|收藏)\s*[:：]?/
  const SHORT_NOISE_EXTRA = /组织部|宣传部|纪委监委|机关党委|作者单位|通讯员|积分|距下一级|您需要登录/
  const PAGE_TITLE = /_.{2,12}网$/
  const HAS_CN = /[\u4e00-\u9fa5]/
  const seen = new Set<string>()
  const lines = plain
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    // ⚠️ 不能按长度丢弃短行：时评的分论点常是 15~30 字的排比小标题，一旦被丢
    //    AI 就只能自行概括，导致「分论点提取不准」。改为按噪声特征过滤。
    .filter((l) => {
      if (l.length < 12) return false
      if (META_NOISE.test(l)) return false
      if (l.length < 40) {
        if (SHORT_NOISE_PREFIX.test(l)) return false
        if (SHORT_NOISE_EXTRA.test(l)) return false
        if (PAGE_TITLE.test(l)) return false
        if (!HAS_CN.test(l)) return false
      }
      if (seen.has(l)) return false
      seen.add(l)
      return true
    })

  // 导航块清理：部分站点（如南方网）页首有几十条机构导航（「广东省XX网 / 网站 / 官网」），
  // 长度 12~30 字、不含标点，会绕过上面的短行过滤。仅当此类行成片出现（≥5 条）时才
  // 判定为导航并剔除，避免误删正常小标题（如「打造数字政务平台」这类单条标题）。
  const NAV_LIKE = /(网|网站|官网|平台|中心|委员会|集团|厅|局)$/
  const navish = new Set(
    lines.filter((l) => l.length < 40 && !/[。，、；：？！]/.test(l) && NAV_LIKE.test(l))
  )
  if (navish.size >= 5) {
    for (let i = lines.length - 1; i >= 0; i--) {
      if (navish.has(lines[i])) lines.splice(i, 1)
    }
  }

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
        `【第${i + 1}篇】标题：${sanitizeForJSON(a.title)}（来源：${sanitizeForJSON(a.source)}）\n正文摘录：${sanitizeForJSON(a.body.slice(0, 4000))}`
    )
    .join('\n\n')

  const prompt = `你是资深申论写作素材编辑。以下是${articles.length}篇时评文章（已注明来源），请逐篇提炼写作素材。

对每篇输出：
1. topic：从考情主题清单中选最贴切的一个主题名；确实不属于任何主题时可自拟简短主题名（4-6字）
2. thesis：全文总论点。**原样摘录**原文中最能概括全文立意的中心句，一个字都不改；原文确实没有可作为总论点的原句时才归纳。**尽量不超过 60 字**；中心句更长时，只从中截取最核心的分句（只截取、不换词）
3. subPoints：全文分论点（0-4 个，通常 2-3 个）。**必须先"定位"再"原样摘录"——严禁自己概括、改写、压缩，也不得为追求对仗/简练而增删或替换词语。**
   定位方法：分论点通常是原文中**句式并列、字数相近的一组句子**，常见形态：
   ① 正文各层次的小标题（单独成行，如「用心察民情，在躬身一线中夯实为民根基。」）
   ② 各段段首的排比句／对仗句（如「要…要…要…」「一是…二是…三是…」「既…又…」）
   ③ 各段段尾收束的中心句
   先通读全文，把这类候选句子按出现顺序抓出来，再从中选出构成全文骨架的 2-4 句，逐字照抄（可保留句末标点）。
   **单句不超过 40 字**：超过 40 字的句子一定不是分论点，请改选更短的对仗句，或直接少给几条。
   ⚠️ 严禁改写：原文是「用心察民情，在躬身一线中夯实为民根基」，却输出「俯身下沉走进群众，扎实开展调查研究，摸清真实底数」——这是改写，不是摘录。
   ⚠️ 宁可少给也不充数：活动报道、个人札记、经验通讯等**叙事类文章本就没有并列论点结构**，此时 subPoints 可为空数组，绝不要拿整段段落或叙述句充当分论点。
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

    // 0. 加载历史全部已入库文章 URL（跨周去重：更新慢的站点不会重复入库旧文）
    const pastRows = await prisma.weeklyMaterial.findMany({ select: { articles: true } })
    const historicalUrls = new Set<string>()
    for (const r of pastRows) {
      try {
        for (const a of JSON.parse(r.articles) as { url: string }[]) {
          if (a?.url) historicalUrls.add(a.url)
        }
      } catch {
        // 单期数据损坏不影响整体
      }
    }
    console.log(`📚 历史已入库文章：${historicalUrls.size} 篇`)

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
        if (seen.has(item.url) || historicalUrls.has(item.url)) continue
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
