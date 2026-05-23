'use client'

import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx'

interface QuestionItem {
  index: number
  type: string
  typeName: string
  question: string
  topic: string
}

interface SetData {
  mode: string
  name: string
  time: string
  questions: QuestionItem[]
}

interface Evaluation {
  score: number
  evaluation: string
  improvedAnswer: string
}

/**
 * 生成套题Word文档并下载
 */
export async function downloadSetDoc(
  setData: SetData,
  userAnswers: Record<number, string>,
  refAnswers: Record<number, string>,
  evaluations?: Record<number, Evaluation>
) {
  const date = new Date().toLocaleDateString('zh-CN')
  const children: Paragraph[] = []

  // 标题
  children.push(
    new Paragraph({
      text: setData.name,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
    })
  )
  children.push(
    new Paragraph({
      text: `生成日期：${date} · 建议作答时间：${setData.time}`,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  )

  // 计算套题总分
  if (evaluations) {
    const scores = Object.values(evaluations).map(e => e.score).filter(s => s > 0)
    if (scores.length > 0) {
      const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      children.push(
        new Paragraph({
          text: `套题总分：${avg}分`,
          heading: HeadingLevel.HEADING_2,
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
        })
      )
    }
  }

  // 每道题
  setData.questions.forEach((q) => {
    const eval_ = evaluations?.[q.index]

    // 题号和题型
    children.push(
      new Paragraph({
        text: `第${q.index}题 【${q.typeName}】${eval_ ? `· AI评分：${eval_.score}分` : ''}`,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      })
    )

    // 题目内容
    const questionLines = q.question.split('\n').filter(line => line.trim())
    questionLines.forEach(line => {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: line, size: 24 })],
          spacing: { after: 120 },
          indent: { firstLine: 480 },
        })
      )
    })

    // 用户答案
    if (userAnswers[q.index]) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: '【你的答案】',
              bold: true,
              color: '2563EB',
            }),
          ],
          spacing: { before: 300, after: 200 },
        })
      )
      const userLines = userAnswers[q.index].split('\n').filter(line => line.trim())
      userLines.forEach(line => {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: line, size: 24 })],
            spacing: { after: 120 },
            indent: { firstLine: 480 },
          })
        )
      })
    }

    // AI批改结果
    if (eval_) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `【AI批改 · ${eval_.score}分】`,
              bold: true,
              color: eval_.score >= 80 ? '16A34A' : eval_.score >= 60 ? 'D97706' : 'DC2626',
            }),
          ],
          spacing: { before: 300, after: 200 },
        })
      )
      const evalLines = eval_.evaluation.split('\n').filter(line => line.trim())
      evalLines.forEach(line => {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: line, size: 24 })],
            spacing: { after: 120 },
            indent: { firstLine: 480 },
          })
        )
      })

      // 改进版答案
      if (eval_.improvedAnswer) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: '【改进版答案】',
                bold: true,
                color: '7C3AED',
              }),
            ],
            spacing: { before: 300, after: 200 },
          })
        )
        const improvedLines = eval_.improvedAnswer.split('\n').filter(line => line.trim())
        improvedLines.forEach(line => {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: line, size: 24 })],
              spacing: { after: 120 },
              indent: { firstLine: 480 },
            })
          )
        })
      }
    }

    // 参考答案
    if (refAnswers[q.index]) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: '【参考答案】',
              bold: true,
              color: '2D7D46',
            }),
          ],
          spacing: { before: 300, after: 200 },
        })
      )
      const refLines = refAnswers[q.index].split('\n').filter(line => line.trim())
      refLines.forEach(line => {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: line, size: 24 })],
            spacing: { after: 120 },
            indent: { firstLine: 480 },
          })
        )
      })
    }

    // 分隔
    children.push(new Paragraph({ text: '', spacing: { after: 200 } }))
  })

  // 创建文档
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1440,
            right: 1440,
            bottom: 1440,
            left: 1440,
          },
        },
      },
      children,
    }],
  })

  // 生成并下载
  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${setData.name}_${date}.docx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * 备用方案：用HTML格式生成.doc文件（兼容性更好）
 */
