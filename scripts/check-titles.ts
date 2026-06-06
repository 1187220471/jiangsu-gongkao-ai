import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 查询所有有问题的日期（同一日期+类别但examTitle不同）
  const result = await prisma.$queryRaw`
    SELECT "examDate", "examCategory", COUNT(DISTINCT "examTitle") as title_count, 
           STRING_AGG(DISTINCT "examTitle", ' | ') as titles,
           COUNT(*) as total_questions
    FROM zhenti_question
    GROUP BY "examDate", "examCategory"
    HAVING COUNT(DISTINCT "examTitle") > 1
    ORDER BY "examDate" DESC
  `
  console.log('=== 同一套题但examTitle不同的记录 ===')
  console.log((result as any[]).map(r => ({
    examDate: r.examDate,
    examCategory: r.examCategory,
    titleCount: Number(r.title_count),
    titles: r.titles,
    totalQuestions: Number(r.total_questions)
  })))

  // 查询所有题目的examTitle分布
  const allTitles = await prisma.$queryRaw`
    SELECT "examDate", "examCategory", "examTitle", 
           STRING_AGG("questionNumber"::text, ',' ORDER BY "questionNumber") as questions
    FROM zhenti_question
    GROUP BY "examDate", "examCategory", "examTitle"
    ORDER BY "examDate" DESC, "examCategory", "examTitle"
  `
  console.log('\n=== 所有题目的examTitle分布 ===')
  console.log((allTitles as any[]).map(r => ({
    examDate: r.examDate,
    examCategory: r.examCategory,
    examTitle: r.examTitle,
    questions: r.questions
  })))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
