'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Plus,
  Search,
  Brain,
  Clock,
  Loader2,
  AlertCircle,
  RefreshCw,
  GitBranch,
  X,
  CheckCircle2,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listSessions, createSession } from '@/lib/api-client'
import { DOMAIN_LABELS, STATUS_LABELS, STAGE_LABELS, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { DomainType } from '@/lib/types'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-accent text-accent-foreground',
  archived: 'bg-secondary text-secondary-foreground',
  paused: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
}

const DOMAIN_OPTIONS: { value: DomainType; label: string }[] = [
  { value: 'technical', label: 'Kỹ thuật' },
  { value: 'business', label: 'Kinh doanh' },
  { value: 'education', label: 'Giáo dục' },
  { value: 'personal', label: 'Cá nhân' },
  { value: 'research', label: 'Nghiên cứu' },
]

export function SessionList() {
  const [search, setSearch] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formDomain, setFormDomain] = useState<DomainType>('technical')
  const [formTags, setFormTags] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  const queryClient = useQueryClient()

  // 1. Read Path Query
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => listSessions(),
  })

  // 2. Create Path Mutation
  const createMutation = useMutation({
    mutationFn: createSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      handleCloseForm()
    },
  })

  const sessions = data?.data ?? []
  const totalCount = data?.meta?.total ?? sessions.length
  const normalizedQuery = search.toLowerCase().trim()
  const cleanTagQuery = normalizedQuery.startsWith('#')
    ? normalizedQuery.slice(1)
    : normalizedQuery

  const filtered = sessions.filter((s) => {
    if (!normalizedQuery) return true
    const matchTitle = s.title.toLowerCase().includes(normalizedQuery)
    const matchDesc = s.description?.toLowerCase().includes(normalizedQuery) ?? false
    const matchDomain = s.domain?.toLowerCase().includes(normalizedQuery) ?? false
    const matchTags =
      s.tags?.some((tag) => {
        const lowerTag = tag.toLowerCase()
        return lowerTag.includes(cleanTagQuery) || lowerTag.includes(normalizedQuery)
      }) ?? false
    return matchTitle || matchDesc || matchDomain || matchTags
  })

  const formatWorkflowState = (state?: string) => {
    if (!state) return null
    return STAGE_LABELS[state] || state
  }

  const handleOpenForm = () => {
    setIsCreating(true)
    setValidationError(null)
    createMutation.reset()
  }

  const handleCloseForm = () => {
    setIsCreating(false)
    setFormTitle('')
    setFormDescription('')
    setFormDomain('technical')
    setFormTags('')
    setValidationError(null)
    createMutation.reset()
  }

  const handleSubmitCreate = (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedTitle = formTitle.trim()
    if (!trimmedTitle) {
      setValidationError('Vui lòng nhập tiêu đề session')
      return
    }

    setValidationError(null)

    const parsedTags = formTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    createMutation.mutate({
      title: trimmedTitle,
      description: formDescription.trim() || undefined,
      domain: formDomain,
      tags: parsedTags.length > 0 ? parsedTags : undefined,
    })
  }

  const counterText = isLoading
    ? 'Đang tải...'
    : normalizedQuery
    ? `${filtered.length} / ${totalCount} sessions`
    : `${totalCount} sessions`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Research Sessions</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {counterText}
          </p>
        </div>
        {!isCreating && (
          <button
            onClick={handleOpenForm}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Tạo session mới
          </button>
        )}
      </div>

      {/* Inline Creation Panel (Phase 5.3b) */}
      {isCreating && (
        <div className="bg-card border border-primary/30 rounded-lg p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              Tạo Research Session mới
            </h2>
            <button
              type="button"
              onClick={handleCloseForm}
              disabled={createMutation.isPending}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmitCreate} className="space-y-4">
            {/* Validation Error Banner */}
            {validationError && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-2.5 rounded-md flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Mutation Server Error Banner */}
            {createMutation.isError && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-2.5 rounded-md flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  {createMutation.error instanceof Error
                    ? createMutation.error.message
                    : 'Lỗi máy chủ khi tạo session'}
                </span>
              </div>
            )}

            {/* Title Field */}
            <div className="space-y-1.5">
              <label htmlFor="session-title" className="text-sm font-medium">
                Tiêu đề session <span className="text-destructive">*</span>
              </label>
              <input
                id="session-title"
                aria-label="Tiêu đề"
                value={formTitle}
                onChange={(e) => {
                  setFormTitle(e.target.value)
                  if (validationError) setValidationError(null)
                }}
                disabled={createMutation.isPending}
                placeholder="Ví dụ: Tối ưu hiệu suất pin thể rắn cho xe điện..."
                className="w-full px-3.5 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                autoFocus
              />
            </div>

            {/* Description Field */}
            <div className="space-y-1.5">
              <label htmlFor="session-description" className="text-sm font-medium">
                Mô tả
              </label>
              <textarea
                id="session-description"
                aria-label="Mô tả"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                disabled={createMutation.isPending}
                placeholder="Mô tả ngắn gọn bối cảnh vấn đề hoặc mục tiêu nghiên cứu..."
                rows={2}
                className="w-full px-3.5 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 resize-none"
              />
            </div>

            {/* Domain & Tags Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="session-domain" className="text-sm font-medium">
                  Lĩnh vực
                </label>
                <select
                  id="session-domain"
                  aria-label="Lĩnh vực"
                  value={formDomain}
                  onChange={(e) => setFormDomain(e.target.value as DomainType)}
                  disabled={createMutation.isPending}
                  className="w-full px-3.5 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                >
                  {DOMAIN_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="session-tags" className="text-sm font-medium">
                  Tags (phân cách bằng dấu phẩy)
                </label>
                <input
                  id="session-tags"
                  aria-label="Tags"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  disabled={createMutation.isPending}
                  placeholder="battery, ev, triz..."
                  className="w-full px-3.5 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                />
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleCloseForm}
                disabled={createMutation.isPending}
                className="px-4 py-2 border border-input rounded-md text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                onClick={handleSubmitCreate}
                disabled={createMutation.isPending}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang tạo...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Tạo session
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm session theo tên..."
          disabled={isLoading || isError}
          className="w-full pl-9 pr-4 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        />
      </div>

      {/* 1. Loading State */}
      {isLoading && (
        <div
          className="flex flex-col items-center justify-center py-16 text-muted-foreground space-y-3"
          role="status"
        >
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="font-medium text-sm">Đang tải danh sách sessions...</p>
        </div>
      )}

      {/* 2. Error State */}
      {isError && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center space-y-3">
          <AlertCircle className="w-8 h-8 mx-auto text-destructive" />
          <p className="text-sm font-medium text-destructive">
            Không thể tải danh sách session: {(error as Error)?.message || 'Đã có lỗi xảy ra'}
          </p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="w-4 h-4" />
            Thử lại
          </button>
        </div>
      )}

      {/* 3. Empty State */}
      {!isLoading && !isError && filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground space-y-3">
          <Brain className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">
            {sessions.length === 0 ? 'Chưa có session nào' : 'Không tìm thấy session nào'}
          </p>
          <p className="text-sm mt-1">
            {sessions.length === 0
              ? 'Tạo session đầu tiên để bắt đầu nghiên cứu'
              : 'Thử tìm kiếm với từ khóa khác'}
          </p>
          {sessions.length > 0 && normalizedQuery && (
            <div className="pt-2">
              <button
                onClick={() => setSearch('')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium border border-input hover:bg-muted transition-colors text-foreground"
              >
                <X className="w-3.5 h-3.5" />
                Xóa tìm kiếm
              </button>
            </div>
          )}
        </div>
      )}

      {/* 4. Success State — Session cards */}
      {!isLoading && !isError && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((session) => (
            <Link
              key={session.id}
              href={`/sessions/${session.id}`}
              className="block bg-card border border-border rounded-lg p-5 hover:border-primary/50 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{session.title}</h3>
                  {session.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {session.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <span
                      className={cn(
                        'text-xs px-2 py-0.5 rounded-full font-medium',
                        STATUS_COLORS[session.status] ?? 'bg-muted text-muted-foreground'
                      )}
                    >
                      {STATUS_LABELS[session.status] ?? session.status}
                    </span>

                    {session.domain && (
                      <span className="text-xs text-muted-foreground">
                        {DOMAIN_LABELS[session.domain] ?? session.domain}
                      </span>
                    )}

                    {session.workflow_state && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-accent/50 px-2 py-0.5 rounded">
                        <GitBranch className="w-3 h-3" />
                        {formatWorkflowState(session.workflow_state)}
                      </span>
                    )}

                    {session.tags &&
                      session.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded"
                        >
                          #{tag}
                        </span>
                      ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                  <Clock className="w-3 h-3" />
                  {formatDate(session.updated_at)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
