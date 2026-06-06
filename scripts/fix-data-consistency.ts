import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== 开始修复数据不一致问题 ===\n')

  // 1. 修复 examCategory 空格问题：统一为 "A类" 格式（无空格）
  const categoryFixes = [
    { from: 'A 类', to: 'A类' },
    { from: 'B 类', to: 'B类' },
    { from: 'C 类', to: 'C类' },
  ]

  for (const fix of categoryFixes) {
    const result = await prisma.zhentiQuestion.updateMany({
      where: { examCategory: fix.from },
      data: { examCategory: fix.to },
    })
    console.log(`✅ 修复 examCategory: "${fix.from}" → "${fix.to}", 影响 ${result.count} 条记录`)
  }

  // 2. 修复 examTitle 日期格式不一致：统一为 "7月9日" 格式（无前置0）
  // 先找出所有有问题的记录
  const titleIssues = await prisma.$queryRaw`
    SELECT DISTINCT "examTitle"
    FROM zhenti_question
    WHERE "examTitle" LIKE '%月0%日%'
    ORDER BY "examTitle"
  `

  const titlesToFix = (titleIssues as any[]).map(r => r.examTitle as string)
  console.log(`\n发现 ${titlesToFix.length} 个需要修复的 examTitle（含前置0的日期）`)

  for (const oldTitle of titlesToFix) {
    // 将 "7月09日" 替换为 "7月9日"
    const newTitle = oldTitle.replace(/月0(\d)日/g, '月$1日')
    const result = await prisma.zhentiQuestion.updateMany({
      where: { examTitle: oldTitle },
      data: { examTitle: newTitle },
    })
    console.log(`✅ 修复 examTitle: "${oldTitle}" → "${newTitle}", 影响 ${result.count} 条记录`)
  }

  // 3. 验证修复结果
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

  // 4. 统计最终数据
  const totalCount = await prisma.zhentiQuestion.count()
  console.log(`\n数据库总题数: ${totalCount}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
