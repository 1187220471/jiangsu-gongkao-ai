export interface User {
  id: string
  username: string
  nickname?: string
}

export interface RecordItem {
  id: string
  questionType: string
  question: string
  referenceAnswer?: string
  userAnswer?: string
  evaluation?: string
  score?: number
  createdAt: string
}

export type QuestionType =
  | 'social'
  | 'attitude'
  | 'organize'
  | 'emergency'
  | 'relationship'
  | 'self'
  | 'situational'
  | 'custom'

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  social: '社会现象类',
  attitude: '态度观点类',
  organize: '组织管理类',
  emergency: '应急应变类',
  relationship: '人际关系类',
  self: '自我认知类',
  situational: '情景模拟类',
  custom: '自定义题目',
}
