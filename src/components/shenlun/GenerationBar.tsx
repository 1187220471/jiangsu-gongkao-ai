'use client'

interface GenerationBarProps {
  total: number
  ready: number
  running: boolean
  done: number
  failed: number
  currentLabel: string
  estimatedCost: number
  remainingFree: number | null
  blockedMessage: string
  onStart: () => void
  onStop: () => void
}

export default function GenerationBar({
  total,
  ready,
  running,
  done,
  failed,
  currentLabel,
  estimatedCost,
  remainingFree,
  blockedMessage,
  onStart,
  onStop,
}: GenerationBarProps) {
  const pending = Math.max(0, total - ready)
  const processed = done + failed
  const percent = total > 0 ? Math.round((ready / total) * 100) : 0

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-800">
            已生成 {ready}/{total} 题
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {pending > 0
              ? `剩余 ${pending} 题，预计消耗 ${estimatedCost} 点${
                  remainingFree !== null ? `，今日剩余 ${remainingFree} 点` : ''
                }`
              : '全部题目已生成参考答案'}
          </div>
        </div>

        {running ? (
          <button
            type="button"
            onClick={onStop}
            className="text-sm px-4 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
          >
            停止
          </button>
        ) : (
          <button
            type="button"
            onClick={onStart}
            disabled={pending === 0}
            className="text-sm px-5 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            生成全部答案
          </button>
        )}
      </div>

      <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full bg-primary-500 transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      {running && (
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
          <span className="inline-block w-3.5 h-3.5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          {currentLabel || '正在生成…'}
          <span className="text-slate-400">
            （已处理 {processed}/{total}）
          </span>
        </div>
      )}

      {failed > 0 && !running && (
        <p className="mt-2 text-xs text-amber-600">
          有 {failed} 题生成失败，已退回额度，可单独重试
        </p>
      )}

      {blockedMessage && !running && (
        <p className="mt-2 text-xs text-red-600">{blockedMessage}</p>
      )}
    </div>
  )
}
