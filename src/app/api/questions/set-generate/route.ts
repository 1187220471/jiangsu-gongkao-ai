import { NextResponse } from 'next/server'
import { generateQuestion } from '@/lib/ai'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { checkAccess } from '@/lib/quota'

// 套题题型概率配置
const SET_CONFIG = {
  '3': {
    name: '江苏事业单位面试套题',
    time: '12分钟',
    questions: [
      { types: ['social', 'attitude'], weights: [0.8, 0.2] },      // 第1题
      { types: ['organize', 'emergency'], weights: [0.5, 0.5] },   // 第2题
      { types: ['situational', 'relationship'], weights: [0.8, 0.2] }, // 第3题
    ],
  },
  '4': {
    name: '江苏公务员面试套题',
    time: '15分钟',
    questions: [
      { types: ['social', 'attitude'], weights: [0.8, 0.2] },      // 第1题
      { types: ['organize'], weights: [1.0] },                     // 第2题
      { types: ['organize', 'emergency'], weights: [0.5, 0.5] },   // 第3题
      { types: ['situational', 'relationship'], weights: [0.8, 0.2] }, // 第4题
    ],
  },
}

function weightedRandomChoice(types: string[], weights: number[]): string {
  const random = Math.random()
  let cumulative = 0
  for (let i = 0; i < types.length; i++) {
    cumulative += weights[i]
    if (random <= cumulative) {
      return types[i]
    }
  }
  return types[types.length - 1]
}

export async function POST(request: Request) {
  try {
    const auth = requireAuth(request)
    if (!auth.success) {
      return auth.response
    }

    // 检查是否为邀请用户
    const accessCheck = await checkAccess(auth.userId)
    if (!accessCheck.hasAccess) {
      return NextResponse.json(
        { error: accessCheck.message },
        { status: 403 }
      )
    }

    const { mode } = await request.json()

    if (!mode || !SET_CONFIG[mode as keyof typeof SET_CONFIG]) {
      return NextResponse.json(
        { error: '请选择有效的套题模式（3题或4题）' },
        { status: 400 }
      )
    }

    const config = SET_CONFIG[mode as keyof typeof SET_CONFIG]

    // 读取用户最近使用过的主题（去重缓存）
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { recentTopics: true },
    })

    const recentTopics: string[] = user?.recentTopics ?? []

    // 按概率生成每道题（领域去重：套题内不重复领域）
    const questions = []
    const usedTopics = [...recentTopics]
    const usedDomains: string[] = []

    for (let i = 0; i < config.questions.length; i++) {
      const qConfig = config.questions[i]
      const type = weightedRandomChoice(qConfig.types, qConfig.weights)

      // 生成题目（传入已用主题 + 已用领域，双重去重）
      const result = await generateQuestion(type, usedTopics, usedDomains)

      // 记录已使用的主题和领域
      usedTopics.push(result.topic)
      usedDomains.push(result.domain)

      questions.push({
        index: i + 1,
        type,
        typeName: getTypeName(type),
        question: result.question,
        topic: result.topic,
        domain: result.domain,
      })
    }

    // 更新去重缓存（只保留最近25个主题，原为10）
    const updatedTopics = usedTopics.slice(-25)
    await prisma.user.update({
      where: { id: auth.userId },
      data: { recentTopics: updatedTopics },
    })

    return NextResponse.json({
      mode,
      name: config.name,
      time: config.time,
      questions,
    })
  } catch (error) {
    console.error('Set generate error:', error)
    return NextResponse.json(
      { error: '生成套题失败，请稍后重试' },
      { status: 500 }
    )
  }
}

function getTypeName(type: string): string {
  const typeMap: Record<string, string> = {
    'social': '社会现象类',
    'attitude': '态度观点类',
    'organize': '组织管理类',
    'emergency': '应急应变类',
    'relationship': '人际关系类',
    'self': '自我认知类',
    'situational': '情景模拟类',
  }
  return typeMap[type] || '社会现象类'
}
