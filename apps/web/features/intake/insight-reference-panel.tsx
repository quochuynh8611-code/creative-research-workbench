'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Sparkles, AlertTriangle, BookOpen, RotateCcw, Check, X } from 'lucide-react'
import { listResearchNotes } from '@/lib/api-client'
import type { ResearchNote } from '@/lib/types'

export type InsightTarget = 'want' | 'obstacle' | 'context' | 'goal'

export interface InsightReferencePanelProps {
  sessionId: string
  currentValues?: {
    want?: string
    obstacle?: string
    context?: string
    goal?: string
  }
  onApplyInsight?: (
    content: string,
    target: InsightTarget,
    note?: ResearchNote,
  ) => void
  onCancelPreview?: () => void
  className?: string
}

const NOTE_TYPE_LABELS: Record<string, string> = {
  insight: 'Insight',
  hypothesis: 'Hypothesis',
  decision: 'Decision',
  question: 'Question',
  action: 'Action',
}

const NOTE_TYPE_STYLES: Record<string, string> = {
  insight: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
  hypothesis: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  decision: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  question: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  action: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
}

const TARGET_LABELS: Record<InsightTarget, string> = {
  want: 'Điều tôi muốn đạt được / cải thiện (want)',
  obstacle: 'Nhưng lại bị vướng / lo ngại (obstacle)',
  context: 'Bối cảnh / ràng buộc thực tế (context)',
  goal: 'Mục tiêu / Mô tả bài toán (goal)',
}

export function InsightReferencePanel({
  sessionId,
  currentValues,
  onApplyInsight,
  onCancelPreview,
  className = '',
}: InsightReferencePanelProps) {
  const [selectedNote, setSelectedNote] = useState<ResearchNote | null>(null)
  const [selectedTarget, setSelectedTarget] = useState<InsightTarget>('want')

  const {
    data: notesResponse,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['sessions', sessionId, 'notes'],
    queryFn: () => listResearchNotes(sessionId),
    enabled: Boolean(sessionId),
  })

  const notes = notesResponse?.data ?? []

  const handleSelectNoteForUse = (note: ResearchNote) => {
    setSelectedNote(note)
    setSelectedTarget('want')
  }

  const handleCancel = () => {
    setSelectedNote(null)
    setSelectedTarget('want')
    onCancelPreview?.()
  }

  const handleApply = () => {
    if (!selectedNote) return
    onApplyInsight?.(selectedNote.content, selectedTarget)
    setSelectedNote(null)
    setSelectedTarget('want')
  }

  const hasExistingContent = Boolean(currentValues?.[selectedTarget]?.trim())

  return (
    <div className={`space-y-4 rounded-xl border border-border bg-card/60 p-4 backdrop-blur-sm ${className}`}>
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <BookOpen className="w-4 h-4 text-indigo-500" />
          <span>Tham khảo & Dùng insight từ Sổ tay (Research Notebook)</span>
        </div>
        <span className="text-xs text-muted-foreground font-medium">
          {notes.length} ghi chú
        </span>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="py-6 text-center space-y-2">
          <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-indigo-600 border-t-transparent" />
          <p className="text-xs text-muted-foreground">Đang tải ghi chú nghiên cứu...</p>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-3">
          <span>Không thể tải danh sách ghi chú ({error instanceof Error ? error.message : 'Lỗi mạng'})</span>
          <button
            type="button"
            onClick={() => refetch()}
            className="px-2.5 py-1 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded transition-colors cursor-pointer"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && notes.length === 0 && (
        <div className="py-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
          Chưa có ghi chú nào trong phiên này. Hãy lưu các phát hiện trong Sổ tay để tái sử dụng tại đây.
        </div>
      )}

      {/* Preview & Confirmation Modal/Card */}
      {selectedNote && (
        <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>Xem trước & Xác nhận dùng insight</span>
            </h4>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
                NOTE_TYPE_STYLES[selectedNote.note_type] || NOTE_TYPE_STYLES.insight
              }`}
            >
              {NOTE_TYPE_LABELS[selectedNote.note_type] || selectedNote.note_type}
            </span>
          </div>

          <div className="p-2.5 rounded bg-background border border-border text-xs text-foreground leading-relaxed whitespace-pre-wrap">
            {selectedNote.content}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="target-field-select"
              className="block text-xs font-medium text-foreground"
            >
              Trường đích
            </label>
            <select
              id="target-field-select"
              aria-label="Trường đích"
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(e.target.value as InsightTarget)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
            >
              <option value="want">{TARGET_LABELS.want}</option>
              <option value="obstacle">{TARGET_LABELS.obstacle}</option>
              <option value="context">{TARGET_LABELS.context}</option>
              <option value="goal">{TARGET_LABELS.goal}</option>
            </select>
          </div>

          {hasExistingContent && (
            <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>Trường đích hiện đã có nội dung và sẽ bị ghi đè khi áp dụng.</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleCancel}
              className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium text-foreground transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white transition-colors cursor-pointer shadow-xs"
            >
              Áp dụng
            </button>
          </div>
        </div>
      )}

      {/* Notes list */}
      {!isLoading && !isError && notes.length > 0 && (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {notes.map((note) => (
            <div
              key={note.id}
              className="p-3 rounded-lg border border-border bg-background hover:border-muted-foreground/30 transition-all space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
                    NOTE_TYPE_STYLES[note.note_type] || NOTE_TYPE_STYLES.insight
                  }`}
                >
                  {NOTE_TYPE_LABELS[note.note_type] || note.note_type}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(note.created_at).toLocaleString('vi-VN')}
                </span>
              </div>

              <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                {note.content}
              </p>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => handleSelectNoteForUse(note)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md bg-secondary text-secondary-foreground hover:bg-accent transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>Dùng insight này</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
