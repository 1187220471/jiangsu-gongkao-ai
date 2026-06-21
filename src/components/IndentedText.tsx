'use client'

interface IndentedTextProps {
  text: string
  className?: string
  paragraphClassName?: string
  compact?: boolean
}

/**
 * 判断一段文字是否像标题（较短且没有句末标点）。
 * 用于大作文答案中，让标题单独一行且不加首行缩进。
 */
function isTitleLike(paragraph: string): boolean {
  const len = paragraph.length
  const hasSentenceEnd = /[。！？；]/.test(paragraph)
  // 30 字以内且没有句末标点的行，视为标题
  return len <= 30 && !hasSentenceEnd
}

/**
 * 将纯文本按换行分段渲染，正文每段首行缩进 2 字符。
 * 适用于材料原文、申论参考答案、真题复盘答案等长文本展示。
 */
export default function IndentedText({
  text,
  className = '',
  paragraphClassName = '',
  compact = false,
}: IndentedTextProps) {
  const raw = text || ''
  // 按单换行分段：Word/JSON 中段落之间通常只有一个 \n
  const paragraphs = raw
    .split('\n')
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  if (paragraphs.length === 0) {
    return <div className={className} />
  }

  return (
    <div className={className}>
      {paragraphs.map((paragraph, idx) => {
        const isTitle = isTitleLike(paragraph)
        return (
          <p
            key={idx}
            className={`${compact ? 'mb-1 last:mb-0' : 'mb-4 last:mb-0'} ${
              isTitle
                ? 'font-medium text-slate-800'
                : 'indent-8 text-slate-700'
            } ${paragraphClassName}`}
          >
            {paragraph}
          </p>
        )
      })}
    </div>
  )
}
