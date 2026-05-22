const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const today = new Date().toISOString().split('T')[0]

  await prisma.dailyNews.upsert({
    where: { date: today },
    update: {
      topNews: JSON.stringify([
        {
          topic: '民生保障',
          title: '江苏出台一揽子政策大力支持城市更新',
          date: today,
          source: '江苏省人民政府网',
          score: 9.5,
          intro: '江苏发布系统性政策支持城市更新，涵盖老旧小区改造、基础设施升级等。该政策是申论民生保障、城市治理等话题的绝佳对策库。',
          url: 'https://www.jiangsu.gov.cn/'
        },
        {
          topic: '区域协调',
          title: '长三角一体化发展高层论坛举行',
          date: today,
          source: '江苏省人民政府网',
          score: 9.0,
          intro: '长三角最高级别会议在上海举行，聚焦一体化发展新路径。是申论区域协调发展、长三角一体化等话题的核心素材。',
          url: 'https://www.jiangsu.gov.cn/'
        },
        {
          topic: '经济发展',
          title: '《江苏省民营经济促进条例》正式实施',
          date: today,
          source: '中国新闻网|江苏',
          score: 10,
          intro: '江苏以地方立法形式为民营经济保驾护航。是申论营商环境、民营经济、法治政府等话题的顶级素材。',
          url: 'https://www.js.chinanews.com.cn/'
        }
      ]),
    },
    create: {
      date: today,
      topNews: JSON.stringify([
        {
          topic: '民生保障',
          title: '江苏出台一揽子政策大力支持城市更新',
          date: today,
          source: '江苏省人民政府网',
          score: 9.5,
          intro: '江苏发布系统性政策支持城市更新，涵盖老旧小区改造、基础设施升级等。该政策是申论民生保障、城市治理等话题的绝佳对策库。',
          url: 'https://www.jiangsu.gov.cn/'
        },
        {
          topic: '区域协调',
          title: '长三角一体化发展高层论坛举行',
          date: today,
          source: '江苏省人民政府网',
          score: 9.0,
          intro: '长三角最高级别会议在上海举行，聚焦一体化发展新路径。是申论区域协调发展、长三角一体化等话题的核心素材。',
          url: 'https://www.jiangsu.gov.cn/'
        },
        {
          topic: '经济发展',
          title: '《江苏省民营经济促进条例》正式实施',
          date: today,
          source: '中国新闻网|江苏',
          score: 10,
          intro: '江苏以地方立法形式为民营经济保驾护航。是申论营商环境、民营经济、法治政府等话题的顶级素材。',
          url: 'https://www.js.chinanews.com.cn/'
        }
      ]),
      allNews: '[]'
    }
  })

  console.log('测试数据插入成功')
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect())
