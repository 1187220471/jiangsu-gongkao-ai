import { inferQuestionType, type ShenlunQuestionType } from './shenlunTypes'

export interface SplitQuestion {
  questionNumber: number
  questionText: string
  questionType: ShenlunQuestionType
  score: number | null
  wordLimit: string | null
}

export interface SplitResult {
  materialsText: string
  questions: SplitQuestion[]
  warnings: string[]
}

// 强标记：明确的分区标题；弱标记只在行首匹配，避免题干里的"问题"误伤
const STRONG_MARKER = /(?:作答要求|作答任务|作答题目|答题要求)/g
const WEAK_MARKER = /(?:^|\n)\s*(?:问题|请回答)\s*[:：]?/g

// 题号形态：第X题 / X. / X、 / X： / X） / （X）
const QUESTION_HEAD =
  /(?:^|\n|\s|[（(])(?:第\s*([一二三四五六七八九十]{1,3}|\d{1,2})\s*[题小]|([一二三四五六七八九十]{1,3}|\d{1,2})\s*[.．、：:）)])/g

const CN_DIGIT: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
}

function cnToNumber(raw: string): number | null {
  const s = (raw || '').trim()
  if (!s) return null
  if (/^\d+$/.test(s)) return parseInt(s, 10)
  if (s === '十') return 10
  if (s.length === 1) return CN_DIGIT[s] ?? null
  if (s.length === 2) {
    if (s[0] === '十') return 10 + (CN_DIGIT[s[1]] ?? 0)
    if (s[1] === '十') return (CN_DIGIT[s[0]] ?? 0) * 10
  }
  if (s.length === 3 && s[1] === '十') {
    return (CN_DIGIT[s[0]] ?? 0) * 10 + (CN_DIGIT[s[2]] ?? 0)
  }
  return null
}

function normalizeText(raw: string): string {
  let text = (raw || '').replace(/\r\n?/g, '\n')
  // 全角数字 → 半角（不动标点，保持原文可读）
  text = text.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
  // 零宽字符
  text = text.replace(/[\u200b-\u200d\ufeff]/g, '')

  const lines = text.split('\n')

  // 纯页码行
  const withoutPageNumbers = lines.filter(
    (line) => !/^\s*[-—－]?\s*\d{1,3}\s*[-—－]?\s*$/.test(line)
  )

  // 重复页眉页脚：出现 ≥3 次且 <30 字；排除"给定资料/材料"标题，避免误删
  const counts = new Map<string, number>()
  for (const line of withoutPageNumbers) {
    const t = line.trim()
    if (!t || t.length >= 30) continue
    if (/(?:给定)?(?:资料|材料)/.test(t)) continue
    counts.set(t, (counts.get(t) || 0) + 1)
  }
  const repeated = new Set(
    Array.from(counts.entries())
      .filter(([, n]) => n >= 3)
      .map(([t]) => t)
  )

  const cleaned = repeated.size
    ? withoutPageNumbers.filter((line) => !repeated.has(line.trim()))
    : withoutPageNumbers

  return cleaned.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function collectHeads(source: string) {
  const heads: Array<{ num: number; index: number; bodyStart: number; paren: boolean }> = []
  QUESTION_HEAD.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = QUESTION_HEAD.exec(source)) !== null) {
    const rawNum = match[1] || match[2] || ''
    const num = cnToNumber(rawNum)
    if (num === null || num < 1 || num > 30) continue
    heads.push({
      num,
      index: match.index,
      bodyStart: QUESTION_HEAD.lastIndex,
      paren: /^[（(]/.test(match[0]),
    })
  }

  // 存在「一、」「1.」这类主干题号时，把「(1)(2)(3)」视为作答要求里的下级枚举，
  // 否则会把「要求：(1)…(4)篇幅…」误切成多道题，导致题干被截断。
  const hasPlainHead = heads.some((h) => !h.paren)
  return hasPlainHead ? heads.filter((h) => !h.paren) : heads
}

function extractScore(text: string): number | null {
  const patterns = [
    /[（(]\s*(\d{1,2})\s*分\s*[)）]/,
    /(\d{1,2})\s*分(?!钟)/,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m) {
      const n = parseInt(m[1], 10)
      if (n >= 1 && n <= 100) return n
    }
  }
  return null
}

function extractWordLimit(text: string): string | null {
  let m = text.match(/不超过\s*(\d{2,4})\s*字/)
  if (m) return `不超过${m[1]}字`

  m = text.match(/(\d{2,4})\s*字左右/)
  if (m) return `${m[1]}字左右`

  m = text.match(/(\d{2,4})\s*[-—~～至]\s*(\d{2,4})\s*字/)
  if (m) return `${m[1]}-${m[2]}字`

  m = text.match(/不少于\s*(\d{2,4})\s*字/)
  if (m) return `不少于${m[1]}字`

  m = text.match(/(\d{3,4})\s*字/)
  if (m) {
    const n = parseInt(m[1], 10)
    if (n >= 100 && n <= 3000) return `${n}字`
  }
  return null
}

