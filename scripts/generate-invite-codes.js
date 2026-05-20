/**
 * 批量生成邀请码脚本
 *
 * 使用方法：
 * 1. 确保在项目根目录下
 * 2. 运行：node scripts/generate-invite-codes.js <数量>
 *    例如：node scripts/generate-invite-codes.js 10
 * 3. 生成的邀请码会自动存入数据库，并打印在控制台
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// 生成随机邀请码：MIANSHI2026 + 4位随机字符（大写字母+数字）
function generateCode() {
  const prefix = 'MIANSHI2026'
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let suffix = ''
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return prefix + suffix
}

async function main() {
  const count = parseInt(process.argv[2], 10)

  if (!count || count <= 0) {
    console.log('❌ 请指定生成数量')
    console.log('用法：node scripts/generate-invite-codes.js <数量>')
    console.log('示例：node scripts/generate-invite-codes.js 10')
    process.exit(1)
  }

  if (count > 1000) {
    console.log('⚠️  一次最多生成1000个邀请码')
    process.exit(1)
  }

  console.log(`🎯 准备生成 ${count} 个月卡邀请码...\n`)

  const codes = []
  const codeSet = new Set()

  // 生成不重复的邀请码
  while (codeSet.size < count) {
    const code = generateCode()
    // 检查数据库中是否已存在
    const existing = await prisma.invitationCode.findUnique({
      where: { code },
    })
    if (!existing) {
      codeSet.add(code)
    }
  }

  // 批量存入数据库
  const data = Array.from(codeSet).map((code) => ({
    code,
    type: 'month',
    used: false,
  }))

  await prisma.invitationCode.createMany({
    data,
    skipDuplicates: true,
  })

  console.log('✅ 邀请码生成成功！\n')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  序号  |  邀请码')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  data.forEach((item, index) => {
    console.log(`  ${String(index + 1).padStart(3, '0')}   |  ${item.code}`)
  })
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`\n📋 共生成 ${data.length} 个月卡邀请码`)
  console.log('💡 提示：邀请码为一次性使用，用户输入后即失效')
}

main()
  .catch((e) => {
    console.error('❌ 生成失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
