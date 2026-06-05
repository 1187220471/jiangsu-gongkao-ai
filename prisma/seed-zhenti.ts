/**
 * 真题数据入库脚本
 * 从 /tmp/zhenti_batch/*.json 读取所有真题数据，写入 ZhentiQuestion 表
 *
 * 运行方式（在项目根目录）：
 * npx ts-node --project tsconfig.json -e "require('./prisma/seed-zhenti.ts')"
 * 或者：
 * npx tsx prisma/seed-zhenti.ts
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

// 从文件名解析考试元数据
// 文件名格式：2024_年_3_月_9_日江苏省考面试题（A_类）_Q1.json
function parseExamMeta(filename: string) {
  const base = path.basename(filename, '.json')

  // 提取题号
  const qMatch = base.match(/_Q(\d+)$/)
  const questionNumber = qMatch ? parseInt(qMatch[1]) : 1

  // 去掉 _Q1 后缀
  const examPart = base.replace(/_Q\d+$/, '')

  // 解析年份
  const yearMatch = examPart.match(/^(\d{4})_年/)
  const examYear = yearMatch ? parseInt(yearMatch[1]) : 2000

  // 解析月日
  const dateMatch = examPart.match(/^(\d{4})_年_(\d{1,2})_月_(\d{1,2})_日/)
  let examDate = `${examYear}-01-01`
  if (dateMatch) {
    const month = dateMatch[2].padStart(2, '0')
    const day = dateMatch[3].padStart(2, '0')
    examDate = `${examYear}-${month}-${day}`
  }

  // 提取考试名称（将下划线还原为空格）
  // 先将文件名中的下划线还原
  const examTitle = examPart
    .replace(/^(\d{4})_年_(\d{1,2})_月_(\d{1,2})_日/, (_, y, m, d) => `${y}年${m}月${d}日`)
    .replace(/_/g, ' ')
    .replace(/（\s+/g, '（')
    .replace(/\s+）/g, '）')
    .trim()

  // 提取类别（括号内容）
  const categoryMatch = examTitle.match(/（([^）]+)）/)
  const examCategory = categoryMatch ? categoryMatch[1].trim() : null

  return { examTitle, examYear, examDate, examCategory, questionNumber }
}

// 根据题目文本猜测题型
function guessQuestionType(text: string): string {
  const t = text
  if (/紧急|突发|事故|险情|现场|危|处置/.test(t)) return '应急应变类'
  if (/同事|领导|上级|下级|矛盾|关系|冲突/.test(t)) return '人际关系类'
  if (/组织|安排|策划|活动|方案|实施|推进/.test(t)) return '组织管理类'
  if (/你认为|你的看法|谈谈你|如何看待|怎么看/.test(t)) return '态度观点类'
  if (/自我|你的优势|你的缺点|为什么选择|介绍/.test(t)) return '自我认知类'
  if (/假设|如果你|你被任命|假如/.test(t)) return '情景模拟类'
  return '社会现象类'
}

async function main() {
  const jsonDir = '/tmp/zhenti_batch'
  const files = fs
    .readdirSync(jsonDir)
    .filter((f) => f.endsWith('.json') && f !== 'summary.json' && f !== 'summary_remaining.json')
    .sort()

  console.log(`找到 ${files.length} 个题目 JSON 文件`)

  let successCount = 0
  let skipCount = 0
  let errorCount = 0

  for (const file of files) {
    const filePath = path.join(jsonDir, file)

    let data: any
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    } catch (e) {
      console.error(`解析失败: ${file}`, e)
      errorCount++
      continue
    }

    const { examTitle, examYear, examDate, examCategory, questionNumber } = parseExamMeta(file)

    // 检查是否已存在（幂等）—— 唯一键：日期 + 类别 + 题号
    const existing = await prisma.zhentiQuestion.findFirst({
      where: { examDate, examCategory, questionNumber },
    })
    if (existing) {
      skipCount++
      continue
    }

    // 提取3个答案
    const answers = data.answers || []
    const a1 = answers.find((a: any) => a.id === 1) || answers[0] || {}
    const a2 = answers.find((a: any) => a.id === 2) || answers[1] || {}
    const a3 = answers.find((a: any) => a.id === 3) || answers[2] || {}

    // 提取评分
    const comparison = data.comparison || {}
    const compDetails: any[] = comparison.comparison || []
    const getScore = (id: number) => {
      const d = compDetails.find((c: any) => c.answer_id === id)
      return d ? d.total_score : 0
    }

    try {
      await prisma.zhentiQuestion.create({
        data: {
          examTitle,
          examYear,
          examDate,
          examCategory,
          questionNumber,
          questionText: data.question_text || '',
          questionType: guessQuestionType(data.question_text || ''),
          answer1: a1.content || '',
          answer2: a2.content || '',
          answer3: a3.content || '',
          score1: getScore(1),
          score2: getScore(2),
          score3: getScore(3),
          comparison: JSON.stringify(comparison),
          finalAnswer: data.final_answer || '',
          finalWordCount: data.final_word_count || 0,
        },
      })
      successCount++
      if (successCount % 20 === 0) {
        console.log(`  已写入 ${successCount} 条...`)
      }
    } catch (e) {
      console.error(`写入失败: ${file}`, e)
      errorCount++
    }
  }

  console.log(`\n入库完成！`)
  console.log(`  成功: ${successCount}`)
  console.log(`  跳过(已存在): ${skipCount}`)
  console.log(`  失败: ${errorCount}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
