/**
 * 申论真题数据入库脚本
 * 读取 .workbuddy/knowledge/ 下全部 jiangsu-shenlun-*.json（如 2018-2025、2026），
 * 写入 ShenlunQuestion / ShenlunMaterial / ShenlunTeacherAnswer
 *
 * 运行方式（在项目根目录 daijinli-web）：
 * npx tsx prisma/seed-shenlun.ts
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

/** 定位知识库目录（兼容 cwd 为 daijinli-web 或工作区根目录两种情况） */
function resolveDataFiles(): string[] {
  const candidates = [
    path.join(process.cwd(), '.workbuddy', 'knowledge'),
    path.join(process.cwd(), '..', '.workbuddy', 'knowledge'),
  ]
  for (const dir of candidates) {
    if (!fs.existsSync(dir)) continue
    const files = fs
      .readdirSync(dir)
      .filter((f) => /^jiangsu-shenlun-.*\.json$/.test(f))
      .sort()
      .map((f) => path.join(dir, f))
    if (files.length > 0) return files
  }
  return []
}

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
  const dataFiles = resolveDataFiles()
  if (dataFiles.length === 0) {
    console.error('未找到申论数据文件（.workbuddy/knowledge/jiangsu-shenlun-*.json）')
    process.exit(1)
  }

  const rawData: RawExam[] = dataFiles.flatMap((f) => {
    console.log(`  读取 ${path.basename(f)}`)
    return JSON.parse(fs.readFileSync(f, 'utf-8')) as RawExam[]
  })
  console.log(`读取到 ${rawData.length} 套申论真题（来自 ${dataFiles.length} 个文件）`)

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
      //    名师答案仅删除本次将要写入的同名条目，保留其他来源（如由
      //    seed-shenlun-reference-answers.ts 生成的 “AI参考答案”），避免误删
      await prisma.shenlunMaterial.deleteMany({ where: { questionId: question.id } })
      const incomingTeachers = (q.answers || []).map((a) => a.teacher || '未知')
      if (incomingTeachers.length > 0) {
        await prisma.shenlunTeacherAnswer.deleteMany({
          where: { questionId: question.id, teacherName: { in: incomingTeachers } },
        })
      }

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
