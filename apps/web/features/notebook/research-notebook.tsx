'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Sparkles, Search, X, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  listResearchNotes,
  createResearchNote,
  deleteResearchNote,
} from '@/lib/api-client'
import { validateTriz9WindowsContext } from '@/lib/triz-9-windows-context-validator'
import { extractApiErrorMessage } from '@/lib/api-error-message'
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

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current)
        copyTimerRef.current = null
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
      const validation = validateTriz9WindowsContext(initialDraft.source_context)
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
  const [searchQuery, setSearchQuery] = useState('')

  const notes = notesResponse?.data ?? []

  const counters: Record<FilterType, number> = {
    all: notes.length,
    insight: notes.filter((n) => n.note_type === 'insight').length,
    hypothesis: notes.filter((n) => n.note_type === 'hypothesis').length,
    decision: notes.filter((n) => n.note_type === 'decision').length,
    question: notes.filter((n) => n.note_type === 'question').length,
    action: notes.filter((n) => n.note_type === 'action').length,
  }

  const filteredNotes = notes.filter((note) => {
    const matchesType = selectedType === 'all' || note.note_type === selectedType
    const matchesSearch =
      !searchQuery.trim() ||
      note.content.toLowerCase().includes(searchQuery.trim().toLowerCase())
    return matchesType && matchesSearch
  })

  const handleClearFilters = () => {
    setSelectedType('all')
    setSearchQuery('')
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
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                      NOTE_TYPE_STYLES[note.note_type] || NOTE_TYPE_STYLES.insight
                    }`}
                  >
                    {NOTE_TYPE_LABELS[note.note_type] || note.note_type}
                  </span>

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
