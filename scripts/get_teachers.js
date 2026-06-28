const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
async function main() {
  const teachers = await prisma.shenlunTeacherAnswer.groupBy({
    by: ['teacherName'],
    _count: { teacherName: true },
    orderBy: { _count: { teacherName: 'desc' } }
  })
  console.log(JSON.stringify(teachers, null, 2))
  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