const QUESTION_HINTS =
  /请|根据|结合|概括|归纳|分析|谈谈|拟写|撰写|写一篇|不超过|不少于|\d+\s*分/

/**
 * 清洗题干：去掉题号残留、分值与字数要求。
 * 这些信息已单独提取（score / wordLimit），重复出现在题干里会干扰模型。
 */
export function cleanQuestionText(text: string): string {
  let t = (text || '').trim()

  // 分值括号：（20分）/（本题20分）
  t = t.replace(/[（(]\s*(?:本题\s*)?\d{1,2}\s*分\s*[)）]/g, '')
  // 裸写分值：位于句末或标点前
  t = t.replace(/[，,。；;\s]*\d{1,2}\s*分(?=[。；;]|$)/g, '')

  // 字数要求：整段删除，含「篇幅/字数」前缀，容忍 OCR 插入的空格
  t = t.replace(
    /[，,。；;、\s]*(?:篇\s*幅|字\s*数)?\s*(?:不\s*超\s*过|不\s*少\s*于|不\s*多\s*于|至\s*少|约|在)?\s*\d{2,4}\s*字\s*(?:左\s*右|以\s*内|以\s*上)?/g,
    ''
  )
  // 区间字数：300-500字
  t = t.replace(
    /[，,。；;、\s]*\d{2,4}\s*[-—~～至]\s*\d{2,4}\s*字\s*(?:左\s*右|以\s*内)?/g,
    ''
  )

  // 清洗后残留：空的枚举序号 (4)
  t = t.replace(/[（(]\s*\d{1,2}\s*[)）]\s*(?=[。；;、，,\s]|$)/g, '')
  // 悬空的「篇幅 / 字数 / 左右 / 以内」
  t = t.replace(/[，,。；;、\s]*(?:篇\s*幅|字\s*数)\s*$/g, '')
  t = t.replace(/[，,。；;、\s]*(?:左\s*右|以\s*内|以\s*上)\s*$/g, '')
  // 悬空的「要求：」
  t = t.replace(/[，,、；;\s]*(?:作答)?要求\s*[：:]?\s*$/g, '')

  // 试卷尾部噪声
  t = t.replace(/[※*]{2,}[^※*]*[※*]{2,}/g, '')
  t = t.replace(/全部测验到此结束[!！]?/g, '')
  t = t.replace(/第\s*\d{1,3}\s*页\s*$/g, '')

  // 标点与空白清理
  t = t.replace(/[；;]\s*。/g, '。')
  t = t.replace(/。\s*。/g, '。')
  t = t.replace(/[，,、；;]\s*(?=[。．.])/g, '')
  t = t.replace(/\s{2,}/g, ' ')
  t = t.replace(/^[，,、；;。．.\s]+/, '')
  t = t.replace(/[，,、；;。．.\s]+$/, '')

  return t.trim()
}

function splitQuestions(source: string): {
  questions: SplitQuestion[]
  firstIndex: number
} {
  const heads = collectHeads(source)
  if (heads.length === 0) return { questions: [], firstIndex: -1 }

  const candidates: Array<{ num: number; text: string; index: number }> = []
  for (let i = 0; i < heads.length; i++) {
    const start = heads[i].bodyStart
    const end = i + 1 < heads.length ? heads[i + 1].index : source.length
    const text = source.slice(start, end).trim()
    if (text.length < 15) continue
    if (!QUESTION_HINTS.test(text)) continue
    candidates.push({ num: heads[i].num, text, index: heads[i].index })
  }

  // 同号取最长
  const byNumber = new Map<number, { num: number; text: string; index: number }>()
  for (const c of candidates) {
    const prev = byNumber.get(c.num)
    if (!prev || c.text.length > prev.text.length) byNumber.set(c.num, c)
  }

  const questions = Array.from(byNumber.values())
    .sort((a, b) => a.num - b.num)
    .map((c) => {
      // 先提取分值/字数，再清洗题干，避免清洗后丢失信息
      const score = extractScore(c.text)
      const wordLimit = extractWordLimit(c.text)
      return {
        questionNumber: c.num,
        questionText: cleanQuestionText(c.text),
        questionType: inferQuestionType(c.text),
        score,
        wordLimit,
      }
    })

  const firstIndex = candidates.length
    ? Math.min(...candidates.map((c) => c.index))
    : -1

  return { questions, firstIndex }
}

function findLastMarker(text: string): number {
  for (const re of [STRONG_MARKER, WEAK_MARKER]) {
    re.lastIndex = 0
    let last = -1
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) last = m.index
    if (last >= 0) return last
  }
  return -1
}

/**
 * 把整卷原文切成「材料区 + 题目列表」，纯规则，不调用 AI。
 * materialsText = 最后一次「作答要求/问题」分界之前的正文。
 */
