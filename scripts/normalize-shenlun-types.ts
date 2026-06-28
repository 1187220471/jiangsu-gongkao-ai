import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TYPE_MAP: Record<string, string> = {
  '观点分析': '综合分析',
  '词句理解': '综合分析',
  '评析评价': '综合分析',
}

async function normalizeShenlunTypes() {
  // 1. 批量映射已知题型
  for (const [from, to] of Object.entries(TYPE_MAP)) {
    const res = await prisma.shenlunQuestion.updateMany({
      where: { questionType: from },
      data: { questionType: to },
    })
    console.log(`${from} → ${to}: ${res.count} 条`)
  }

  // 2. 处理 "其他" —— 按内容关键词判断
  const others = await prisma.shenlunQuestion.findMany({
    where: { questionType: '其他' },
    select: { id: true, questionText: true },
  })

  for (const q of others) {
    const text = q.questionText || ''
    let target = '综合分析'

    if (/拟写|启事|方案|思路|活动|论坛|征集|讲话稿|发言稿|调研报告|宣传稿|倡议书|建议书|公开信|汇报|简报|纪要/.test(text)) {
      target = '贯彻执行/公文写作'
    } else if (/概括|归纳|总结|提炼/.test(text)) {
      target = '归纳概括'
    } else if (/对策|建议|措施|如何解决|怎么办/.test(text)) {
      target = '提出对策'
    }

    await prisma.shenlunQuestion.update({
      where: { id: q.id },
      data: { questionType: target },
    })
    console.log(`其他 id=${q.id} → ${target}`)
  }

  // 3. 校验最终分布
  const distribution = await prisma.shenlunQuestion.groupBy({
    by: ['questionType'],
    _count: { questionType: true },
  })
  console.log('=== 最终题型分布 ===')
  console.log(JSON.stringify(distribution, null, 2))
}

normalizeShenlunTypes()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
