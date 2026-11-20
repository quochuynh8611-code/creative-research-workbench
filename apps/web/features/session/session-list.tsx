'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
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
  Archive,
  RotateCcw,
  ArchiveRestore,
  Upload,
  BookTemplate,
  Layers,
  Sparkles,
  HelpCircle,
  Download,
  CheckSquare,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listSessions,
  createSession,
  archiveSession,
  restoreSession,
  importSession,
  getSessionTemplates,
  createSessionFromTemplate,
} from '@/lib/api-client'
import { DOMAIN_LABELS, STATUS_LABELS, STAGE_LABELS, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { DomainType } from '@/lib/types'
import { AIStatusBadge } from '@/features/system/ai-status-badge'
import { OnboardingWorkflowBanner } from '@/features/session/onboarding-workflow-banner'
import { WelcomeOnboardingModal } from '@/features/session/welcome-onboarding-modal'
import { BatchExportModal } from '@/features/session/batch-export-modal'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-accent text-accent-foreground',
  archived: 'bg-secondary text-secondary-foreground',
  paused: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
}

const DOMAIN_OPTIONS: { value: DomainType; label: string }[] = [
  { value: 'life', label: 'Đời sống' },
  { value: 'business', label: 'Kinh tế / Kinh doanh' },
  { value: 'culture', label: 'Văn hóa' },
  { value: 'society', label: 'Xã hội' },
  { value: 'healthcare', label: 'Y tế / Sức khỏe' },
  { value: 'education', label: 'Giáo dục' },
  { value: 'sustainability', label: 'Môi trường / Bền vững' },
]

