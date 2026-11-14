import React from 'react'
import { validateNoteSourceContext } from '@/lib/note-source-context-validator'
import { cn } from '@/lib/utils'

export interface NoteSourceBadgeProps {
  sourceContext?: unknown | null
  className?: string
}

const SOURCE_LABELS = {
  triz_9_windows: 'Lưới 9 màn hình',
  triz_matrix: 'Ma trận TRIZ',
  principle_suggestion: 'Gợi ý nguyên tắc',
  evidence: 'Bằng chứng',
  candidate_solution: 'Giải pháp ứng viên',
} as const

const SOURCE_STYLES = {
  triz_9_windows:
    'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
  triz_matrix:
    'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800',
  principle_suggestion:
    'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  evidence:
    'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  candidate_solution:
    'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
} as const

export function NoteSourceBadge({ sourceContext, className }: NoteSourceBadgeProps) {
  if (!sourceContext || typeof sourceContext !== 'object') {
    return null
  }

  const validation = validateNoteSourceContext(sourceContext)
  if (!validation.ok) {
    return null
  }

  const sourceType = validation.data.source_type
  const label = SOURCE_LABELS[sourceType]
  const style = SOURCE_STYLES[sourceType]

  if (!label) {
    return null
  }

  return (
    <span
      title={label}
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border truncate max-w-[10rem] shrink-0',
        style,
        className
      )}
    >
      <span className="truncate">{label}</span>
    </span>
  )
}
