import React from 'react'
import { validateNoteSourceContext } from '@/lib/note-source-context-validator'
import { cn } from '@/lib/utils'
import type { NoteSourceContext } from '@/lib/types'

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

const CANDIDATE_STATUS_LABELS = {
  candidate: 'Đang xem xét',
  accepted: 'Đã chấp nhận',
  rejected: 'Bị từ chối',
} as const

function formatSourceTooltip(data: NoteSourceContext): string {
  switch (data.source_type) {
    case 'triz_9_windows':
      return `Lưới 9 màn hình: ${data.cell_label}`
    case 'triz_matrix':
      return `Ma trận TRIZ: Nguyên tắc #${data.principle_id} (Cải thiện: #${data.improving_param_id}, Xấu đi: #${data.worsening_param_id})`
    case 'principle_suggestion':
      return `Gợi ý nguyên tắc: Nguyên tắc #${data.principle_id} (${data.method_id})`
    case 'evidence': {
      const truncatedRef =
        data.source_ref.length > 100
          ? `${data.source_ref.slice(0, 100)}...`
          : data.source_ref
      return `Bằng chứng: ${truncatedRef}`
    }
    case 'candidate_solution': {
      const statusLabel =
        CANDIDATE_STATUS_LABELS[data.solution_status] || data.solution_status
      if (data.principle_used !== undefined && data.principle_used !== null) {
        return `Giải pháp ứng viên: ${statusLabel} (Nguyên tắc #${data.principle_used})`
      }
      return `Giải pháp ứng viên: ${statusLabel}`
    }
  }
}

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

  const tooltip = formatSourceTooltip(validation.data)

  return (
    <span
      title={tooltip}
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
