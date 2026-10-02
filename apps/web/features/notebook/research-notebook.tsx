'use client'

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import {
  listResearchNotes,
  createResearchNote,
  deleteResearchNote,
} from '@/lib/api-client'
import type { NoteType, CreateResearchNoteInput, ResearchNote, NoteDraft } from '@/lib/types'

interface ResearchNotebookProps {
  sessionId: string
  initialDraft?: NoteDraft | null
  onClearDraft?: () => void
  className?: string
}

const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  insight: 'Insight',
  hypothesis: 'Hypothesis',
  decision: 'Decision',
  question: 'Question',
  action: 'Action',
}

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
  onClearDraft,
  className = '',
}: ResearchNotebookProps) {
  const queryClient = useQueryClient()
  const [content, setContent] = useState(initialDraft?.content || '')
  const [noteType, setNoteType] = useState<NoteType>(initialDraft?.note_type || 'insight')
  const [isDraftActive, setIsDraftActive] = useState<boolean>(Boolean(initialDraft))
  const [validationError, setValidationError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (initialDraft) {
      setContent(initialDraft.content || '')
      if (initialDraft.note_type) {
        setNoteType(initialDraft.note_type)
      }
      setIsDraftActive(true)
      setValidationError(null)
    }
  }, [initialDraft])

  const handleDiscardDraft = () => {
    setContent('')
    setNoteType('insight')
    setIsDraftActive(false)
    setValidationError(null)
    setActionError(null)
    onClearDraft?.()
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
      setContent('')
      setNoteType('insight')
      setIsDraftActive(false)
      setValidationError(null)
      setActionError(null)
      onClearDraft?.()
    },
    onError: (err: any) => {
      setActionError(err?.message || 'Không thể tạo ghi chú. Vui lòng thử lại.')
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

    createMutation.mutate(payload)
  }

  const handleDelete = (noteId: string) => {
    deleteMutation.mutate(noteId)
  }

  const notes = notesResponse?.data ?? []

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
        {isDraftActive && (
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
                setContent(e.target.value)
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
                onChange={(e) => setNoteType(e.target.value as NoteType)}
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

        {/* Empty state */}
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

        {/* List items */}
        {!isLoading && !isError && notes.length > 0 && (
          <div className="space-y-3">
            {notes.map((note: ResearchNote) => (
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
