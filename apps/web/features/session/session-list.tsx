'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Search, Brain, Clock, Loader2, AlertCircle, RefreshCw, GitBranch } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { listSessions } from '@/lib/api-client'
import { DOMAIN_LABELS, STATUS_LABELS, STAGE_LABELS, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-accent text-accent-foreground',
  archived: 'bg-secondary text-secondary-foreground',
  paused: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
}

export function SessionList() {
  const [search, setSearch] = useState('')

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

  const sessions = data?.data ?? []
  const totalCount = data?.meta?.total ?? sessions.length

  const filtered = sessions.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase())
  )

  const formatWorkflowState = (state?: string) => {
    if (!state) return null
    return STAGE_LABELS[state] || state
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Research Sessions</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isLoading ? 'Đang tải...' : `${totalCount} sessions`}
          </p>
        </div>
        <button className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" />
          Tạo session mới
        </button>
      </div>

      {/* Search */}
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
        <div className="text-center py-16 text-muted-foreground">
          <Brain className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">
            {sessions.length === 0 ? 'Chưa có session nào' : 'Không tìm thấy session nào'}
          </p>
          <p className="text-sm mt-1">
            {sessions.length === 0
              ? 'Tạo session đầu tiên để bắt đầu nghiên cứu'
              : 'Thử tìm kiếm với từ khóa khác'}
          </p>
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
