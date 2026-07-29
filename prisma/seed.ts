import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PETS = [
  // 普通（12）
  { name: '橘猫', enName: 'OrangeCat', rarity: 'common' },
  { name: '蓝猫', enName: 'BlueCat', rarity: 'common' },
  { name: '银渐层', enName: 'SilverShaded', rarity: 'common' },
  { name: '柯基', enName: 'Corgi', rarity: 'common' },
  { name: '柴犬', enName: 'Shiba', rarity: 'common' },
  { name: '泰迪', enName: 'Poodle', rarity: 'common' },
  { name: '金毛', enName: 'GoldenRetriever', rarity: 'common' },
  { name: '哈士奇', enName: 'Husky', rarity: 'common' },
  { name: '萨摩耶', enName: 'Samoyed', rarity: 'common' },
  { name: '边牧', enName: 'BorderCollie', rarity: 'common' },
  { name: '仓鼠', enName: 'Hamster', rarity: 'common' },
  { name: '垂耳兔', enName: 'LopRabbit', rarity: 'common' },
  // 稀有（4）
  { name: '布偶', enName: 'Ragdoll', rarity: 'rare' },
  { name: '龙猫', enName: 'Chinchilla', rarity: 'rare' },
  { name: '小熊猫', enName: 'RedPanda', rarity: 'rare' },
  { name: '企鹅', enName: 'Penguin', rarity: 'rare' },
]

const NBA_STARS = [
  // 稀有（3）
  { name: '库里', pinyin: 'curry', rarity: 'rare', desc: '斯蒂芬·库里，金州勇士队，三分球革命引领者。' },
  { name: '杜兰特', pinyin: 'durant', rarity: 'rare', desc: '凯文·杜兰特，太阳队，四届得分王。' },
  { name: '詹姆斯', pinyin: 'lebron', rarity: 'rare', desc: '勒布朗·詹姆斯，湖人队，历史得分王。' },
  // 普通（9）
  { name: '东契奇', pinyin: 'doncic', rarity: 'common', desc: '卢卡·东契奇，独行侠队，全能后卫。' },
  { name: '亚历山大', pinyin: 'sga', rarity: 'common', desc: '谢伊·吉尔杰斯-亚历山大，雷霆队。' },
  { name: '利拉德', pinyin: 'lillard', rarity: 'common', desc: '达米安·利拉德，雄鹿队，关键时刻先生。' },
  { name: '哈登', pinyin: 'harden', rarity: 'common', desc: '詹姆斯·哈登，快船队，三届得分王。' },
  { name: '字母哥', pinyin: 'giannis', rarity: 'common', desc: '扬尼斯·阿德托昆博，雄鹿队，两届MVP。' },
  { name: '恩比德', pinyin: 'embiid', rarity: 'common', desc: '乔尔·恩比德，76人队，内线统治者。' },
  { name: '爱德华兹', pinyin: 'edwards', rarity: 'common', desc: '安东尼·爱德华兹，森林狼队，新生代飞人。' },
  { name: '约基奇', pinyin: 'jokic', rarity: 'common', desc: '尼古拉·约基奇，掘金队，三届MVP。' },
  { name: '莫兰特', pinyin: 'morant', rarity: 'common', desc: '贾·莫兰特，灰熊队，爆发力惊人。' },
]

async function main() {
  console.log('Seeding supply items...')

  for (const pet of PETS) {
    await prisma.supplyItem.upsert({
      where: { name: pet.name },
      update: { rarity: pet.rarity, category: 'pixelPet' },
      create: {
        category: 'pixelPet',
        rarity: pet.rarity,
        name: pet.name,
        description: `${pet.name}是一只可爱的像素风萌宠。`,
        imageUrl: `/collection/pet-${pet.enName.toLowerCase()}-120.png`,
      },
    })
  }

  console.log(`Seeded ${PETS.length} pixel pets.`)

  for (const star of NBA_STARS) {
    await prisma.supplyItem.upsert({
      where: { name: star.name },
      update: { rarity: star.rarity, category: 'nbaStar' },
      create: {
        category: 'nbaStar',
        rarity: star.rarity,
        name: star.name,
        description: star.desc,
        imageUrl: `/collection/nba-${star.pinyin}-120.png`,
      },
    })
  }

  console.log(`Seeded ${NBA_STARS.length} NBA stars.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
