import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== 修复 examTitle 中的类别空格问题 ===\n')

  // 找出所有 examTitle 中包含 "（X 类）" 格式（有空格）的记录
  const titleIssues = await prisma.$queryRaw`
    SELECT DISTINCT "examTitle"
    FROM zhenti_question
    WHERE "examTitle" LIKE '%（% 类）%'
    ORDER BY "examTitle"
  `

  const titlesToFix = (titleIssues as any[]).map(r => r.examTitle as string)
  console.log(`发现 ${titlesToFix.length} 个需要修复的 examTitle（类别含空格）`)

  for (const oldTitle of titlesToFix) {
    // 将 "（A 类）" 替换为 "（A类）"
    const newTitle = oldTitle.replace(/（(\w) 类）/g, '（$1类）')
    const result = await prisma.zhentiQuestion.updateMany({
      where: { examTitle: oldTitle },
      data: { examTitle: newTitle },
    })
    console.log(`✅ 修复 examTitle: "${oldTitle}" → "${newTitle}", 影响 ${result.count} 条记录`)
  }

  // 验证修复结果
  console.log('\n=== 验证修复结果 ===')
  const remainingIssues = await prisma.$queryRaw`
    SELECT "examDate", "examCategory", COUNT(DISTINCT "examTitle") as title_count, 
           STRING_AGG(DISTINCT "examTitle", ' | ') as titles,
           COUNT(*) as total_questions
    FROM zhenti_question
    GROUP BY "examDate", "examCategory"
    HAVING COUNT(DISTINCT "examTitle") > 1
    ORDER BY "examDate" DESC
  `

  const issues = remainingIssues as any[]
  if (issues.length === 0) {
    console.log('✅ 所有数据不一致问题已修复！')
  } else {
    console.log('⚠️ 仍有以下不一致：')
    issues.forEach(r => {
      console.log(`  - ${r.examDate} ${r.examCategory}: ${r.titles}`)
    })
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
