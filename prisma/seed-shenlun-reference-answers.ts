/**
 * 申论参考答案批量生成入库脚本
 * 为每道申论题生成一份 teacherName='AI参考答案' 的标准答案
 *
 * 运行方式（在项目根目录）：
 * npx tsx prisma/seed-shenlun-reference-answers.ts
 */

import { PrismaClient } from '@prisma/client'
import { generateShenlunReferenceAnswer } from '../src/lib/ai'

const prisma = new PrismaClient()

const BATCH_SIZE = 5
const RETRY_LIMIT = 2

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  const questions = await prisma.shenlunQuestion.findMany({
    include: {
      materials: { orderBy: { materialOrder: 'asc' } },
      answers: { orderBy: { answerOrder: 'asc' } },
    },
    orderBy: [
      { examYear: 'asc' },
      { examCategory: 'asc' },
      { questionNumber: 'asc' },
    ],
  })

  console.log(`共 ${questions.length} 道申论题需要生成参考答案`)

  let successCount = 0
  let failCount = 0

  for (let i = 0; i < questions.length; i += BATCH_SIZE) {
    const batch = questions.slice(i, i + BATCH_SIZE)

    await Promise.all(
      batch.map(async (q) => {
        // 删除旧的 AI 参考答案后重新生成
        await prisma.shenlunTeacherAnswer.deleteMany({
          where: { questionId: q.id, teacherName: 'AI参考答案' },
        })

        let lastError: unknown = null
        for (let attempt = 0; attempt <= RETRY_LIMIT; attempt++) {
          try {
            const referenceAnswer = await generateShenlunReferenceAnswer(
              q.questionText,
              q.materials.map(m => ({ materialNum: String(m.materialNum), content: m.content })),
              q.questionType,
              q.score || 20,
              q.wordLimit,
              q.answers.filter(a => a.teacherName !== 'AI参考答案').map(a => ({ teacherName: a.teacherName, answerText: a.answerText }))
            )

            await prisma.shenlunTeacherAnswer.create({
              data: {
                questionId: q.id,
                teacherName: 'AI参考答案',
                answerText: referenceAnswer,
                answerOrder: -1,
              },
            })

            successCount++
            console.log(`  [成功] ${q.examYear}${q.examCategory} 第${q.questionNumber}题（${referenceAnswer.length}字）`)
            return
          } catch (error) {
            lastError = error
            console.error(`  [失败] ${q.examYear}${q.examCategory} 第${q.questionNumber}题 第${attempt + 1}次`, error)
            if (attempt < RETRY_LIMIT) {
              await sleep(2000)
            }
          }
        }

        failCount++
        console.error(`  [最终失败] ${q.examYear}${q.examCategory} 第${q.questionNumber}题`, lastError)
      })
    )

    console.log(`进度: ${Math.min(i + BATCH_SIZE, questions.length)}/${questions.length}，成功 ${successCount}，失败 ${failCount}`)

    if (i + BATCH_SIZE < questions.length) {
      await sleep(1000)
    }
  }

  console.log(`\n生成完成！成功 ${successCount} 道，失败 ${failCount} 道`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
