'use client'

import { useMemo, useState } from 'react'
import IndentedText from '@/components/IndentedText'

interface PaperMaterialPanelProps {
  text: string
}

const MATERIAL_HEAD = /(?=【?\s*(?:给定)?(?:资料|材料)\s*[0-9一二三四五六七八九十]{1,3})/g

function splitSections(text: string): string[] {
  const trimmed = (text || '').trim()
  if (!trimmed) return []
  const parts = trimmed
    .split(MATERIAL_HEAD)
    .map((s) => s.trim())
    .filter(Boolean)
  return parts.length ? parts : [trimmed]
}

function sectionTitle(section: string): string {
  const firstLine = section.split('\n')[0]?.trim() || ''
  return firstLine.length <= 30 ? firstLine : `${firstLine.slice(0, 30)}…`
}

export default function PaperMaterialPanel({ text }: PaperMaterialPanelProps) {
  const sections = useMemo(() => splitSections(text), [text])
  const [allOpen, setAllOpen] = useState(true)

  if (sections.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 text-sm text-slate-500">
        未识别到材料原文。可返回上传页校对后重新保存。
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-800">给定材料</h2>
        <button
          type="button"
          onClick={() => setAllOpen(!allOpen)}
          className="text-xs text-primary-600 hover:text-primary-700"
        >
          {allOpen ? '全部收起' : '全部展开'}
        </button>
      </div>

      <div className="space-y-2">
        {sections.map((section, idx) => (
          <details
            key={idx}
            open={allOpen}
            className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2"
          >
            <summary className="cursor-pointer text-xs font-medium text-slate-600 select-none">
              {sectionTitle(section) || `材料 ${idx + 1}`}
            </summary>
            <IndentedText
              text={section}
              compact
              className="mt-2 text-sm leading-6"
            />
          </details>
        ))}
      </div>
    </div>
  )
}
