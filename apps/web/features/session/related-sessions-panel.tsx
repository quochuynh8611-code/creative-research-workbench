'use client'

import React from 'react'
import Link from 'next/link'
import {
  Compass,
  Sparkles,
  Brain,
  Loader2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Tag,
  CheckCircle2,
  Layers,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { findRelatedSessions } from '@/lib/api-client'
import { DOMAIN_LABELS, STATUS_LABELS, formatDate, cn } from '@/lib/utils'
import type { MatchedSessionItem } from '@/lib/types'

interface RelatedSessionsPanelProps {
  sessionId: string
  isActiveTab?: boolean
  className?: string
}

export function RelatedSessionsPanel({
  sessionId,
  isActiveTab = true,
  className,
}: RelatedSessionsPanelProps) {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['cross-session-discovery', sessionId, 5, 0.1],
    queryFn: () => findRelatedSessions(sessionId, 5, 0.1),
    enabled: Boolean(sessionId && sessionId.trim() && isActiveTab),
    staleTime: 60_000,
  })

  const matchedSessions: MatchedSessionItem[] = data?.matched_sessions || []
  const hasProblemFrame = data?.has_problem_frame ?? true
  const reason = data?.reason

  return (
    <div className={cn('space-y-4 pt-4 border-t border-border', className)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Compass className="w-4 h-4" />
            </span>
            <h3 className="text-base font-bold text-foreground">
              Phiên nghiên cứu liên quan (Cross-Session Knowledge Discovery)
            </h3>
            {matchedSessions.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
                {matchedSessions.length} phiên tương đồng
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tự động tìm kiếm các phiên nghiên cứu trước có cùng mâu thuẫn TRIZ, thông số kỹ thuật hoặc lĩnh vực.
          </p>
        </div>

        {hasProblemFrame && !isLoading && (
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground rounded-lg border border-border bg-background hover:bg-accent transition-colors self-start sm:self-auto disabled:opacity-50"
            title="Làm mới danh sách phiên liên quan"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
            <span>Làm mới</span>
          </button>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="p-8 text-center space-y-2 rounded-xl border border-border bg-card/30">
          <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
          <p className="text-xs font-medium text-muted-foreground">
            Đang quét và so khớp các phiên nghiên cứu tương đồng...
          </p>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 flex items-center justify-between gap-3 text-xs text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              Không thể truy xuất các phiên liên quan: {(error as any)?.message || 'Lỗi kết nối máy chủ'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="px-2.5 py-1 rounded-md bg-destructive text-destructive-foreground font-semibold hover:opacity-90 shrink-0"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* No Problem Frame Notice */}
      {!isLoading && !isError && (!hasProblemFrame || reason === 'no_problem_frame') && (
        <div className="p-6 rounded-xl border border-dashed border-border bg-muted/20 text-center space-y-2">
          <Brain className="w-8 h-8 text-primary/60 mx-auto" />
          <h4 className="text-xs font-semibold text-foreground">
            Chưa có cấu trúc bài toán TRIZ
          </h4>
          <p className="text-[11px] text-muted-foreground max-w-md mx-auto">
            Hãy hoàn tất bước "Nhập vấn đề" để hệ thống tự động nhận diện và so khớp với các phiên nghiên cứu trước đó.
          </p>
        </div>
      )}

      {/* Empty Matched List State */}
      {!isLoading && !isError && hasProblemFrame && reason !== 'no_problem_frame' && matchedSessions.length === 0 && (
        <div className="p-6 rounded-xl border border-dashed border-border bg-muted/10 text-center space-y-1.5">
          <Layers className="w-7 h-7 text-muted-foreground/60 mx-auto" />
          <h4 className="text-xs font-semibold text-foreground">
            Chưa tìm thấy phiên nghiên cứu nào có mâu thuẫn tương tự
          </h4>
          <p className="text-[11px] text-muted-foreground max-w-md mx-auto">
            Không có phiên nghiên cứu nào khác khớp với các thông số TRIZ hoặc lĩnh vực hiện tại
            {data?.total_candidates_analyzed !== undefined && data.total_candidates_analyzed > 0 && (
              <> (trong tổng số {data.total_candidates_analyzed} phiên đã phân tích)</>
            )}.
          </p>
        </div>
      )}

      {/* Matched Sessions Cards */}
      {!isLoading && !isError && matchedSessions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {matchedSessions.map((item) => {
            const scorePercent = Math.round(item.similarity_score * 100)
            const domainLabel = item.domain
              ? (DOMAIN_LABELS as Record<string, string>)[item.domain] || item.domain
              : null
            const statusLabel = (STATUS_LABELS as Record<string, string>)[item.status] || item.status

            return (
              <div
                key={item.session_id}
                className="p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all flex flex-col justify-between space-y-3"
              >
                {/* Card Top: Title & Badges */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/sessions/${item.session_id}`}
                      className="font-semibold text-xs sm:text-sm text-foreground hover:text-primary transition-colors line-clamp-2"
                    >
                      {item.title}
                    </Link>
                    <span
                      className={cn(
                        'shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold',
                        scorePercent >= 75
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : scorePercent >= 40
                          ? 'bg-primary/10 text-primary border border-primary/20'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {scorePercent}% tương đồng
                    </span>
                  </div>

                  {/* Metadata Row */}
                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                    {domainLabel && (
                      <span className="px-1.5 py-0.5 rounded bg-muted/60 font-medium">
                        {domainLabel}
                      </span>
                    )}
                    <span className="px-1.5 py-0.5 rounded bg-muted/60">
                      {statusLabel}
                    </span>
                    {item.created_at && (
                      <span>{formatDate(item.created_at)}</span>
                    )}
                  </div>
                </div>

                {/* Match Reasons */}
                {item.match_reasons && item.match_reasons.length > 0 && (
                  <div className="space-y-1 pt-1.5 border-t border-border/50">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Cơ sở tương đồng:
                    </div>
                    <ul className="space-y-0.5 text-[11px] text-foreground/90">
                      {item.match_reasons.map((reasonText, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                          <span>{reasonText}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Card Action Link */}
                <div className="pt-2 flex justify-end">
                  <Link
                    href={`/sessions/${item.session_id}`}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                  >
                    <span>Xem phiên nghiên cứu</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
