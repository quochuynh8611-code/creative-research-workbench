'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Boxes,
  AlertCircle,
  RefreshCw,
  Bookmark,
  CheckSquare,
  HelpCircle,
  ListTree,
} from 'lucide-react'
import { getTrizResourceTaxonomy } from '@/lib/api-client'
import { validateTrizResourceContext } from '@/lib/triz-resource-context-validator'
import type { TrizResourceTaxonomyResponse, NoteDraft } from '@/lib/types'

interface ResourceAnalysisPanelProps {
  onSaveAsNote?: (draft: NoteDraft) => void
}

type ResourceCategoryKey = 'substance' | 'field' | 'time' | 'space' | 'information'

const CATEGORY_TABS: { key: ResourceCategoryKey; label: string }[] = [
  { key: 'substance', label: 'Chất' },
  { key: 'field', label: 'Trường' },
  { key: 'time', label: 'Thời gian' },
  { key: 'space', label: 'Không gian' },
  { key: 'information', label: 'Thông tin' },
]

export function ResourceAnalysisPanel({ onSaveAsNote }: ResourceAnalysisPanelProps) {
  const [activeCategory, setActiveCategory] = useState<ResourceCategoryKey>('substance')
  const [userNotes, setUserNotes] = useState<Record<string, string>>({})
  const [checkedQuestions, setCheckedQuestions] = useState<Record<string, boolean>>({})
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<TrizResourceTaxonomyResponse>({
    queryKey: ['triz', 'resource-taxonomy'],
    queryFn: () => getTrizResourceTaxonomy(),
    staleTime: 1000 * 60 * 60, // 1 hour cache
  })

  const categories = data?.data ?? []
  const currentCategory = categories.find((c) => c.category === activeCategory) || categories[0]

  const toggleCheckQuestion = (q: string) => {
    setCheckedQuestions((prev) => ({
      ...prev,
      [q]: !prev[q],
    }))
  }

  const handleSaveNote = () => {
    if (!currentCategory || !onSaveAsNote) return

    const contextCandidate = {
      schema_version: 1,
      source_type: 'triz_resource',
      resource_type: currentCategory.category,
      resource_name: currentCategory.name_vi,
    }

    const validation = validateTrizResourceContext(contextCandidate)
    if (!validation.ok) {
      setValidationError(validation.error)
      return
    }
    setValidationError(null)

    const noteText = userNotes[currentCategory.category]?.trim() || ''
    const checkedList = currentCategory.checklist_questions.filter((q) => checkedQuestions[q])
    const checkedBlock = checkedList.length > 0
      ? `\n\nNguồn lực đã đánh dấu tiềm năng:\n${checkedList.map((q) => `[x] ${q}`).join('\n')}`
      : ''
    const subtypesBlock = currentCategory.subtypes.length > 0
      ? `\n\nPhân nhóm tài nguyên: ${currentCategory.subtypes.join('; ')}`
      : ''

    const content = `[TRIZ Resource: ${currentCategory.name_vi} (${currentCategory.name_en})]\n${
      noteText ? `Ghi chú tài nguyên: ${noteText}\n` : ''
    }Mô tả: ${currentCategory.description}${subtypesBlock}${checkedBlock}`

    onSaveAsNote({
      content,
      note_type: 'hypothesis',
      source_context: validation.data,
    })

    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 2500)
  }

  if (isError) {
    return (
      <div
        data-testid="resource-analysis-error"
        className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive flex items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>
            {error instanceof Error ? error.message : 'Lỗi tải danh mục tài nguyên TRIZ từ máy chủ.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Thử lại
        </button>
      </div>
    )
  }

  if (isLoading || !currentCategory) {
    return (
      <div className="p-6 rounded-xl border border-border bg-card/60 animate-pulse space-y-4">
        <div className="h-6 w-1/3 bg-muted rounded"></div>
        <div className="h-10 w-full bg-muted/60 rounded"></div>
        <div className="h-32 w-full bg-muted/40 rounded"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/60 pb-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <Boxes className="w-5 h-5 text-primary" />
            Phân tích Nguồn lực TRIZ (5 nhóm tài nguyên)
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tìm kiếm nguồn lực có sẵn, miễn phí hoặc giá rẻ xung quanh hệ thống để giải quyết mâu thuẫn
          </p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary self-start sm:self-auto">
          5 nhóm tài nguyên
        </span>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Phân loại tài nguyên TRIZ"
        className="flex flex-wrap gap-1 p-1 rounded-lg bg-muted/50 border border-border/60"
      >
        {CATEGORY_TABS.map(({ key, label }) => {
          const isActive = activeCategory === key
          return (
            <button
              key={key}
              role="tab"
              aria-selected={isActive}
              type="button"
              onClick={() => {
                setActiveCategory(key)
                setSaveSuccess(false)
                setValidationError(null)
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                isActive
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Category Content Card */}
      <div className="rounded-xl border border-border bg-card/80 p-5 space-y-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-muted text-muted-foreground">
              {currentCategory.category}
            </span>
            <span className="text-xs text-muted-foreground italic">
              {currentCategory.name_en}
            </span>
          </div>
          <h3 className="text-base font-bold text-foreground mt-1.5">
            {currentCategory.name_vi}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {currentCategory.description}
          </p>
        </div>

        {/* Subtypes List */}
        {currentCategory.subtypes.length > 0 && (
          <div className="space-y-1.5 rounded-lg bg-muted/20 border border-border/60 p-3">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <ListTree className="w-3.5 h-3.5 text-primary" />
              Các phân nhóm cụ thể:
            </span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {currentCategory.subtypes.map((sub) => (
                <span
                  key={sub}
                  className="px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground border border-border/40"
                >
                  {sub}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Checklist questions */}
        {currentCategory.checklist_questions.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-sky-500" />
              Bảng kiểm phát hiện tài nguyên (Checklist):
            </span>
            <div className="space-y-1.5">
              {currentCategory.checklist_questions.map((q) => {
                const isChecked = Boolean(checkedQuestions[q])
                return (
                  <label
                    key={q}
                    className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-muted/30 cursor-pointer transition-colors text-xs text-muted-foreground"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleCheckQuestion(q)}
                      className="mt-0.5 rounded border-border text-primary focus:ring-primary"
                    />
                    <span className={isChecked ? 'text-foreground font-medium line-through' : ''}>
                      {q}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        )}

        {/* User Note Input */}
        <div className="space-y-2 pt-2 border-t border-border/60">
          <label
            htmlFor="resource-category-note"
            className="text-xs font-medium text-foreground block"
          >
            Ghi chú tài nguyên phát hiện:
          </label>
          <textarea
            id="resource-category-note"
            value={userNotes[currentCategory.category] || ''}
            onChange={(e) =>
              setUserNotes((prev) => ({
                ...prev,
                [currentCategory.category]: e.target.value,
              }))
            }
            placeholder="Ghi chú tài nguyên tiềm năng phát hiện được..."
            rows={2}
            className="w-full text-xs rounded-lg border border-border bg-background p-2.5 focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {validationError && (
          <p className="text-xs text-destructive">{validationError}</p>
        )}

        {/* Save button */}
        {onSaveAsNote && (
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={handleSaveNote}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors cursor-pointer"
            >
              <Bookmark className="w-3.5 h-3.5" />
              {saveSuccess ? 'Đã lưu vào sổ tay!' : 'Lưu vào sổ tay'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
