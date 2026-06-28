const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const renames = [
  { from: '唐棣', to: '某棣' },
  { from: '袁东', to: '某东' },
  { from: 'Kiwi', to: '某wi' },
  { from: '千寻', to: '某寻' },
  { from: '小马哥', to: '某马哥' },
  { from: '半月谈', to: '某月谈' },
  { from: '永岸', to: '某岸' },
  { from: '博约', to: '某约' },
  { from: '林峰', to: '某峰' },
  { from: '路小路', to: '某小路' },
  { from: '四海飞扬', to: '某海飞扬' },
  { from: '天政', to: '某政' },
]

async function main() {
  for (const { from, to } of renames) {
    const result = await prisma.shenlunTeacherAnswer.updateMany({
      where: { teacherName: from },
      data: { teacherName: to },
    })
    console.log(`"${from}" -> "${to}": ${result.count} 条`)
  }
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
