export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function callAI(messages: AIMessage[]): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.DASHSCOPE_API_KEY
  const baseUrl = process.env.DEEPSEEK_BASE_URL || process.env.DASHSCOPE_BASE_URL || 'https://api.deepseek.com'

  if (!apiKey) {
    throw new Error('AI API Key not configured')
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_API_KEY ? 'deepseek-chat' : 'qwen-max',
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`AI API error: ${error}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

export async function generateQuestion(type: string): Promise<string> {
  const typeMap: Record<string, string> = {
    'social': '社会现象类',
    'attitude': '态度观点类',
    'organize': '组织管理类',
    'emergency': '应急应变类',
    'relationship': '人际关系类',
    'self': '自我认知类',
  }

  const typeName = typeMap[type] || '社会现象类'

  const systemPrompt = `你是一位资深江苏省公务员面试命题专家，精通江苏省考面试的命题风格和特点。你需要生成一道高质量的江苏省公务员结构化面试题。

要求：
1. 题目要紧密结合江苏省情、时政热点或基层治理实际
2. 题目难度适中，符合江苏省考面试真题风格
3. 题目表述清晰，背景信息完整
4. 只输出题目内容，不要输出任何分析、提示或其他说明文字
5. 题目字数控制在200-400字之间`

  const userPrompt = `请生成一道${typeName}的江苏省公务员面试题。`

  return callAI([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ])
}

export async function generateReferenceAnswer(question: string): Promise<string> {
  const systemPrompt = `你是一位资深公务员面试培训专家，拥有多年江苏省考面试辅导经验。你需要针对给定的面试题，生成一份高质量的参考答案。

要求：
1. 答案结构清晰，包含：总体评价/表态、多角度分析、具体做法/对策
2. 内容要体现政府思维，政治站位正确
3. 语言规范，符合公务员面试答题风格
4. 要有江苏地方特色，能结合江苏省情或相关政策
5. 字数控制在400-800字之间
6. 只输出答案内容，不要输出其他说明文字`

  return callAI([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `请为以下面试题生成参考答案：\n\n${question}` },
  ])
}

export async function evaluateAnswer(question: string, referenceAnswer: string, userAnswer: string): Promise<{ score: number; evaluation: string }> {
  const systemPrompt = `你是一位资深公务员面试考官，拥有多年江苏省考面试评分经验。你需要根据用户提交的答案进行专业批改。

评分标准（满分100分）：
- 内容完整性（25分）：是否覆盖了题目的核心要点
- 逻辑条理性（20分）：结构是否清晰，层次分明
- 政策理论水平（20分）：是否正确运用政策理论，政治站位是否准确
- 语言表达（15分）：用词是否规范，表达是否流畅
- 对策可行性（20分）：提出的措施是否具体、可行、有针对性

批改要求：
1. 给出总分（0-100的整数）
2. 从优点和不足两个方面进行点评
3. 提出具体的改进建议
4. 保持客观、专业、建设性的语气
5. 输出格式必须是JSON：{"score": 数字, "evaluation": "点评内容"}

重要：evaluation字段中的内容不要包含JSON引号，使用纯文本。`

  const userPrompt = `面试题目：\n${question}\n\n参考答案：\n${referenceAnswer}\n\n用户答案：\n${userAnswer}\n\n请进行批改，返回JSON格式。`

  const response = await callAI([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ])

  try {
    // 尝试从回复中提取JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0])
      return {
        score: Math.min(100, Math.max(0, Math.round(result.score))),
        evaluation: result.evaluation || '批改完成',
      }
    }
    throw new Error('Invalid response format')
  } catch {
    // 如果解析失败，返回默认格式
    return {
      score: 60,
      evaluation: response,
    }
  }
}

export async function answerQuestion(question: string): Promise<string> {
  // 这与generateReferenceAnswer相同，只是接口不同
  return generateReferenceAnswer(question)
}
