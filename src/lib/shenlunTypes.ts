// 申论题型枚举与归一化
// 词表口径沿用 scripts/normalize-shenlun-types.ts，避免各处自由字符串漂移

export const SHENLUN_QUESTION_TYPES = [
  '归纳概括',
  '综合分析',
  '贯彻执行',
  '提出对策',
  '大作文',
  '经验总结',
  '其他',
] as const

export type ShenlunQuestionType = typeof SHENLUN_QUESTION_TYPES[number]

// 历史自由字符串 → 枚举
const LEGACY_TYPE_MAP: Record<string, ShenlunQuestionType> = {
  观点分析: '综合分析',
  词句理解: '综合分析',
  评析评价: '综合分析',
  '贯彻执行/公文写作': '贯彻执行',
  公文写作: '贯彻执行',
  应用文写作: '贯彻执行',
  文章写作: '大作文',
  申发论述: '大作文',
}

export function normalizeQuestionType(raw: string): ShenlunQuestionType {
  const text = (raw || '').trim()
  if (!text) return '其他'
  if ((SHENLUN_QUESTION_TYPES as readonly string[]).includes(text)) {
    return text as ShenlunQuestionType
  }
  if (LEGACY_TYPE_MAP[text]) return LEGACY_TYPE_MAP[text]
  return '其他'
}

// 按题干关键词推断题型；顺序敏感，命中即返回
const TYPE_RULES: Array<{ type: ShenlunQuestionType; re: RegExp }> = [
  { type: '大作文', re: /写一篇|自拟标题|议论文|文章写作|写一篇文章|结合.{0,20}写/ },
  {
    type: '贯彻执行',
    re: /拟写|起草|公开信|倡议书|建议书|讲话稿|发言稿|宣传稿|汇报|简报|提纲|纪要|启事|工作方案|实施方案/,
  },
  { type: '归纳概括', re: /概括|归纳|梳理|提炼/ },
  { type: '提出对策', re: /对策|建议|措施|如何解决|怎么办|解决办法/ },
  { type: '综合分析', re: /理解|分析|评价|评析|谈谈看法|谈谈认识|启示/ },
  { type: '经验总结', re: /经验|做法|成功之道/ },
]

export function inferQuestionType(questionText: string): ShenlunQuestionType {
  const text = questionText || ''
  for (const rule of TYPE_RULES) {
    if (rule.re.test(text)) return rule.type
  }
  return '其他'
}
