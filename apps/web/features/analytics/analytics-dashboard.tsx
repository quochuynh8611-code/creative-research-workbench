'use client'

import React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  Brain,
  Lightbulb,
  BookOpen,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Loader2,
  FileText,
  GitBranch,
  Layers,
  Activity,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react'
import { getAnalyticsOverview } from '@/lib/api-client'
import { cn } from '@/lib/utils'

export function AnalyticsDashboard(): React.ReactElement {
  const {
    data: res,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: getAnalyticsOverview,
  })

  // 1. Loading State
  if (isLoading) {
    return (
      <div
        data-testid="analytics-loading-skeleton"
        className="w-full max-w-7xl mx-auto p-6 space-y-8 animate-pulse"
      >
        <div className="flex items-center justify-between border-b border-border pb-5">
          <div className="space-y-2">
            <div className="h-8 w-64 bg-muted rounded-md" />
            <div className="h-4 w-96 bg-muted/60 rounded-md" />
          </div>
          <div className="h-9 w-24 bg-muted rounded-md" />
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span>Đang tải dữ liệu phân tích...</span>
        </div>

        {/* KPI Skeleton Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-card border border-border rounded-xl p-5" />
          ))}
        </div>

        {/* Detailed Sections Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 bg-card border border-border rounded-xl p-5" />
          <div className="h-64 bg-card border border-border rounded-xl p-5" />
        </div>
      </div>
    )
  }

  // 2. Error State
  if (isError) {
    return (
      <div className="w-full max-w-7xl mx-auto p-6">
        <div
          role="alert"
          className="p-6 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-200">
                Không thể tải dữ liệu phân tích
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                {(error as Error)?.message || 'Đã xảy ra lỗi kết nối với máy chủ backend.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors flex-shrink-0"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Thử lại</span>
          </button>
        </div>
      </div>
    )
  }

  const rawData = res?.data
  const sessions = rawData?.sessions ?? {
    total: 0,
    by_status: {},
    by_workflow_state: {},
    by_domain: {},
  }
  const content = rawData?.content ?? {
    total_problem_frames: 0,
    total_research_notes: 0,
    notes_by_type: {},
    total_candidate_solutions: 0,
    solutions_by_status: {},
  }
  const knowledgeBase = rawData?.knowledge_base ?? {
    total_documents: 0,
    golden_documents: 0,
    total_chunks: 0,
  }
  const triz = rawData?.triz ?? {
    total_contradictions: 0,
    by_contradiction_type: {},
  }

  const isEmptyDashboard =
    sessions.total === 0 &&
    content.total_candidate_solutions === 0 &&
    knowledgeBase.total_documents === 0 &&
    triz.total_contradictions === 0

  interface EmptyBreakdownConfig {
    emptyText: string
    emptyLink?: {
      href: string
      label: string
    }
  }

  const renderBreakdown = (
    map: Record<string, number>,
    colorClass: string = 'bg-primary/10 text-primary',
    emptyConfig?: EmptyBreakdownConfig
  ) => {
    const entries = Object.entries(map || {}).filter(([_, count]) => count > 0)
    if (entries.length === 0) {
      if (emptyConfig) {
        return (
          <div className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs text-muted-foreground border border-dashed border-border/60 rounded-lg px-3 bg-muted/20">
            <span>{emptyConfig.emptyText}</span>
            {emptyConfig.emptyLink && (
              <Link
                href={emptyConfig.emptyLink.href}
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                <span>{emptyConfig.emptyLink.label}</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </div>
        )
      }
      return (
        <div className="text-sm text-muted-foreground italic py-2">
          Chưa có dữ liệu
        </div>
      )
    }
    return (
      <div className="flex flex-wrap gap-2 pt-1">
        {entries.map(([key, count]) => (
          <span
            key={key}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-border/50',
              colorClass
            )}
          >
            <span>{key}</span>
            <span className="font-semibold ml-0.5 bg-background/80 px-1.5 py-0.5 rounded-full text-[11px]">
              {count}
            </span>
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-8">
      {/* Contextual Navigation Bar & Header */}
      <div className="space-y-4 border-b border-border pb-5">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-medium">
          <Link
            href="/sessions"
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Quay lại Sessions</span>
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href="/knowledge"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Cơ sở Tri thức
            </Link>
            <Link
              href="/search"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Tìm kiếm
            </Link>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Activity className="w-6 h-6 text-primary" />
              <span>Tổng quan Nghiên cứu & Tri thức</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Tổng hợp chỉ số toàn diện qua các phiên nghiên cứu, nội dung sáng tạo, kho tài liệu và phân tích TRIZ.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {res?.generated_at && (
              <span
                suppressHydrationWarning
                className="text-xs text-muted-foreground hidden sm:inline"
              >
                Cập nhật: {new Date(res.generated_at).toLocaleTimeString('vi-VN')}
              </span>
            )}
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-sm font-medium rounded-lg border border-border shadow-sm transition-all"
            >
              <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
              <span>Làm mới</span>
            </button>
          </div>
        </div>
      </div>

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Sessions */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-sm font-medium">Research Sessions</span>
            <Brain className="w-5 h-5 text-indigo-500" />
          </div>
          <div
            data-testid="stat-total-sessions"
            className="text-3xl font-bold text-foreground"
          >
            {sessions.total}
          </div>
          <p className="text-xs text-muted-foreground">
            Tổng số phiên nghiên cứu đang lưu trữ
          </p>
          <div className="pt-2 border-t border-border/40">
            <Link
              href="/sessions"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <span>Xem danh sách</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Card 2: Candidate Solutions */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-sm font-medium">Ý tưởng & Giải pháp</span>
            <Lightbulb className="w-5 h-5 text-amber-500" />
          </div>
          <div
            data-testid="stat-total-solutions"
            className="text-3xl font-bold text-foreground"
          >
            {content.total_candidate_solutions}
          </div>
          <p className="text-xs text-muted-foreground">
            {content.total_research_notes} ghi chú & {content.total_problem_frames} khung bài toán
          </p>
        </div>

        {/* Card 3: Documents */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-sm font-medium">Cơ sở Tri thức</span>
            <BookOpen className="w-5 h-5 text-emerald-500" />
          </div>
          <div
            data-testid="stat-total-documents"
            className="text-3xl font-bold text-foreground"
          >
            {knowledgeBase.total_documents}
          </div>
          <p className="text-xs text-muted-foreground">
            {knowledgeBase.golden_documents} tài liệu chuẩn tắc / {knowledgeBase.total_chunks} chunks
          </p>
          <div className="pt-2 border-t border-border/40">
            <Link
              href="/knowledge"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <span>Xem kho tài liệu</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Card 4: TRIZ Contradictions */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-sm font-medium">Mâu thuẫn TRIZ</span>
            <Sparkles className="w-5 h-5 text-purple-500" />
          </div>
          <div
            data-testid="stat-total-contradictions"
            className="text-3xl font-bold text-foreground"
          >
            {triz.total_contradictions}
          </div>
          <p className="text-xs text-muted-foreground">
            Thực thể mâu thuẫn được định hình
          </p>
        </div>
      </div>

      {/* Actionable Empty-State Guidance Panel */}
      {isEmptyDashboard && (
        <div className="bg-muted/30 border border-dashed border-border rounded-xl p-6 text-center space-y-4">
          <div className="max-w-xl mx-auto space-y-2">
            <h2 className="text-base font-semibold text-foreground">
              Chưa có dữ liệu nghiên cứu & tri thức
            </h2>
            <p className="text-sm text-muted-foreground">
              Hệ thống chưa ghi nhận phiên nghiên cứu hoặc tài liệu nào. Bắt đầu tạo phiên nghiên cứu đầu tiên hoặc nạp tài liệu vào cơ sở tri thức để kích hoạt các chỉ số phân tích.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/sessions"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-sm"
            >
              <span>Tạo Research Session đầu tiên</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/knowledge"
              className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground text-sm font-medium rounded-lg border border-border hover:bg-secondary/80 transition-colors"
            >
              <BookOpen className="w-4 h-4 text-emerald-500" />
              <span>Mở Cơ sở Tri thức</span>
            </Link>
          </div>
        </div>
      )}

      {/* Detailed Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: Sessions Breakdown */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-indigo-500" />
              <h2 className="text-lg font-semibold text-foreground">
                Phân tích Sessions
              </h2>
            </div>
            <Link
              href="/sessions"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <span>Xem toàn bộ phiên</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Trạng thái (Status)
              </h3>
              {renderBreakdown(
                sessions.by_status,
                'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
                {
                  emptyText: 'Chưa có phân loại phiên để hiển thị.',
                  emptyLink: { href: '/sessions', label: 'Mở Sessions' },
                }
              )}
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Giai đoạn (Workflow State)
              </h3>
              {renderBreakdown(
                sessions.by_workflow_state,
                'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',
                {
                  emptyText: 'Chưa có phân loại phiên để hiển thị.',
                  emptyLink: { href: '/sessions', label: 'Mở Sessions' },
                }
              )}
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Lĩnh vực (Domain)
              </h3>
              {renderBreakdown(
                sessions.by_domain,
                'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
                {
                  emptyText: 'Chưa có phân loại phiên để hiển thị.',
                  emptyLink: { href: '/sessions', label: 'Mở Sessions' },
                }
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Content & Ideation Activity */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-semibold text-foreground">
                Nội dung & Giải pháp
              </h2>
            </div>
            <Link
              href="/sessions"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <span>Xem các giải pháp</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Phân loại Ghi chú (Research Notes)
              </h3>
              {renderBreakdown(
                content.notes_by_type,
                'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
                {
                  emptyText: 'Chưa có phân loại ghi chú để phân tích.',
                  emptyLink: { href: '/sessions', label: 'Xem Sessions' },
                }
              )}
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Trạng thái Giải pháp (Solutions)
              </h3>
              {renderBreakdown(
                content.solutions_by_status,
                'bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300',
                {
                  emptyText: 'Chưa có trạng thái giải pháp để phân tích.',
                  emptyLink: { href: '/sessions', label: 'Xem Sessions' },
                }
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Knowledge Base & TRIZ Insights */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-6 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              <h2 className="text-lg font-semibold text-foreground">
                Tri thức & Mâu thuẫn TRIZ
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/knowledge"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <span>Kho tri thức</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
              <Link
                href="/search"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <span>Tra cứu Semantic</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Phân loại Mâu thuẫn (Contradiction Types)
              </h3>
              {renderBreakdown(
                triz.by_contradiction_type,
                'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300',
                {
                  emptyText: 'Chưa có loại mâu thuẫn để phân tích.',
                  emptyLink: { href: '/search', label: 'Tra cứu Semantic' },
                }
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tài liệu Chuẩn tắc (Golden Documents)
              </h3>
              <div className="flex items-center gap-4 text-sm text-foreground pt-1">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <strong>{knowledgeBase.golden_documents}</strong> chuẩn tắc
                </span>
                <span className="text-muted-foreground">/</span>
                <span>
                  <strong>{knowledgeBase.total_documents}</strong> tổng tài liệu
                </span>
                <span className="text-muted-foreground">/</span>
                <span>
                  <strong>{knowledgeBase.total_chunks}</strong> chunks
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
