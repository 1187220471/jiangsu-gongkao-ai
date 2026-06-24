/**
 * 申论真题数据入库脚本
 * 从项目根目录下的 .workbuddy/knowledge/jiangsu-shenlun-2018-2025-merged.json
 * 读取 2018-2025 年江苏申论真题，写入 ShenlunQuestion / ShenlunMaterial / ShenlunTeacherAnswer
 *
 * 运行方式（在项目根目录）：
 * npx tsx prisma/seed-shenlun.ts
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

const DATA_PATH = path.join(process.cwd(), '.workbuddy', 'knowledge', 'jiangsu-shenlun-2018-2025-merged.json')

interface RawAnswer {
  teacher: string
  content: string
}

interface RawQuestion {
  num: string
  questionText: string
  questionType: string
  score?: number
  wordLimit?: string
  materialRange?: string
  relatedMaterials?: string[]
  materials?: Record<string, string>
  answers: RawAnswer[]
}

interface RawExam {
  year: string
  category: string
  examTitle: string
  materials?: Record<string, string>
  questions: RawQuestion[]
}

function toExamDate(year: string): string {
  // 申论一般为每年 12 月笔试，无精确日期时用当年 12 月 1 日占位
  return `${year}-12-01`
}

async function main() {
  if (!fs.existsSync(DATA_PATH)) {
    console.error(`数据文件不存在: ${DATA_PATH}`)
    process.exit(1)
  }

  const rawData: RawExam[] = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'))
  console.log(`读取到 ${rawData.length} 套申论真题`)

  let examCount = 0
  let questionCount = 0
  let materialCount = 0
  let answerCount = 0

  for (const exam of rawData) {
    const examYear = parseInt(exam.year)
    const examCategory = exam.category.trim()
    const examTitle = exam.examTitle.trim()
    const examDate = toExamDate(exam.year)

    for (const q of exam.questions) {
      const questionNumber = parseInt(q.num)
      if (isNaN(questionNumber)) {
        console.warn(`跳过非法题号: ${examTitle} / ${q.num}`)
        continue
      }

      // 1. 幂等：查找或创建题目主体
      const question = await prisma.shenlunQuestion.upsert({
        where: {
          examYear_examCategory_questionNumber: {
            examYear,
            examCategory,
            questionNumber,
          },
        },
        create: {
          examTitle,
          examYear,
          examDate,
          examCategory,
          questionNumber,
          questionText: q.questionText || '',
          questionType: q.questionType || '未分类',
          score: q.score ?? null,
          wordLimit: q.wordLimit ?? null,
          materialRange: q.materialRange ?? null,
          referenceAnswer: null,
        },
        update: {
          examTitle,
          examDate,
          questionText: q.questionText || '',
          questionType: q.questionType || '未分类',
          score: q.score ?? null,
          wordLimit: q.wordLimit ?? null,
          materialRange: q.materialRange ?? null,
        },
      })

      // 2. 清空旧关联数据（保证可重复执行）
      await prisma.shenlunMaterial.deleteMany({ where: { questionId: question.id } })
      await prisma.shenlunTeacherAnswer.deleteMany({ where: { questionId: question.id } })

      // 3. 写入材料
      const qMaterials = q.materials || {}
      const materialEntries = Object.entries(qMaterials)
      if (materialEntries.length > 0) {
        await prisma.shenlunMaterial.createMany({
          data: materialEntries.map(([num, content], idx) => ({
            questionId: question.id,
            materialNum: num,
            content: content || '',
            materialOrder: idx,
          })),
        })
        materialCount += materialEntries.length
      }

      // 4. 写入名师答案
      if (q.answers && q.answers.length > 0) {
        await prisma.shenlunTeacherAnswer.createMany({
          data: q.answers.map((ans, idx) => ({
            questionId: question.id,
            teacherName: ans.teacher || '未知',
            answerText: ans.content || '',
            answerOrder: idx,
          })),
        })
        answerCount += q.answers.length
      }

      questionCount++
    }

    examCount++
    if (examCount % 5 === 0) {
      console.log(`  已处理 ${examCount}/${rawData.length} 套卷...`)
    }
  }

  console.log(`\n入库完成！`)
  console.log(`  套卷: ${examCount}`)
  console.log(`  题目: ${questionCount}`)
  console.log(`  材料: ${materialCount}`)
  console.log(`  名师答案: ${answerCount}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
