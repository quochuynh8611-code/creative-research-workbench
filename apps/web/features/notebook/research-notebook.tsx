'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Sparkles, Search, X, Copy, Check, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  listResearchNotes,
  createResearchNote,
  deleteResearchNote,
} from '@/lib/api-client'
import { validateNoteSourceContext } from '@/lib/note-source-context-validator'
import { extractApiErrorMessage } from '@/lib/api-error-message'
import { NoteSourceBadge } from './components/note-source-badge'
import type { NoteType, CreateResearchNoteInput, ResearchNote, NoteDraft } from '@/lib/types'

interface ResearchNotebookProps {
  sessionId: string
  initialDraft: NoteDraft | null
  content: string
  noteType: NoteType
  onContentChange: (content: string) => void
  onNoteTypeChange: (noteType: NoteType) => void
  onClearDraft: () => void
  onNoteCreated: () => void
  className?: string
}

const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  insight: 'Insight',
  hypothesis: 'Hypothesis',
  decision: 'Decision',
  question: 'Question',
  action: 'Action',
}

type FilterType = NoteType | 'all'

export type SourceFilter =
  | 'all'
  | 'triz_9_windows'
  | 'triz_matrix'
  | 'principle_suggestion'
  | 'evidence'
  | 'candidate_solution'
  | 'manual'

const SOURCE_FILTER_OPTIONS: { key: SourceFilter; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'triz_9_windows', label: 'Lưới 9 màn hình' },
  { key: 'triz_matrix', label: 'Ma trận TRIZ' },
  { key: 'principle_suggestion', label: 'Gợi ý nguyên tắc' },
  { key: 'evidence', label: 'Bằng chứng' },
  { key: 'candidate_solution', label: 'Giải pháp ứng viên' },
  { key: 'manual', label: 'Thủ công' },
]

function getNoteSourceType(note: ResearchNote): SourceFilter {
  if (!note.source_context || typeof note.source_context !== 'object') {
    return 'manual'
  }
  const validation = validateNoteSourceContext(note.source_context)
  if (!validation.ok) {
    return 'manual'
  }
  return validation.data.source_type
}

type CopyStatus = {
  noteId: string
  status: 'success' | 'error'
  message?: string
} | null

const FILTER_OPTIONS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'insight', label: 'Insight' },
  { key: 'hypothesis', label: 'Hypothesis' },
  { key: 'decision', label: 'Decision' },
  { key: 'question', label: 'Question' },
  { key: 'action', label: 'Action' },
]

const NOTE_TYPE_STYLES: Record<NoteType, string> = {
  insight: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
  hypothesis: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  decision: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  question: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  action: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
}