export function downloadSetDocHtml(
  setData: SetData,
  userAnswers: Record<number, string>,
  refAnswers: Record<number, string>,
  evaluations?: Record<number, Evaluation>
) {
  const date = new Date().toLocaleDateString('zh-CN')

  // 计算套题总分
  let totalScoreHtml = ''
  if (evaluations) {
    const scores = Object.values(evaluations).map(e => e.score).filter(s => s > 0)
    if (scores.length > 0) {
      const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      totalScoreHtml = `<div style="text-align:center; font-size:16px; font-weight:bold; color:#D97706; margin-bottom:20px;">套题总分：${avg}分</div>`
    }
  }

  let html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${setData.name}</title>
<style>
body { font-family: "SimSun", "宋体", serif; line-height: 1.8; max-width: 800px; margin: 0 auto; padding: 40px; }
h1 { text-align: center; font-size: 22px; font-weight: bold; margin-bottom: 10px; }
.subtitle { text-align: center; font-size: 14px; color: #666; margin-bottom: 30px; }
.divider { border-top: 2px solid #333; margin: 20px 0; }
.question-title { font-size: 16px; font-weight: bold; margin: 20px 0 10px; }
.question-type { font-size: 12px; color: #666; margin-bottom: 10px; }
.question-content { font-size: 14px; margin-bottom: 15px; text-indent: 2em; }
.answer-title { font-size: 14px; font-weight: bold; color: #2d7d46; margin: 15px 0 10px; }
.answer-content { font-size: 14px; text-indent: 2em; }
.user-answer-title { font-size: 14px; font-weight: bold; color: #2563eb; margin: 15px 0 10px; }
.user-answer-content { font-size: 14px; text-indent: 2em; }
.eval-title { font-size: 14px; font-weight: bold; margin: 15px 0 10px; }
.eval-content { font-size: 14px; text-indent: 2em; }
.improved-title { font-size: 14px; font-weight: bold; color: #7c3aed; margin: 15px 0 10px; }
.improved-content { font-size: 14px; text-indent: 2em; }
</style>
</head>
<body>
<h1>${setData.name}</h1>
<div class="subtitle">生成日期：${date} · 建议作答时间：${setData.time}</div>
${totalScoreHtml}
<div class="divider"></div>
`

  setData.questions.forEach((q) => {
    const eval_ = evaluations?.[q.index]
    const scoreColor = eval_ ? (eval_.score >= 80 ? '#16A34A' : eval_.score >= 60 ? '#D97706' : '#DC2626') : '#666'

    html += `
<div class="question-title">第${q.index}题 【${q.typeName}】${eval_ ? `· AI评分：${eval_.score}分` : ''}</div>
<div class="question-content">${q.question.replace(/\n/g, '<br>')}</div>
`
    if (userAnswers[q.index]) {
      html += `
<div class="user-answer-title">【你的答案】</div>
<div class="user-answer-content">${userAnswers[q.index].replace(/\n/g, '<br>')}</div>
`
    }
    if (eval_) {
      html += `
<div class="eval-title" style="color:${scoreColor}">【AI批改 · ${eval_.score}分】</div>
<div class="eval-content">${eval_.evaluation.replace(/\n/g, '<br>')}</div>
`
      if (eval_.improvedAnswer) {
        html += `
<div class="improved-title">【改进版答案】</div>
<div class="improved-content">${eval_.improvedAnswer.replace(/\n/g, '<br>')}</div>
`
      }
    }
    if (refAnswers[q.index]) {
      html += `
<div class="answer-title">【参考答案】</div>
<div class="answer-content">${refAnswers[q.index].replace(/\n/g, '<br>')}</div>
`
    }
    html += `<div class="divider"></div>`
  })

  html += `
</body>
</html>
`

  const blob = new Blob([html], { type: 'application/msword' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${setData.name}_${date}.doc`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
