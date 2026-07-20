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

async function main() {
  console.log('Seeding supply items...')

  for (const pet of PETS) {
    await prisma.supplyItem.upsert({
      where: { name: pet.name },
      update: { rarity: pet.rarity },
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
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