export function ResearchNotebook({
  sessionId,
  initialDraft,
  content,
  noteType,
  onContentChange,
  onNoteTypeChange,
  onClearDraft,
  onNoteCreated,
  className = '',
}: ResearchNotebookProps) {
  const queryClient = useQueryClient()
  const [validationError, setValidationError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [copyStatus, setCopyStatus] = useState<CopyStatus>(null)
  const latestRequestIdRef = useRef<number>(0)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMountedRef = useRef<boolean>(true)

  const [summaryCopyStatus, setSummaryCopyStatus] = useState<
    { status: 'success' | 'error'; message?: string } | null
  >(null)
  const latestSummaryRequestIdRef = useRef<number>(0)
  const summaryCopyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [summaryExportStatus, setSummaryExportStatus] = useState<
    { status: 'success' | 'error'; message?: string } | null
  >(null)
  const summaryExportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current)
        copyTimerRef.current = null
      }
      if (summaryCopyTimerRef.current) {
        clearTimeout(summaryCopyTimerRef.current)
        summaryCopyTimerRef.current = null
      }
      if (summaryExportTimerRef.current) {
        clearTimeout(summaryExportTimerRef.current)
        summaryExportTimerRef.current = null
      }
    }
  }, [])

  const handleCopyNote = async (note: ResearchNote) => {
    latestRequestIdRef.current += 1
    const currentRequestId = latestRequestIdRef.current

    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current)
      copyTimerRef.current = null
    }
    setCopyStatus(null)

    if (
      typeof navigator === 'undefined' ||
      !navigator.clipboard ||
      typeof navigator.clipboard.writeText !== 'function'
    ) {
      if (isMountedRef.current && currentRequestId === latestRequestIdRef.current) {
        setCopyStatus({
          noteId: note.id,
          status: 'error',
          message: 'Trình duyệt không hỗ trợ sao chép',
        })
      }
      return
    }

    try {
      await navigator.clipboard.writeText(note.content)

      if (isMountedRef.current && currentRequestId === latestRequestIdRef.current) {
        setCopyStatus({
          noteId: note.id,
          status: 'success',
        })

        copyTimerRef.current = setTimeout(() => {
          if (isMountedRef.current && currentRequestId === latestRequestIdRef.current) {
            setCopyStatus(null)
            copyTimerRef.current = null
          }
        }, 2000)
      }
    } catch {
      if (isMountedRef.current && currentRequestId === latestRequestIdRef.current) {
        setCopyStatus({
          noteId: note.id,
          status: 'error',
          message: 'Không thể sao chép vào bộ nhớ tạm',
        })
      }
    }
  }

  const handleDiscardDraft = () => {
    setValidationError(null)
    setActionError(null)
    onClearDraft()
  }

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

  const createMutation = useMutation({
    mutationFn: (input: CreateResearchNoteInput) => createResearchNote(sessionId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', sessionId, 'notes'] })
      setValidationError(null)
      setActionError(null)
      onNoteCreated()
    },
    onError: (err: unknown) => {
      setActionError(extractApiErrorMessage(err, 'Không thể tạo ghi chú. Vui lòng thử lại.'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (noteId: string) => deleteResearchNote(sessionId, noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', sessionId, 'notes'] })
      setActionError(null)
    },
    onError: (err: any) => {
      setActionError(err?.message || 'Không thể xóa ghi chú. Vui lòng thử lại.')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = content.trim()
    if (!trimmed) {
      setValidationError('Vui lòng nhập nội dung ghi chú')
      return
    }

    setValidationError(null)
    setActionError(null)

    const payload: CreateResearchNoteInput = {
      content: trimmed,
      note_type: noteType,
    }
    if (initialDraft?.source_chunk_id) {
      payload.source_chunk_id = initialDraft.source_chunk_id
    }
    if (initialDraft?.source_context !== undefined && initialDraft?.source_context !== null) {
      const validation = validateNoteSourceContext(initialDraft.source_context)
      if (!validation.ok) {
        setActionError(`Context không hợp lệ: ${validation.error}`)
        return
      }
      payload.source_context = validation.data
    }

    createMutation.mutate(payload)
  }

  const handleDelete = (noteId: string) => {
    deleteMutation.mutate(noteId)
  }

  const [selectedType, setSelectedType] = useState<FilterType>('all')
  const [selectedSource, setSelectedSource] = useState<SourceFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const notes = notesResponse?.data ?? []

  const counters: Record<FilterType, number> = {
    all: notes.length,
    insight: notes.filter((n) => n?.note_type === 'insight').length,
    hypothesis: notes.filter((n) => n?.note_type === 'hypothesis').length,
    decision: notes.filter((n) => n?.note_type === 'decision').length,
    question: notes.filter((n) => n?.note_type === 'question').length,
    action: notes.filter((n) => n?.note_type === 'action').length,
  }

  let summaryCalculationError: string | null = null
  const sourceCounters: Record<SourceFilter, number> = {
    all: notes.length,
    triz_9_windows: 0,
    triz_matrix: 0,
    principle_suggestion: 0,
    evidence: 0,
    candidate_solution: 0,
    manual: 0,
  }

  try {
    notes.forEach((note) => {
      if (note && typeof note === 'object') {
        const st = getNoteSourceType(note)
        sourceCounters[st] = (sourceCounters[st] || 0) + 1
      }
    })
  } catch {
    summaryCalculationError = 'Không thể tổng hợp dữ liệu nguồn gốc'
  }

  const hasValidatedContexts =
    sourceCounters.triz_9_windows > 0 ||
    sourceCounters.triz_matrix > 0 ||
    sourceCounters.principle_suggestion > 0 ||
    sourceCounters.evidence > 0 ||
    sourceCounters.candidate_solution > 0

  const filteredNotes = notes.filter((note) => {
    let noteSource: SourceFilter = 'manual'
    try {
      noteSource = getNoteSourceType(note)
    } catch {
      noteSource = 'manual'
    }
    const matchesSource =
      selectedSource === 'all' || noteSource === selectedSource
    const matchesType = selectedType === 'all' || note.note_type === selectedType
    const matchesSearch =
      !searchQuery.trim() ||
      note.content.toLowerCase().includes(searchQuery.trim().toLowerCase())
    return matchesSource && matchesType && matchesSearch
  })

  const handleClearFilters = () => {
    setSelectedType('all')
    setSelectedSource('all')
    setSearchQuery('')
  }

  const handleCopySummary = async () => {
    latestSummaryRequestIdRef.current += 1
    const currentRequestId = latestSummaryRequestIdRef.current

    if (summaryCopyTimerRef.current) {
      clearTimeout(summaryCopyTimerRef.current)
      summaryCopyTimerRef.current = null
    }
    setSummaryCopyStatus(null)

    if (summaryCalculationError) {
      if (isMountedRef.current && currentRequestId === latestSummaryRequestIdRef.current) {
        setSummaryCopyStatus({
          status: 'error',
          message: 'Không thể tổng hợp dữ liệu nguồn gốc',
        })
      }
      return
    }

    if (
      typeof navigator === 'undefined' ||
      !navigator.clipboard ||
      typeof navigator.clipboard.writeText !== 'function'
    ) {
      if (isMountedRef.current && currentRequestId === latestSummaryRequestIdRef.current) {
        setSummaryCopyStatus({
          status: 'error',
          message: 'Trình duyệt không hỗ trợ sao chép',
        })
      }
      return
    }

    const summaryText = [
      'Tổng hợp nguồn ghi chú:',
      `- Tổng số ghi chú: ${sourceCounters.all}`,
      `- Lưới 9 màn hình: ${sourceCounters.triz_9_windows}`,
      `- Ma trận TRIZ: ${sourceCounters.triz_matrix}`,
      `- Gợi ý nguyên tắc: ${sourceCounters.principle_suggestion}`,
      `- Bằng chứng: ${sourceCounters.evidence}`,
      `- Giải pháp ứng viên: ${sourceCounters.candidate_solution}`,
      `- Thủ công: ${sourceCounters.manual}`,
    ].join('\n')

    try {
      await navigator.clipboard.writeText(summaryText)

      if (isMountedRef.current && currentRequestId === latestSummaryRequestIdRef.current) {
        setSummaryCopyStatus({
          status: 'success',
        })

        summaryCopyTimerRef.current = setTimeout(() => {
          if (isMountedRef.current && currentRequestId === latestSummaryRequestIdRef.current) {
            setSummaryCopyStatus(null)
            summaryCopyTimerRef.current = null
          }
        }, 2000)
      }
    } catch {
      if (isMountedRef.current && currentRequestId === latestSummaryRequestIdRef.current) {
        setSummaryCopyStatus({
          status: 'error',
          message: 'Không thể sao chép vào bộ nhớ tạm',
        })
      }
    }
  }

  const triggerFileDownload = (content: string, filename: string, mimeType: string) => {
    if (
      typeof window === 'undefined' ||
      typeof Blob === 'undefined' ||
      typeof window.URL === 'undefined' ||
      typeof window.URL.createObjectURL !== 'function'
    ) {
      throw new Error('Môi trường không hỗ trợ tải tệp')
    }
    const blob = new Blob([content], { type: mimeType })
    const url = window.URL.createObjectURL(blob)
    try {
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } finally {
      window.URL.revokeObjectURL(url)
    }
  }

  const formatExportTimestamp = (date: Date = new Date()): string => {
    const pad = (n: number) => String(n).padStart(2, '0')
    const YYYY = date.getUTCFullYear()
    const MM = pad(date.getUTCMonth() + 1)
    const DD = pad(date.getUTCDate())
    const HH = pad(date.getUTCHours())
    const mm = pad(date.getUTCMinutes())
    const ss = pad(date.getUTCSeconds())
    return `${YYYY}${MM}${DD}-${HH}${mm}${ss}`
  }

  const handleKeyActivation = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      action()
    }
  }

  const handleExportCSV = () => {
    if (summaryExportTimerRef.current) {
      clearTimeout(summaryExportTimerRef.current)
      summaryExportTimerRef.current = null
    }
    setSummaryExportStatus(null)

    if (summaryCalculationError || !sourceCounters || sourceCounters.all === 0) {
      if (isMountedRef.current) {
        setSummaryExportStatus({
          status: 'error',
          message: summaryCalculationError
            ? 'Không thể tổng hợp dữ liệu nguồn gốc để xuất'
            : 'Không có dữ liệu nguồn gốc để xuất',
        })
      }
      return
    }

    try {
      const now = new Date()
      const timestampStr = formatExportTimestamp(now)
      const isoTime = now.toISOString()
      const filename = `source-provenance-summary-${timestampStr}.csv`

      const metadataRows = [
        `# generatedAt: ${isoTime}`,
        `# activeSourceFilter: ${selectedSource}`,
        `# totalNotes: ${sourceCounters.all}`,
      ].join('\n')

      const dataRows = [
        ['key', 'label', 'count'],
        ...SOURCE_FILTER_OPTIONS.map((opt) => [
          opt.key,
          opt.label,
          String(sourceCounters[opt.key] ?? 0),
        ]),
      ]
        .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
        .join('\n')

      const csvContent = `${metadataRows}\n${dataRows}`

      triggerFileDownload(csvContent, filename, 'text/csv;charset=utf-8;')

      if (isMountedRef.current) {
        setSummaryExportStatus({
          status: 'success',
          message: 'Đã xuất CSV thành công',
        })
        summaryExportTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            setSummaryExportStatus(null)
            summaryExportTimerRef.current = null
          }
        }, 2000)
      }
    } catch (err) {
      if (isMountedRef.current) {
        setSummaryExportStatus({
          status: 'error',
          message: err instanceof Error ? `Không thể xuất file CSV: ${err.message}` : 'Không thể xuất file CSV',
        })
      }
    }
  }

  const handleExportJSON = () => {
    if (summaryExportTimerRef.current) {
      clearTimeout(summaryExportTimerRef.current)
      summaryExportTimerRef.current = null
    }
    setSummaryExportStatus(null)

    if (summaryCalculationError || !sourceCounters || sourceCounters.all === 0) {
      if (isMountedRef.current) {
        setSummaryExportStatus({
          status: 'error',
          message: summaryCalculationError
            ? 'Không thể tổng hợp dữ liệu nguồn gốc để xuất'
            : 'Không có dữ liệu nguồn gốc để xuất',
        })
      }
      return
    }

    try {
      const now = new Date()
      const timestampStr = formatExportTimestamp(now)
      const isoTime = now.toISOString()
      const filename = `source-provenance-summary-${timestampStr}.json`

      const exportData = {
        generatedAt: isoTime,
        activeSourceFilter: selectedSource,
        totalNotes: sourceCounters.all,
        sources: SOURCE_FILTER_OPTIONS.map((opt) => ({
          key: opt.key,
          label: opt.label,
          count: sourceCounters[opt.key] ?? 0,
        })),
      }
      const jsonContent = JSON.stringify(exportData, null, 2)

      triggerFileDownload(jsonContent, filename, 'application/json')

      if (isMountedRef.current) {
        setSummaryExportStatus({
          status: 'success',
          message: 'Đã xuất JSON thành công',
        })
        summaryExportTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            setSummaryExportStatus(null)
            summaryExportTimerRef.current = null
          }
        }, 2000)
      }
    } catch (err) {
      if (isMountedRef.current) {
        setSummaryExportStatus({
          status: 'error',
          message: err instanceof Error ? `Không thể xuất file JSON: ${err.message}` : 'Không thể xuất file JSON',
        })
      }
    }
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Creation Form Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <svg
            className="w-5 h-5 text-indigo-600 dark:text-indigo-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
          Thêm ghi chú nghiên cứu
        </h3>

        {/* Draft Active Indicator Banner */}
        {initialDraft && (
          <div className="p-3 mb-4 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-medium">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Đang soạn thảo từ bản nháp gợi ý / trích dẫn</span>
            </div>
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-500/20 rounded-lg transition-colors border border-amber-500/30 cursor-pointer"
            >
              Hủy nháp
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="note-content" className="sr-only">
              Nội dung ghi chú
            </label>
            <textarea
              id="note-content"
              rows={3}
              value={content}
              onChange={(e) => {
                onContentChange(e.target.value)
                if (validationError) setValidationError(null)
              }}
              placeholder="Nhập ghi chú nghiên cứu (quan sát, giả thuyết, quyết định)..."
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-y"
            />
            {validationError && (
              <p className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                {validationError}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <label
                htmlFor="note-type"
                className="text-xs font-medium text-slate-600 dark:text-slate-400"
              >
                Phân loại:
              </label>
              <select
                id="note-type"
                aria-label="Loại ghi chú"
                value={noteType}
                onChange={(e) => onNoteTypeChange(e.target.value as NoteType)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium cursor-pointer"
              >
                <option value="insight">Insight (Phát hiện)</option>
                <option value="hypothesis">Hypothesis (Giả thuyết)</option>
                <option value="decision">Decision (Quyết định)</option>
                <option value="question">Question (Câu hỏi)</option>
                <option value="action">Action (Hành động)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={createMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {createMutation.isPending ? (
                <>
                  <svg
                    className="animate-spin h-3.5 w-3.5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Đang lưu...
                </>
              ) : (
                'Lưu ghi chú'
              )}
            </button>
          </div>
        </form>

        {actionError && (
          <div className="mt-3 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-700 dark:text-rose-300">
            {actionError}
          </div>
        )}
      </div>

      {/* Notes List Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <span>Sổ tay ghi chú</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
              {notes.length}
            </span>
          </h4>
        </div>

        {/* Source Provenance Summary Panel (chỉ render khi notes.length > 0) */}
        {!isLoading && !isError && notes.length > 0 && (
          <div
            role="region"
            aria-label="Tổng quan nguồn gốc ghi chú"
            className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2.5"
          >
            {summaryCalculationError ? (
              <div
                role="alert"
                className="text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 p-3 rounded-lg border border-rose-200 dark:border-rose-800"
              >
                {summaryCalculationError}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Tổng quan nguồn gốc
                  </span>

                  <div className="flex flex-wrap items-center gap-2">
                    {summaryCopyStatus?.status === 'success' && (
                      <span
                        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40"
                        role="status"
                        aria-live="polite"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Đã chép tổng hợp</span>
                      </span>
                    )}

                    {summaryCopyStatus?.status === 'error' && (
                      <span
                        className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40"
                        role="alert"
                      >
                        <span>{summaryCopyStatus.message}</span>
                      </span>
                    )}

                    {summaryExportStatus?.status === 'success' && (
                      <span
                        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40"
                        role="status"
                        aria-live="polite"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{summaryExportStatus.message}</span>
                      </span>
                    )}

                    {summaryExportStatus?.status === 'error' && (
                      <span
                        className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40"
                        role="alert"
                        aria-live="polite"
                      >
                        <span>{summaryExportStatus.message}</span>
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={handleCopySummary}
                      onKeyDown={(e) => handleKeyActivation(e, handleCopySummary)}
                      aria-label="Sao chép tổng hợp"
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 transition-colors cursor-pointer shadow-2xs"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Sao chép tổng hợp</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleExportCSV}
                      onKeyDown={(e) => handleKeyActivation(e, handleExportCSV)}
                      aria-label="Xuất CSV"
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 transition-colors cursor-pointer shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Xuất CSV</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleExportJSON}
                      onKeyDown={(e) => handleKeyActivation(e, handleExportJSON)}
                      aria-label="Xuất JSON"
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 transition-colors cursor-pointer shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Xuất JSON</span>
                    </button>
                  </div>
                </div>

                {!hasValidatedContexts && (
                  <div
                    role="status"
                    className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800 flex items-center gap-1.5"
                  >
                    <span>Chưa có ghi chú nào từ nguồn được xác thực</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                  <button
                    type="button"
                    onClick={() => setSelectedSource('all')}
                    onKeyDown={(e) => handleKeyActivation(e, () => setSelectedSource('all'))}
                    aria-label={`Tất cả: ${sourceCounters.all}`}
                    aria-pressed={selectedSource === 'all'}
                    className={`px-2 py-0.5 rounded font-medium transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                      selectedSource === 'all'
                        ? 'bg-indigo-600 text-white border border-indigo-600 shadow-2xs ring-1 ring-indigo-500'
                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {`Tổng số: ${sourceCounters.all}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSource('triz_9_windows')}
                    onKeyDown={(e) => handleKeyActivation(e, () => setSelectedSource('triz_9_windows'))}
                    aria-label={`Lưới 9 màn hình: ${sourceCounters.triz_9_windows}`}
                    aria-pressed={selectedSource === 'triz_9_windows'}
                    className={`px-2 py-0.5 rounded font-medium transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                      selectedSource === 'triz_9_windows'
                        ? 'bg-sky-600 text-white border border-sky-600 shadow-2xs ring-1 ring-sky-500'
                        : 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 hover:bg-sky-100 dark:hover:bg-sky-900/60'
                    }`}
                  >
                    {`Lưới 9 màn hình: ${sourceCounters.triz_9_windows}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSource('triz_matrix')}
                    onKeyDown={(e) => handleKeyActivation(e, () => setSelectedSource('triz_matrix'))}
                    aria-label={`Ma trận TRIZ: ${sourceCounters.triz_matrix}`}
                    aria-pressed={selectedSource === 'triz_matrix'}
                    className={`px-2 py-0.5 rounded font-medium transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                      selectedSource === 'triz_matrix'
                        ? 'bg-teal-600 text-white border border-teal-600 shadow-2xs ring-1 ring-teal-500'
                        : 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 hover:bg-teal-100 dark:hover:bg-teal-900/60'
                    }`}
                  >
                    {`Ma trận TRIZ: ${sourceCounters.triz_matrix}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSource('principle_suggestion')}
                    onKeyDown={(e) => handleKeyActivation(e, () => setSelectedSource('principle_suggestion'))}
                    aria-label={`Gợi ý nguyên tắc: ${sourceCounters.principle_suggestion}`}
                    aria-pressed={selectedSource === 'principle_suggestion'}
                    className={`px-2 py-0.5 rounded font-medium transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                      selectedSource === 'principle_suggestion'
                        ? 'bg-amber-600 text-white border border-amber-600 shadow-2xs ring-1 ring-amber-500'
                        : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/60'
                    }`}
                  >
                    {`Gợi ý nguyên tắc: ${sourceCounters.principle_suggestion}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSource('evidence')}
                    onKeyDown={(e) => handleKeyActivation(e, () => setSelectedSource('evidence'))}
                    aria-label={`Bằng chứng: ${sourceCounters.evidence}`}
                    aria-pressed={selectedSource === 'evidence'}
                    className={`px-2 py-0.5 rounded font-medium transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 ${
                      selectedSource === 'evidence'
                        ? 'bg-slate-700 text-white border border-slate-700 shadow-2xs ring-1 ring-slate-600'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {`Bằng chứng: ${sourceCounters.evidence}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSource('candidate_solution')}
                    onKeyDown={(e) => handleKeyActivation(e, () => setSelectedSource('candidate_solution'))}
                    aria-label={`Giải pháp ứng viên: ${sourceCounters.candidate_solution}`}
                    aria-pressed={selectedSource === 'candidate_solution'}
                    className={`px-2 py-0.5 rounded font-medium transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                      selectedSource === 'candidate_solution'
                        ? 'bg-indigo-600 text-white border border-indigo-600 shadow-2xs ring-1 ring-indigo-500'
                        : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60'
                    }`}
                  >
                    {`Giải pháp ứng viên: ${sourceCounters.candidate_solution}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSource('manual')}
                    onKeyDown={(e) => handleKeyActivation(e, () => setSelectedSource('manual'))}
                    aria-label={`Thủ công: ${sourceCounters.manual}`}
                    aria-pressed={selectedSource === 'manual'}
                    className={`px-2 py-0.5 rounded font-medium transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 ${
                      selectedSource === 'manual'
                        ? 'bg-slate-600 text-white border border-slate-600 shadow-2xs ring-1 ring-slate-500'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {`Thủ công: ${sourceCounters.manual}`}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent"></div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Đang tải ghi chú...</p>
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div className="p-5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-center space-y-2">
            <p className="text-xs font-medium text-rose-700 dark:text-rose-300">
              Không thể tải danh sách ghi chú ({error instanceof Error ? error.message : 'Lỗi mạng'})
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors cursor-pointer"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Empty state khi phiên chưa có ghi chú nào */}
        {!isLoading && !isError && notes.length === 0 && (
          <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
            <svg
              className="mx-auto h-8 w-8 text-slate-400 dark:text-slate-600 mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Chưa có ghi chú nào trong phiên này
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Ghi lại những phát hiện, giả thuyết hoặc quyết định sáng tạo của bạn ở form phía trên.
            </p>
          </div>
        )}

        {/* Filter Bar & Search controls (chỉ hiển thị khi session có ghi chú) */}
        {!isLoading && !isError && notes.length > 0 && (
          <div className="space-y-3 pt-1">
            {/* Search Input */}
            <div className="relative">
              <label htmlFor="search-notes" className="sr-only">
                Tìm kiếm ghi chú
              </label>
              <input
                id="search-notes"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm ghi chú theo nội dung..."
                aria-label="Tìm kiếm ghi chú"
                className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Xóa từ khóa tìm kiếm"
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Buttons */}
            <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Bộ lọc danh sách">
              {FILTER_OPTIONS.map((opt) => {
                const isActive = selectedType === opt.key
                const count = counters[opt.key]
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setSelectedType(opt.key)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors cursor-pointer',
                      isActive
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs font-semibold'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    )}
                  >
                    <span>{`${opt.label} (${count})`}</span>
                  </button>
                )
              })}
            </div>

            {/* Source Filter Buttons */}
            <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Bộ lọc nguồn">
              {SOURCE_FILTER_OPTIONS.map((opt) => {
                const isActive = selectedSource === opt.key
                const count = sourceCounters[opt.key]
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setSelectedSource(opt.key)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors cursor-pointer',
                      isActive
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs font-semibold'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    )}
                  >
                    <span>{`${opt.label} (${count})`}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Empty filter state (khi session có notes nhưng không note nào khớp filter/search) */}
        {!isLoading && !isError && notes.length > 0 && filteredNotes.length === 0 && (
          <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Không tìm thấy ghi chú phù hợp với bộ lọc
            </p>
            <button
              type="button"
              onClick={handleClearFilters}
              className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/50 dark:text-indigo-300 rounded-lg transition-colors border border-indigo-200 dark:border-indigo-800 cursor-pointer shadow-2xs"
            >
              Xóa bộ lọc
            </button>
          </div>
        )}

        {/* List items */}
        {!isLoading && !isError && filteredNotes.length > 0 && (
          <div className="space-y-3">
            {filteredNotes.map((note: ResearchNote) => (
              <div
                key={note.id}
                className="group bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                        NOTE_TYPE_STYLES[note.note_type] || NOTE_TYPE_STYLES.insight
                      }`}
                    >
                      {NOTE_TYPE_LABELS[note.note_type] || note.note_type}
                    </span>
                    <NoteSourceBadge sourceContext={note.source_context} />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                      {new Date(note.created_at).toLocaleString('vi-VN')}
                    </span>

                    {copyStatus?.noteId === note.id && copyStatus.status === 'success' && (
                      <span
                        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40"
                        role="status"
                        aria-live="polite"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Đã chép</span>
                      </span>
                    )}

                    {copyStatus?.noteId === note.id && copyStatus.status === 'error' && (
                      <span
                        className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40"
                        role="alert"
                      >
                        <span>{copyStatus.message}</span>
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => handleCopyNote(note)}
                      aria-label={`Sao chép ghi chú ${note.id}`}
                      title="Sao chép nội dung"
                      className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Copy className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(note.id)}
                      disabled={deleteMutation.isPending}
                      aria-label="Xóa ghi chú"
                      title="Xóa ghi chú"
                      className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {note.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
