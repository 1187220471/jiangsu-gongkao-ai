/**
 * 批量生成邀请码脚本（直接写入 Neon 云端数据库）
 *
 * 使用方法：
 * 1. 确保 .env 文件里有 NEON_DATABASE_URL（Neon 数据库连接串）
 * 2. 运行：node scripts/generate-invite-codes-neon.js <数量>
 *    例如：node scripts/generate-invite-codes-neon.js 10
 * 3. 生成的邀请码直接存入 Neon 数据库，不用手动复制
 */

require('dotenv').config()
const { Client } = require('pg')
const crypto = require('crypto')

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

// 生成 UUID
function generateUUID() {
  return crypto.randomUUID()
}

async function main() {
  const count = parseInt(process.argv[2], 10)
  const type = process.argv[3] || 'month'

  if (!count || count <= 0) {
    console.log('❌ 请指定生成数量')
    console.log('用法：node scripts/generate-invite-codes-neon.js <数量> [类型]')
    console.log('示例：node scripts/generate-invite-codes-neon.js 10')
    console.log('       node scripts/generate-invite-codes-neon.js 10 month')
    console.log('       node scripts/generate-invite-codes-neon.js 10 year')
    process.exit(1)
  }

  if (count > 1000) {
    console.log('⚠️  一次最多生成1000个邀请码')
    process.exit(1)
  }

  if (type !== 'month' && type !== 'year') {
    console.log('❌ 邀请码类型只能是 month 或 year')
    process.exit(1)
  }

  // 读取 Neon 数据库连接串
  const connectionString = process.env.NEON_DATABASE_URL

  if (!connectionString) {
    console.log('❌ 找不到 NEON_DATABASE_URL 环境变量')
    console.log('')
    console.log('📋 解决步骤：')
    console.log('1. 打开 Neon 控制台 → Dashboard → Connection Details')
    console.log('2. 复制 postgresql://... 开头的连接串')
    console.log('3. 在 .env 文件里添加一行：')
    console.log('   NEON_DATABASE_URL="postgresql://..."')
    console.log('4. 重新运行此脚本')
    console.log('')
    console.log('💡 或者直接用旧脚本生成后手动复制到 Neon：')
    console.log('   node scripts/generate-invite-codes.js 10')
    process.exit(1)
  }

  const typeLabel = type === 'year' ? '年卡' : '月卡'
  console.log(`🎯 准备生成 ${count} 个${typeLabel}邀请码并写入 Neon...\n`)

  const client = new Client({ connectionString })

  try {
    await client.connect()
    console.log('✅ 已连接 Neon 数据库\n')

    // 生成不重复的邀请码
    const codes = []
    const codeSet = new Set()

    while (codeSet.size < count) {
      const code = generateCode()
      // 检查数据库中是否已存在
      const checkRes = await client.query(
        'SELECT 1 FROM "InvitationCode" WHERE code = $1 LIMIT 1',
        [code]
      )
      if (checkRes.rowCount === 0 && !codeSet.has(code)) {
        codeSet.add(code)
        codes.push({
          id: generateUUID(),
          code,
          type,
          used: false,
        })
      }
    }

    // 批量插入
    for (const item of codes) {
      await client.query(
        'INSERT INTO "InvitationCode" ("id", "code", "type", "used", "createdAt") VALUES ($1, $2, $3, $4, NOW())',
        [item.id, item.code, item.type, item.used]
      )
    }

    console.log('✅ 邀请码生成成功并已写入 Neon！\n')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('  序号  |  邀请码          |  类型')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    codes.forEach((item, index) => {
      const typeDisplay = item.type === 'year' ? '年卡' : '月卡'
      console.log(`  ${String(index + 1).padStart(3, '0')}   |  ${item.code}  |  ${typeDisplay}`)
    })
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`\n📋 共生成 ${codes.length} 个${typeLabel}邀请码`)
    console.log('💡 提示：邀请码为一次性使用，用户输入后即失效')
    console.log('🌐 现在去 Neon Tables 里刷新就能看到记录了')
  } catch (error) {
    console.error('❌ 生成失败:', error.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