export function splitShenlunPaper(rawText: string): SplitResult {
  const warnings: string[] = []
  const text = normalizeText(rawText)

  if (!text) {
    return { materialsText: '', questions: [], warnings: ['原文为空'] }
  }

  const markerIndex = findLastMarker(text)

  const hasMarker = markerIndex >= 0
  const materialsRaw = hasMarker ? text.slice(0, markerIndex) : ''
  const questionSource = hasMarker ? text.slice(markerIndex) : text

  if (!hasMarker) {
    warnings.push('未识别到「作答要求」，已按题号切分全文')
  }

  const { questions, firstIndex } = splitQuestions(questionSource)

  let materialsText = materialsRaw.trim()
  if (!materialsText) {
    if (hasMarker) {
      materialsText = ''
    } else if (firstIndex > 0) {
      materialsText = text.slice(0, firstIndex).trim()
    } else {
      materialsText = text
    }
  }

  if (questions.length === 0) {
    warnings.push('未识别到题目，可保存后手动添加')
  }

  return { materialsText, questions, warnings }
}

// ---- 材料分块与引用解析（用于生成答案时只投喂本题相关材料）----

const MAT_HEAD_STRICT =
  /(?:^|\n)\s*(?:【\s*)?(?:给定)?(?:资料|材料)\s*([0-9]{1,2}|[一二三四五六七八九十]{1,3})(?:\s*】)?\s*[：:、.．]?\s*/g

// 无换行文本的兜底：要求标题号后必须跟冒号/句点，降低把"根据给定资料3"误判为标题的概率
const MAT_HEAD_LOOSE =
  /(?:【\s*)?(?:给定)?(?:资料|材料)\s*([0-9]{1,2}|[一二三四五六七八九十]{1,3})(?:\s*】)?\s*[：:．.]/g

function collectMaterialHeads(text: string, strict: boolean) {
  const re = strict ? MAT_HEAD_STRICT : MAT_HEAD_LOOSE
  re.lastIndex = 0
  const heads: Array<{ num: string; index: number; bodyStart: number }> = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const n = cnToNumber(m[1])
    if (n === null || n < 1 || n > 30) continue
    heads.push({ num: String(n), index: m.index, bodyStart: re.lastIndex })
  }
  return heads
}

/**
 * 把整卷材料按「给定资料N」切成块。切不出来时返回单块「全文」。
 */
export function splitMaterials(text: string): Array<{ num: string; content: string }> {
  const trimmed = (text || '').trim()
  if (!trimmed) return []

  let heads = collectMaterialHeads(trimmed, true)
  if (heads.length < 2) heads = collectMaterialHeads(trimmed, false)
  if (heads.length < 2) return [{ num: '全文', content: trimmed }]

  const blocks: Array<{ num: string; content: string }> = []
  for (let i = 0; i < heads.length; i++) {
    const start = heads[i].bodyStart
    const end = i + 1 < heads.length ? heads[i + 1].index : trimmed.length
    const content = trimmed.slice(start, end).trim()
    if (content.length < 20) continue
    blocks.push({ num: heads[i].num, content })
  }

  // 同号取最长
  const byNum = new Map<string, { num: string; content: string }>()
  for (const b of blocks) {
    const prev = byNum.get(b.num)
    if (!prev || b.content.length > prev.content.length) byNum.set(b.num, b)
  }

  const result = Array.from(byNum.values()).sort((a, b) => Number(a.num) - Number(b.num))
  return result.length >= 2 ? result : [{ num: '全文', content: trimmed }]
}

const MATERIAL_REF =
  /(?:给定)?(?:资料|材料)\s*((?:\d{1,2})(?:\s*[-—~～至]\s*\d{1,2})?(?:\s*(?:[、和及]|,|，)\s*\d{1,2}(?:\s*[-—~～至]\s*\d{1,2})?)*)/g

/**
 * 从题干里解析引用的材料号，如「给定资料1-3」「资料2、4」。
 * 返回结果只保留 available 中存在的编号；解析不到返回空数组（调用方应投喂全部材料）。
 */
export function extractMaterialRefs(questionText: string, available: string[]): string[] {
  if (!questionText) return []
  const allowed = new Set(available)
  const found = new Set<string>()

  MATERIAL_REF.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = MATERIAL_REF.exec(questionText)) !== null) {
    const body = m[1] || ''
    for (const token of body.split(/[、和及,，]/)) {
      const t = token.trim()
      if (!t) continue

      const range = t.match(/^(\d{1,2})\s*[-—~～至]\s*(\d{1,2})$/)
      if (range) {
        const from = parseInt(range[1], 10)
        const to = parseInt(range[2], 10)
        if (from <= to && to - from <= 15) {
          for (let i = from; i <= to; i++) {
            if (allowed.has(String(i))) found.add(String(i))
          }
        }
        continue
      }

      const n = parseInt(t, 10)
      if (!Number.isNaN(n) && allowed.has(String(n))) found.add(String(n))
    }
  }

  return Array.from(found).sort((a, b) => Number(a) - Number(b))
}
