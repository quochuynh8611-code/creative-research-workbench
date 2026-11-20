'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Lightbulb,
  Bookmark,
  X,
  AlertTriangle,
  Loader2,
  Tag,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CoachSuggestion, NoteType } from '@/lib/types'

export interface EditableDraftModalProps {
  isOpen: boolean
  type: 'solution' | 'note'
  suggestion: CoachSuggestion | null
  isLoading?: boolean
  errorMessage?: string | null
  onSaveSolution: (payload: { title: string; mechanism: string }) => void
  onSaveNote: (payload: { content: string; note_type: NoteType; tags?: string[] }) => void
  onCancel: () => void
}

export function EditableDraftModal({
  isOpen,
  type,
  suggestion,
  isLoading = false,
  errorMessage = null,
  onSaveSolution,
  onSaveNote,
  onCancel,
}: EditableDraftModalProps) {
  // Solution Form State
  const [title, setTitle] = useState('')
  const [mechanism, setMechanism] = useState('')

  // Note Form State
  const [content, setContent] = useState('')
  const [noteType, setNoteType] = useState<NoteType>('insight')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')

  // Initial State Tracking for Dirty Detection & Overwrite Guard
  const [initialTitle, setInitialTitle] = useState('')
  const [initialMechanism, setInitialMechanism] = useState('')
  const [initialContent, setInitialContent] = useState('')
  const [initialNoteType, setInitialNoteType] = useState<NoteType>('insight')

  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const lastLoadedSuggestionId = useRef<string | null>(null)
  const prevIsOpen = useRef(false)

  // Khởi tạo hoặc nạp dữ liệu khi modal mở hoặc suggestion thay đổi
  useEffect(() => {
    if (!isOpen) {
      prevIsOpen.current = false
      setShowDiscardConfirm(false)
      return
    }

    // Chỉ nạp lại khi vừa mới mở modal hoặc đổi suggestion khác
    const isNewOpen = !prevIsOpen.current
    const isDifferentSuggestion = suggestion?.id !== lastLoadedSuggestionId.current

    if (isNewOpen || isDifferentSuggestion) {
      lastLoadedSuggestionId.current = suggestion?.id ?? null
      setShowDiscardConfirm(false)

      if (type === 'solution' && suggestion) {
        const payload = suggestion.actionable_payload
        const initT = payload?.title?.trim() || suggestion.title
        const initM = payload?.mechanism?.trim() || suggestion.description
        setTitle(initT)
        setMechanism(initM)
        setInitialTitle(initT)
        setInitialMechanism(initM)
      } else if (type === 'note' && suggestion) {
        const payload = suggestion.actionable_payload
        const initC =
          payload?.content?.trim() ||
          `[${suggestion.title}]\n${suggestion.description}\n(Căn cứ: ${suggestion.source_grounding.source_reference})`
        const initNT: NoteType =
          (payload?.note_type as NoteType) ||
          (suggestion.category === 'clarifying_question'
            ? 'question'
            : suggestion.category === 'possible_cause'
            ? 'insight'
            : 'hypothesis')
        setContent(initC)
        setNoteType(initNT)
        setTags([])
        setTagInput('')
        setInitialContent(initC)
        setInitialNoteType(initNT)
      }
    }

    prevIsOpen.current = true
  }, [isOpen, suggestion, type])

  // Dirty check: người dùng đã chỉnh sửa form so với bản AI sinh ra
  const isDirty =
    type === 'solution'
      ? title !== initialTitle || mechanism !== initialMechanism
      : content !== initialContent || noteType !== initialNoteType || tags.length > 0

  // Xử lý phím Escape và click outside có Overwrite Guard
  const handleAttemptClose = useCallback(() => {
    if (isLoading) return
    if (isDirty) {
      setShowDiscardConfirm(true)
    } else {
      onCancel()
    }
  }, [isLoading, isDirty, onCancel])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleAttemptClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleAttemptClose])

  if (!isOpen || !suggestion) return null

  // Tag Handling
  const handleAddTag = () => {
    const trimmed = tagInput.trim().replace(/^#/, '')
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed])
      setTagInput('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove))
  }

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (type === 'solution') {
      if (!title.trim() || !mechanism.trim()) return
      onSaveSolution({
        title: title.trim(),
        mechanism: mechanism.trim(),
      })
    } else {
      if (!content.trim()) return
      onSaveNote({
        content: content.trim(),
        note_type: noteType,
        tags: tags.length > 0 ? tags : undefined,
      })
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="editable-draft-modal-title"
      aria-describedby="editable-draft-modal-description"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleAttemptClose()
        }
      }}
    >
      <div className="bg-card border border-border rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                'p-2 rounded-lg',
                type === 'solution'
                  ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                  : 'bg-primary/10 text-primary'
              )}
            >
              {type === 'solution' ? (
                <Lightbulb className="w-5 h-5" />
              ) : (
                <Bookmark className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3
                id="editable-draft-modal-title"
                className="text-base font-semibold text-foreground"
              >
                {type === 'solution'
                  ? 'Biên tập Giải pháp ứng viên'
                  : 'Biên tập Ghi chép nghiên cứu'}
              </h3>
              <p
                id="editable-draft-modal-description"
                className="text-xs text-muted-foreground mt-0.5"
              >
                {type === 'solution' ? 'Xác nhận lưu giải pháp' : 'Xác nhận lưu ghi chép'} — Bạn có
                thể hoàn thiện nội dung trước khi lưu.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAttemptClose}
            disabled={isLoading}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors disabled:opacity-50"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Alert (Network failure / HTTP 500) */}
        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 text-xs"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">Lỗi lưu dữ liệu</p>
              <p className="leading-relaxed">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Discard Confirmation Guard */}
        {showDiscardConfirm && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs space-y-2"
          >
            <p className="font-medium">
              Bản nháp đã bị thay đổi. Bạn có chắc chắn muốn hủy bỏ các thay đổi và đóng lại?
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                className="px-2.5 py-1 text-xs font-medium bg-muted/80 hover:bg-muted text-foreground rounded-md transition-colors cursor-pointer"
              >
                Tiếp tục chỉnh sửa
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="px-2.5 py-1 text-xs font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-md transition-colors cursor-pointer"
              >
                Xác nhận hủy
              </button>
            </div>
          </div>
        )}

        {/* Grounding Source Info */}
        <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50 text-xs text-muted-foreground flex items-center justify-between gap-2">
          <span>
            <strong className="text-foreground">Căn cứ: </strong>
            {suggestion.source_grounding.source_reference}
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded bg-muted font-mono border border-border/30">
            {suggestion.category}
          </span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {type === 'solution' ? (
            <>
              {/* Solution Title */}
              <div className="space-y-1.5">
                <label
                  htmlFor="solution-title"
                  className="block text-xs font-medium text-foreground"
                >
                  Tiêu đề giải pháp <span className="text-destructive">*</span>
                </label>
                <input
                  id="solution-title"
                  type="text"
                  required
                  aria-required="true"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isLoading}
                  placeholder="Nhập tiêu đề giải pháp..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
                />
              </div>

              {/* Solution Mechanism */}
              <div className="space-y-1.5">
                <label
                  htmlFor="solution-mechanism"
                  className="block text-xs font-medium text-foreground"
                >
                  Cơ chế hoạt động <span className="text-destructive">*</span>
                </label>
                <textarea
                  id="solution-mechanism"
                  required
                  aria-required="true"
                  rows={4}
                  value={mechanism}
                  onChange={(e) => setMechanism(e.target.value)}
                  disabled={isLoading}
                  placeholder="Mô tả nguyên lý hoạt động và các bước triển khai..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 resize-y leading-relaxed"
                />
              </div>
            </>
          ) : (
            <>
              {/* Note Content */}
              <div className="space-y-1.5">
                <label
                  htmlFor="note-content"
                  className="block text-xs font-medium text-foreground"
                >
                  Nội dung ghi chú <span className="text-destructive">*</span>
                </label>
                <textarea
                  id="note-content"
                  required
                  aria-required="true"
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  disabled={isLoading}
                  placeholder="Nội dung ghi chép nghiên cứu..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 resize-y leading-relaxed"
                />
              </div>

              {/* Note Type & Tags Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Note Type */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="note-type"
                    className="block text-xs font-medium text-foreground"
                  >
                    Loại ghi chú
                  </label>
                  <select
                    id="note-type"
                    value={noteType}
                    onChange={(e) => setNoteType(e.target.value as NoteType)}
                    disabled={isLoading}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
                  >
                    <option value="insight">Phát hiện (Insight)</option>
                    <option value="hypothesis">Giả thuyết (Hypothesis)</option>
                    <option value="question">Câu hỏi (Question)</option>
                    <option value="decision">Quyết định (Decision)</option>
                    <option value="action">Hành động (Action)</option>
                  </select>
                </div>

                {/* Tags Input */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="note-tags"
                    className="block text-xs font-medium text-foreground"
                  >
                    Nhãn phân loại (Tags)
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      id="note-tags"
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleTagInputKeyDown}
                      disabled={isLoading}
                      placeholder="Thêm tag và nhấn Enter..."
                      className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={handleAddTag}
                      disabled={isLoading || !tagInput.trim()}
                      className="px-2.5 py-2 rounded-lg border border-input bg-muted hover:bg-muted/80 text-foreground text-xs font-medium disabled:opacity-50"
                    >
                      Thêm
                    </button>
                  </div>
                </div>
              </div>

              {/* Tag Chips */}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground border border-border/50"
                    >
                      <Tag className="w-3 h-3" />
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-foreground p-0.5 rounded-full"
                        aria-label={`Xóa tag ${tag}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/40">
            <button
              type="button"
              onClick={handleAttemptClose}
              disabled={isLoading}
              className="px-4 py-2 border border-input rounded-lg text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={
                isLoading ||
                (type === 'solution' ? !title.trim() || !mechanism.trim() : !content.trim())
              }
              aria-label={
                type === 'solution' ? 'Xác nhận lưu giải pháp' : 'Xác nhận lưu ghi chép'
              }
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer shadow-xs',
                'bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <span>{type === 'solution' ? 'Lưu giải pháp' : 'Lưu ghi chép'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
