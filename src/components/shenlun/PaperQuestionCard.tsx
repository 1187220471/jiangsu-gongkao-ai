'use client'

import { useEffect, useState } from 'react'
import IndentedText from '@/components/IndentedText'
import { SHENLUN_QUESTION_TYPES } from '@/lib/shenlunTypes'

export interface PaperQuestion {
  id: string
  questionNumber: number
  questionText: string
  questionType: string
  score: number | null
  wordLimit: string | null
  answerText: string | null
  answerCharCount: number
  answerStatus: string
  answerError: string | null
  generatedAt?: string | null
  updatedAt?: string
}

interface PaperQuestionCardProps {
  question: PaperQuestion
  generating: boolean
  onGenerate: (question: PaperQuestion) => void
  onDelete: (question: PaperQuestion) => void
  onSave: (
    question: PaperQuestion,
    patch: { questionText: string; questionType: string; score: number | null; wordLimit: string | null }
  ) => Promise<void>
}

function isStale(question: PaperQuestion): boolean {
  if (question.answerStatus !== 'generating') return false
  if (!question.updatedAt) return true
  return Date.now() - new Date(question.updatedAt).getTime() > 2 * 60 * 1000
}

export default function PaperQuestionCard({
  question,
  generating,
  onGenerate,
  onDelete,
  onSave,
}: PaperQuestionCardProps) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(question.questionText)
  const [type, setType] = useState(question.questionType)
  const [score, setScore] = useState(question.score ? String(question.score) : '')
  const [wordLimit, setWordLimit] = useState(question.wordLimit || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setText(question.questionText)
    setType(question.questionType)
    setScore(question.score ? String(question.score) : '')
    setWordLimit(question.wordLimit || '')
  }, [question])

  const stale = isStale(question)
  const busy = generating || (question.answerStatus === 'generating' && !stale)
  const hasAnswer = question.answerStatus === 'ready' && !!question.answerText

  const handleSave = async () => {
    if (!text.trim() || saving) return
    setSaving(true)
    try {
      await onSave(question, {
        questionText: text.trim(),
        questionType: type,
        score: score ? Number(score) : null,
        wordLimit: wordLimit.trim() || null,
      })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div id={`question-${question.id}`} className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary-600 text-white text-xs font-semibold">
            {question.questionNumber}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {question.questionType}
          </span>
          {question.score ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
              {question.score} 分
            </span>
          ) : null}
          {question.wordLimit ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
              {question.wordLimit}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setEditing(!editing)}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            {editing ? '取消' : '编辑'}
          </button>
          <button
            type="button"
            onClick={() => onDelete(question)}
            className="text-xs text-red-500 hover:text-red-600"
          >
            删除
          </button>
        </div>
      </div>

      {editing ? (
        <div className="mt-3 space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
          <div className="flex flex-wrap gap-2">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
            >
              {SHENLUN_QUESTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              value={score}
              onChange={(e) => setScore(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="分值"
              className="w-20 text-sm border border-slate-200 rounded-lg px-3 py-2"
            />
            <input
              value={wordLimit}
              onChange={(e) => setWordLimit(e.target.value)}
              placeholder="字数要求，如 不超过250字"
              className="flex-1 min-w-[180px] text-sm border border-slate-200 rounded-lg px-3 py-2"
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="text-sm px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60"
            >
              {saving ? '保存中…' : '保存'}
            </button>
          </div>
          <p className="text-xs text-slate-400">修改题干、题型或字数要求会清空已有答案，需要重新生成。</p>
        </div>
      ) : (
        <p className="mt-3 text-sm leading-7 text-slate-800 whitespace-pre-wrap">
          {question.questionText}
        </p>
      )}

      <div className="mt-4 border-t border-slate-100 pt-4">
        {busy ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="inline-block w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            正在生成参考答案…
          </div>
        ) : hasAnswer ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-primary-700">AI 参考答案</span>
              <span className="text-xs text-slate-400">{question.answerCharCount} 字</span>
            </div>
            <IndentedText text={question.answerText || ''} className="text-sm leading-7" />
            <button
              type="button"
              onClick={() => onGenerate(question)}
              className="mt-3 text-xs text-slate-500 hover:text-primary-600"
            >
              重新生成（0.5 点）
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-slate-400">
              {stale
                ? '上次生成中断'
                : question.answerStatus === 'failed'
                  ? '生成失败，可重试'
                  : '尚未生成参考答案'}
            </span>
            <button
              type="button"
              onClick={() => onGenerate(question)}
              className="text-sm px-4 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800"
            >
              {stale || question.answerStatus === 'failed' ? '重试（0.5 点）' : '生成答案（0.5 点）'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
