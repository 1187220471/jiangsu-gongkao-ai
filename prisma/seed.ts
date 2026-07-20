import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PETS = [
  { name: '橘猫', enName: 'OrangeCat', rarity: 'common' },
  { name: '蓝猫', enName: 'BlueCat', rarity: 'common' },
  { name: '银渐层', enName: 'SilverShaded', rarity: 'common' },
  { name: '柯基', enName: 'Corgi', rarity: 'common' },
  { name: '柴犬', enName: 'Shiba', rarity: 'common' },
  { name: '仓鼠', enName: 'Hamster', rarity: 'common' },
  { name: '垂耳兔', enName: 'LopRabbit', rarity: 'common' },
  { name: '布偶', enName: 'Ragdoll', rarity: 'rare' },
  { name: '泰迪', enName: 'Poodle', rarity: 'rare' },
  { name: '金毛', enName: 'GoldenRetriever', rarity: 'rare' },
  { name: '萨摩耶', enName: 'Samoyed', rarity: 'rare' },
  { name: '边牧', enName: 'BorderCollie', rarity: 'rare' },
  { name: '哈士奇', enName: 'Husky', rarity: 'epic' },
  { name: '龙猫', enName: 'Chinchilla', rarity: 'epic' },
  { name: '小熊猫', enName: 'RedPanda', rarity: 'epic' },
  { name: '企鹅', enName: 'Penguin', rarity: 'legendary' },
]

async function main() {
  console.log('Seeding supply items...')

  for (const pet of PETS) {
    await prisma.supplyItem.upsert({
      where: { name: pet.name },
      update: {},
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