export function SessionList() {
  const [activeTab, setActiveTab] = useState<'active' | 'archived' | 'templates'>('active')
  const [search, setSearch] = useState('')
  const [filterDomain, setFilterDomain] = useState<string>('all')
  const [isCreating, setIsCreating] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)
  const [formDescription, setFormDescription] = useState('')
  const [formDomain, setFormDomain] = useState<DomainType>('life')
  const [formTags, setFormTags] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null)
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false)
  const [templateDomainFilter, setTemplateDomainFilter] = useState<string>('all')
  const [importNotification, setImportNotification] = useState<{
    type: 'success' | 'error'
    message: string
    action?: { label: string; href: string }
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const tabActiveRef = useRef<HTMLButtonElement | null>(null)
  const tabArchivedRef = useRef<HTMLButtonElement | null>(null)
  const tabTemplatesRef = useRef<HTMLButtonElement | null>(null)

  const handleTabKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    currentTab: 'active' | 'archived' | 'templates'
  ) => {
    const tabOrder: ('active' | 'archived' | 'templates')[] = ['active', 'archived', 'templates']
    const currentIndex = tabOrder.indexOf(currentTab)

    let nextIndex = currentIndex
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      nextIndex = (currentIndex + 1) % tabOrder.length
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      nextIndex = (currentIndex - 1 + tabOrder.length) % tabOrder.length
    } else if (e.key === 'Home') {
      e.preventDefault()
      nextIndex = 0
    } else if (e.key === 'End') {
      e.preventDefault()
      nextIndex = tabOrder.length - 1
    }

    if (nextIndex !== currentIndex) {
      const nextTab = tabOrder[nextIndex]
      setActiveTab(nextTab)
      setSearch('')
      if (nextTab === 'active') tabActiveRef.current?.focus()
      else if (nextTab === 'archived') tabArchivedRef.current?.focus()
      else if (nextTab === 'templates') tabTemplatesRef.current?.focus()
    }
  }

  // C39-FEAT-02: Multi-Session Selection & Batch Export State
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set())
  const [isBatchExportModalOpen, setIsBatchExportModalOpen] = useState(false)
  const [batchExportMode, setBatchExportMode] = useState<'selected' | 'filter'>('selected')

  useEffect(() => {
    if (activeTab === 'templates') {
      setTemplateDomainFilter('all')
    }
  }, [activeTab])

  const queryClient = useQueryClient()

  const queryParams = {
    ...(activeTab === 'archived' ? { status: 'archived' } : {}),
    ...(filterDomain !== 'all' ? { domain: filterDomain } : {}),
  }

  // 1. Read Path Query (Filtered by Active vs Archived and Domain)
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['sessions', activeTab === 'archived' ? 'archived' : 'active', filterDomain],
    queryFn: () => listSessions(Object.keys(queryParams).length > 0 ? queryParams : undefined),
    enabled: activeTab === 'active' || activeTab === 'archived',
    staleTime: 30000,
  })

  // 2. Create Path Mutation
  const createMutation = useMutation({
    mutationFn: createSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      handleCloseForm()
    },
  })

  // 3. Archive Path Mutation
  const archiveMutation = useMutation({
    mutationFn: (sessionId: string) => archiveSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      setConfirmArchiveId(null)
    },
  })

  // 4. Restore Path Mutation
  const restoreMutation = useMutation({
    mutationFn: (sessionId: string) => restoreSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
    },
  })

  // 5. Templates Query (Phase 9.3 & Domain Templates Tab)
  const {
    data: templates = [],
    isLoading: isLoadingTemplates,
    isError: isErrorTemplates,
    isFetching: isFetchingTemplates,
    refetch: refetchTemplates,
  } = useQuery({
    queryKey: ['session-templates'],
    queryFn: async () => {
      const res = await getSessionTemplates()
      return Array.isArray(res) ? res : []
    },
    enabled: activeTab === 'templates',
  })

  const templateDomainOptions = useMemo(() => {
    const uniqueDomains = new Set<string>()
    templates.forEach((t) => {
      if (t.domain && typeof t.domain === 'string') {
        uniqueDomains.add(t.domain)
      }
    })

    const targetOrder = ['life', 'business', 'culture', 'society']

    const ordered: string[] = []
    targetOrder.forEach((d) => {
      if (uniqueDomains.has(d)) {
        ordered.push(d)
      }
    })

    templates.forEach((t) => {
      if (
        t.domain &&
        typeof t.domain === 'string' &&
        !targetOrder.includes(t.domain) &&
        !ordered.includes(t.domain)
      ) {
        ordered.push(t.domain)
      }
    })

    return ordered.map((d) => ({
      value: d,
      label: DOMAIN_LABELS[d as DomainType] || d,
    }))
  }, [templates])

  const filteredTemplates = useMemo(() => {
    if (templateDomainFilter === 'all') {
      return templates
    }
    return templates.filter((tpl) => tpl.domain === templateDomainFilter)
  }, [templates, templateDomainFilter])

  // 6. Import Mutation (Phase 9.3)
  const importMutation = useMutation({
    mutationFn: (snapshot: Record<string, any>) => importSession(snapshot),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      setActiveTab('active')
      setImportNotification({
        type: 'success',
        message: `Đã nhập thành công phiên: "${res.data.title}" (${res.imported_elements?.notes_count ?? 0} ghi chú, ${res.imported_elements?.solutions_count ?? 0} giải pháp).`,
      })
      setTimeout(() => setImportNotification(null), 6000)
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || err.message || 'Lỗi khi nhập phiên.'
      setImportNotification({ type: 'error', message: msg })
    },
  })

  // 7. Create from Template Mutation (Phase 9.3)
  const templateMutation = useMutation({
    mutationFn: (input: { template_id: string; custom_title?: string; title?: string }) =>
      createSessionFromTemplate(input),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      setActiveTab('active')
      setImportNotification({
        type: 'success',
        message: `Đã khởi tạo phiên nghiên cứu từ Mẫu: "${res.title}".`,
        action: {
          label: 'Mở phiên ngay ➔',
          href: `/sessions/${res.id}`,
        },
      })
      setTimeout(() => setImportNotification(null), 6000)
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || err.message || 'Lỗi khi áp dụng mẫu.'
      setImportNotification({ type: 'error', message: msg })
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

  // C39-FEAT-02: Selection computed and handlers
  const isAllSelected = filtered.length > 0 && filtered.every((s) => selectedSessionIds.has(s.id))

  const toggleSelectSession = (id: string) => {
    setSelectedSessionIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelectAllOnPage = () => {
    setSelectedSessionIds((prev) => {
      const next = new Set(prev)
      if (isAllSelected) {
        filtered.forEach((s) => next.delete(s.id))
      } else {
        filtered.forEach((s) => next.add(s.id))
      }
      return next
    })
  }

  const handleClearSelection = () => {
    setSelectedSessionIds(new Set())
  }

  const handleOpenBatchExport = (mode: 'selected' | 'filter') => {
    setBatchExportMode(mode)
    setIsBatchExportModalOpen(true)
  }

  const handleBatchExportSuccess = () => {
    setIsBatchExportModalOpen(false)
    setSelectedSessionIds(new Set())
    queryClient.invalidateQueries({ queryKey: ['sessions'] })
  }

  const sessionToArchive = sessions.find((s) => s.id === confirmArchiveId)

  // Auto-open Welcome Onboarding Modal for first-time visitors with empty sessions
  useEffect(() => {
    try {
      const isDismissed = localStorage.getItem('crw_onboarding_dismissed') === 'true'
      if (!isDismissed && !isLoading && !isError && sessions.length === 0 && activeTab === 'active') {
        setIsWelcomeModalOpen(true)
      }
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }, [isLoading, isError, sessions.length, activeTab])

  const formatWorkflowState = (state?: string) => {
    if (!state) return null
    return STAGE_LABELS[state] || state
  }

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string
        const parsed = JSON.parse(content)
        importMutation.mutate(parsed)
      } catch (err) {
        setImportNotification({
          type: 'error',
          message: 'Tệp không phải là JSON hợp lệ hoặc cấu trúc snapshot bị lỗi.',
        })
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    }
    reader.readAsText(file)
  }

  const handleOpenForm = () => {
    setIsCreating(true)
    setFormDomain('life')
    setValidationError(null)
    createMutation.reset()
  }

  const handleCloseForm = () => {
    setIsCreating(false)
    setFormTitle('')
    setFormDescription('')
    setFormDomain('life')
    setFormTags('')
    setValidationError(null)
    createMutation.reset()
  }

  const handleSubmitCreate = (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedTitle = formTitle.trim()
    if (!trimmedTitle) {
      setValidationError('Vui lòng nhập tiêu đề session')
      titleInputRef.current?.focus()
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

  let counterText = `${totalCount} sessions`
  if (activeTab === 'templates') {
    counterText = isLoadingTemplates ? 'Đang tải mẫu...' : `${templates.length} mẫu nghiên cứu`
  } else if (isLoading) {
    counterText = 'Đang tải...'
  } else if (normalizedQuery) {
    counterText = `${filtered.length} / ${totalCount} sessions`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Research Sessions</h1>
            <AIStatusBadge />
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            {counterText}
          </p>
        </div>
        {!isCreating && (
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileImport}
              accept=".json"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importMutation.isPending}
              className="inline-flex items-center gap-2 border border-input bg-background hover:bg-muted text-foreground px-3.5 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
            >
              {importMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              Nhập JSON
            </button>
            <button
              type="button"
              onClick={() => handleOpenBatchExport('filter')}
              className="inline-flex items-center gap-2 border border-input bg-background hover:bg-muted text-foreground px-3.5 py-2 rounded-md text-sm font-medium transition-colors"
              title="Xuất lưu trữ hàng loạt"
              aria-label="Xuất lưu trữ hàng loạt"
            >
              <Archive className="w-4 h-4" />
              <span>Xuất lưu trữ</span>
            </button>
            <button
              type="button"
              onClick={() => setIsWelcomeModalOpen(true)}
              className="inline-flex items-center gap-1.5 border border-input bg-background hover:bg-muted text-foreground px-3.5 py-2 rounded-md text-sm font-medium transition-colors"
              title="Hướng dẫn nhanh"
              aria-label="Hướng dẫn nhanh"
            >
              <HelpCircle className="w-4 h-4 text-primary" />
              <span className="hidden sm:inline">Hướng dẫn nhanh</span>
            </button>
            <button
              type="button"
              data-testid="header-templates-button"
              onClick={() => {
                setActiveTab('templates')
                setSearch('')
              }}
              className={cn(
                'inline-flex items-center gap-2 border border-input px-3.5 py-2 rounded-md text-sm font-medium transition-colors',
                activeTab === 'templates'
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'bg-background hover:bg-muted text-foreground'
              )}
            >
              <BookTemplate className="w-4 h-4" />
              Mẫu nghiên cứu
            </button>
            <button
              onClick={handleOpenForm}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              Tạo session mới
            </button>
          </div>
        )}
      </div>

      {/* Import Notification Banner */}
      {importNotification && (
        <div
          role={importNotification.type === 'error' ? 'alert' : 'status'}
          aria-live="polite"
          className={cn(
            'p-4 rounded-md text-sm flex items-center justify-between border gap-3',
            importNotification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300'
              : 'bg-destructive/10 border-destructive/20 text-destructive'
          )}
        >
          <div className="flex items-center gap-2 flex-wrap">
            {importNotification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{importNotification.message}</span>
            {importNotification.action && (
              <Link
                href={importNotification.action.href}
                className="inline-flex items-center gap-1 font-semibold underline hover:opacity-80 transition-opacity ml-1"
              >
                {importNotification.action.label}
              </Link>
            )}
          </div>
          <button
            type="button"
            onClick={() => setImportNotification(null)}
            aria-label="Đóng thông báo"
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Status Filter Tabs (Active vs Archived vs Templates) */}
      <div
        role="tablist"
        aria-label="Chế độ xem phiên nghiên cứu"
        className="flex items-center gap-2 border-b border-border pb-1"
      >
        <button
          ref={tabActiveRef}
          type="button"
          role="tab"
          id="tab-active"
          aria-selected={activeTab === 'active'}
          aria-controls="tabpanel-sessions"
          tabIndex={activeTab === 'active' ? 0 : -1}
          data-testid="tab-active"
          onClick={() => {
            setActiveTab('active')
            setSearch('')
          }}
          onKeyDown={(e) => handleTabKeyDown(e, 'active')}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-t-md transition-colors relative flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            activeTab === 'active'
              ? 'text-primary border-b-2 border-primary font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <span>Đang hoạt động</span>
        </button>
        <button
          ref={tabArchivedRef}
          type="button"
          role="tab"
          id="tab-archived"
          aria-selected={activeTab === 'archived'}
          aria-controls="tabpanel-sessions"
          tabIndex={activeTab === 'archived' ? 0 : -1}
          data-testid="tab-archived"
          onClick={() => {
            setActiveTab('archived')
            setSearch('')
          }}
          onKeyDown={(e) => handleTabKeyDown(e, 'archived')}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-t-md transition-colors relative flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            activeTab === 'archived'
              ? 'text-primary border-b-2 border-primary font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Archive className="w-4 h-4" />
          <span>Đã lưu trữ</span>
        </button>
        <button
          ref={tabTemplatesRef}
          type="button"
          role="tab"
          id="tab-templates"
          aria-selected={activeTab === 'templates'}
          aria-controls="tabpanel-templates"
          tabIndex={activeTab === 'templates' ? 0 : -1}
          data-testid="tab-templates"
          onClick={() => {
            setActiveTab('templates')
            setSearch('')
          }}
          onKeyDown={(e) => handleTabKeyDown(e, 'templates')}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-t-md transition-colors relative flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            activeTab === 'templates'
              ? 'text-primary border-b-2 border-primary font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <BookTemplate className="w-4 h-4" />
          <span>Mẫu nghiên cứu{templates.length > 0 ? ` (${templates.length})` : ''}</span>
        </button>
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
              <div
                id="session-title-validation-error"
                role="alert"
                className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-2.5 rounded-md flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Mutation Server Error Banner */}
            {createMutation.isError && (
              <div
                id="session-title-server-error"
                role="alert"
                className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-2.5 rounded-md flex items-center gap-2"
              >
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
                ref={titleInputRef}
                aria-label="Tiêu đề"
                aria-required="true"
                aria-invalid={Boolean(validationError)}
                aria-describedby={
                  validationError
                    ? 'session-title-validation-error'
                    : createMutation.isError
                    ? 'session-title-server-error'
                    : undefined
                }
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

      {/* Confirmation Modal for Safe Archive */}
      {confirmArchiveId && sessionToArchive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-xl max-w-md w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                <Archive className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">Lưu trữ Research Session</h3>
                <p className="text-sm text-muted-foreground">
                  Bạn có chắc chắn muốn chuyển session <span className="font-medium text-foreground">"{sessionToArchive.title}"</span> vào mục Lưu trữ không?
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
              💡 Lưu ý: Dữ liệu nghiên cứu, ProblemFrame và Contradiction vẫn được bảo toàn nguyên vẹn và bạn có thể khôi phục lại bất kỳ lúc nào.
            </p>

            {archiveMutation.isError && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-3.5 py-2 rounded-md flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{(archiveMutation.error as Error)?.message || 'Không thể lưu trữ session'}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmArchiveId(null)}
                disabled={archiveMutation.isPending}
                className="px-4 py-2 border border-input rounded-md text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => archiveMutation.mutate(confirmArchiveId)}
                disabled={archiveMutation.isPending}
                className="inline-flex items-center gap-2 bg-destructive text-destructive-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {archiveMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang lưu trữ...
                  </>
                ) : (
                  <>
                    <Archive className="w-4 h-4" />
                    Xác nhận lưu trữ
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content Area: Templates Tab vs Sessions View */}
      {activeTab === 'templates' ? (
        <div
          role="tabpanel"
          id="tabpanel-templates"
          aria-labelledby="tab-templates"
          tabIndex={0}
          className="space-y-4 focus:outline-none"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border p-4 rounded-lg">
            <div className="flex-1">
              <div className="flex items-center justify-between pb-1">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <BookTemplate className="w-5 h-5 text-primary" />
                  Mẫu Nghiên cứu Định sẵn (Domain Templates)
                </h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('active')}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground">
                Chọn mẫu bài toán phù hợp với lĩnh vực của bạn để khởi tạo cấu trúc mâu thuẫn và đề xuất phương pháp TRIZ tự động:
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <label htmlFor="template-domain-filter" className="text-xs text-muted-foreground whitespace-nowrap">
                Lọc mẫu theo lĩnh vực
              </label>
              <select
                id="template-domain-filter"
                aria-label="Lọc mẫu theo lĩnh vực"
                value={templateDomainFilter}
                onChange={(e) => setTemplateDomainFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">Tất cả lĩnh vực</option>
                {templateDomainOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isLoadingTemplates && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground space-y-2">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-xs">Đang tải danh sách mẫu...</p>
            </div>
          )}

          {isErrorTemplates && !isLoadingTemplates && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Không tải được danh sách mẫu nghiên cứu.</span>
              </div>
              <button
                type="button"
                onClick={() => refetchTemplates()}
                disabled={isFetchingTemplates}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-destructive/40 bg-background text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 shrink-0"
              >
                {isFetchingTemplates && <Loader2 className="w-3 h-3 animate-spin" />}
                Thử lại
              </button>
            </div>
          )}

          {!isLoadingTemplates && !isErrorTemplates && templates.length === 0 && (
            <p className="text-sm text-center py-12 text-muted-foreground">
              Không tìm thấy mẫu nghiên cứu nào.
            </p>
          )}

          {!isLoadingTemplates && templates.length > 0 && filteredTemplates.length === 0 && (
            <p className="text-sm text-center py-12 text-muted-foreground">
              Không có mẫu nghiên cứu thuộc lĩnh vực đã chọn.
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {filteredTemplates.map((tpl) => (
              <div
                key={tpl.id}
                className="border border-border/80 hover:border-primary/50 bg-card hover:bg-muted/30 p-4 rounded-lg transition-all flex flex-col justify-between gap-3"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-sm">{tpl.title}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary font-medium">
                      {DOMAIN_LABELS[tpl.domain as DomainType] || tpl.domain}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{tpl.description}</p>
                  {tpl.tags && tpl.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {tpl.tags.map((tg) => (
                        <span key={tg} className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          #{tg}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end pt-2 border-t border-border/40">
                  <button
                    type="button"
                    disabled={templateMutation.isPending}
                    onClick={() => templateMutation.mutate({ template_id: tpl.id })}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {templateMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    Áp dụng mẫu này
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div
          role="tabpanel"
          id="tabpanel-sessions"
          aria-labelledby={activeTab === 'active' ? 'tab-active' : 'tab-archived'}
          tabIndex={0}
          className="space-y-6 focus:outline-none"
        >
          {/* Search & Domain Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                id="session-search-input"
                aria-label="Tìm session theo tên"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm session theo tên..."
                disabled={isLoading || isError}
                className="w-full pl-9 pr-4 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
            </div>

            <div className="w-full sm:w-56">
              <label htmlFor="filter-domain" className="sr-only">
                Lọc theo lĩnh vực
              </label>
              <select
                id="filter-domain"
                aria-label="Lọc theo lĩnh vực"
                value={filterDomain}
                onChange={(e) => setFilterDomain(e.target.value)}
                disabled={isLoading || isError}
                className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              >
                <option value="all">Tất cả lĩnh vực</option>
                {DOMAIN_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
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
            <div className="space-y-6">
              {sessions.length === 0 && activeTab === 'active' && (
                <OnboardingWorkflowBanner />
              )}
              <div className="text-center py-12 text-muted-foreground space-y-3">
                <Brain className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">
                  {activeTab === 'archived'
                    ? 'Không có session nào được lưu trữ'
                    : sessions.length === 0
                    ? 'Chưa có session nào'
                    : 'Không tìm thấy session nào'}
                </p>
                <p className="text-sm mt-1">
                  {activeTab === 'archived'
                    ? 'Các session được lưu trữ an toàn sẽ xuất hiện tại đây'
                    : sessions.length === 0
                    ? 'Tạo session đầu tiên hoặc khám phá các mẫu nghiên cứu định sẵn để bắt đầu'
                    : 'Thử tìm kiếm với từ khóa khác'}
                </p>
                <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    data-testid="empty-explore-templates-cta"
                    onClick={() => setActiveTab('templates')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Khám phá Mẫu nghiên cứu ➔
                  </button>
                  {sessions.length > 0 && normalizedQuery && (
                    <button
                      onClick={() => setSearch('')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium border border-input hover:bg-muted transition-colors text-foreground"
                    >
                      <X className="w-3.5 h-3.5" />
                      Xóa tìm kiếm
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

      {/* 4. Success State — Session cards */}
      {!isLoading && !isError && filtered.length > 0 && (
        <div className="space-y-3">
          {/* Master Select Bar */}
          <div className="flex items-center justify-between px-1 py-1 text-xs text-muted-foreground">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                aria-label="Chọn tất cả phiên trên trang"
                checked={isAllSelected}
                onChange={toggleSelectAllOnPage}
                className="w-4 h-4 rounded border-input text-primary focus:ring-primary cursor-pointer"
              />
              <span className="font-medium text-foreground">
                Chọn tất cả ({filtered.length})
              </span>
            </label>
            {selectedSessionIds.size > 0 && (
              <span className="text-xs">
                Đã chọn {selectedSessionIds.size} / {filtered.length} phiên
              </span>
            )}
          </div>

          {filtered.map((session) => (
            <div
              key={session.id}
              className={cn(
                'group relative bg-card border rounded-lg p-5 hover:border-primary/50 hover:shadow-sm transition-all',
                selectedSessionIds.has(session.id)
                  ? 'border-primary/70 bg-primary/[0.02] ring-1 ring-primary/20'
                  : 'border-border'
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div onClick={(e) => e.stopPropagation()} className="pt-0.5 shrink-0">
                  <input
                    type="checkbox"
                    aria-label={`Chọn phiên: ${session.title}`}
                    checked={selectedSessionIds.has(session.id)}
                    onChange={() => toggleSelectSession(session.id)}
                    className="w-4 h-4 rounded border-input text-primary focus:ring-primary cursor-pointer"
                  />
                </div>
                <Link
                  href={`/sessions/${session.id}`}
                  className="flex-1 min-w-0"
                >
                  <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
                    {session.title}
                  </h3>
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
                </Link>

                <div className="flex flex-col items-end gap-3 shrink-0">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {formatDate(session.updated_at)}
                  </div>

                  {/* Actions: Archive (for active/draft/completed) or Restore (for archived) */}
                  {activeTab === 'archived' ? (
                    <button
                      type="button"
                      aria-label="Khôi phục session"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        restoreMutation.mutate(session.id)
                      }}
                      disabled={restoreMutation.isPending}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50"
                    >
                      {restoreMutation.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3.5 h-3.5" />
                      )}
                      Khôi phục
                    </button>
                  ) : (
                    <button
                      type="button"
                      aria-label="Lưu trữ session"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setConfirmArchiveId(session.id)
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-80 group-hover:opacity-100"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      Lưu trữ
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
        </div>
      )}

      {/* Welcome Onboarding Modal (Batch C33 PR 1) */}
      <WelcomeOnboardingModal
        isOpen={isWelcomeModalOpen}
        onClose={() => setIsWelcomeModalOpen(false)}
        onOpenCreateForm={() => {
          setIsCreating(true)
          setValidationError(null)
        }}
      />

      {/* Floating Batch Action Toolbar (C39-FEAT-02) */}
      {selectedSessionIds.size > 0 && (
        <div
          data-testid="floating-batch-toolbar"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-card/95 backdrop-blur-md border border-primary/30 shadow-2xl rounded-full px-5 py-2.5 flex items-center gap-4 animate-in slide-in-from-bottom-5"
        >
          <div
            data-testid="batch-selection-counter"
            aria-live="polite"
            className="text-xs font-semibold text-foreground flex items-center gap-1.5"
          >
            <CheckSquare className="w-4 h-4 text-primary" />
            <span>Đã chọn {selectedSessionIds.size} phiên</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <button
            type="button"
            onClick={() => handleOpenBatchExport('selected')}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            aria-label="Xuất các phiên đã chọn"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất các phiên đã chọn</span>
          </button>
          <button
            type="button"
            onClick={handleClearSelection}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
            aria-label="Bỏ chọn tất cả"
          >
            Bỏ chọn tất cả
          </button>
        </div>
      )}

      {/* Batch Export & Archive Modal (C39-FEAT-02) */}
      <BatchExportModal
        isOpen={isBatchExportModalOpen}
        onClose={() => setIsBatchExportModalOpen(false)}
        selectedSessionIds={batchExportMode === 'selected' ? Array.from(selectedSessionIds) : []}
        initialFilters={
          batchExportMode === 'filter'
            ? {
                status: activeTab === 'archived' ? 'archived' : 'active',
                domain: filterDomain !== 'all' ? (filterDomain as DomainType) : undefined,
                q: search.trim() || undefined,
              }
            : undefined
        }
        onSuccess={handleBatchExportSuccess}
      />
    </div>
  )
}

