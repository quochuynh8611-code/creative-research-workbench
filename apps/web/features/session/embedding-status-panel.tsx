'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Database, Cpu, CheckCircle2, Sparkles, Loader2 } from 'lucide-react'
import { getEmbeddingStatus } from '@/lib/api-client'
import { cn } from '@/lib/utils'

export interface EmbeddingStatusPanelProps {
  totalDocuments?: number
  embeddedDocuments?: number
  totalChunks?: number
  embeddedChunks?: number
  modelUsed?: string
  provider?: string
  isLoading?: boolean
  className?: string
  onRefresh?: () => void
}

export function EmbeddingStatusPanel({
  totalDocuments,
  embeddedDocuments,
  totalChunks,
  embeddedChunks,
  modelUsed,
  provider,
  isLoading: propLoading,
  className,
}: EmbeddingStatusPanelProps) {
  const shouldFetch = totalDocuments === undefined

  const {
    data: fetchedStatus,
    isLoading: isFetching,
  } = useQuery({
    queryKey: ['documents', 'embedding-status'],
    queryFn: () => getEmbeddingStatus(),
    enabled: shouldFetch,
    staleTime: 1000 * 30, // 30s
  })

  const isLoading = propLoading || (shouldFetch && isFetching)

  const finalTotalDocs = totalDocuments ?? fetchedStatus?.total_documents ?? 0
  const finalEmbeddedDocs = embeddedDocuments ?? fetchedStatus?.embedded_documents ?? 0
  const finalTotalChunks = totalChunks ?? fetchedStatus?.total_chunks ?? 0
  const finalEmbeddedChunks = embeddedChunks ?? fetchedStatus?.embedded_chunks ?? 0
  const finalProvider = provider ?? fetchedStatus?.provider ?? 'mock'
  const finalModel = modelUsed ?? fetchedStatus?.model ?? finalProvider

  const progressPercent = finalTotalDocs > 0 ? Math.round((finalEmbeddedDocs / finalTotalDocs) * 100) : 100
  const progressText = `${finalEmbeddedDocs}/${finalTotalDocs} documents embedded`

  return (
    <div
      data-testid="embedding-status-panel"
      className={cn(
        'p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm space-y-3 shadow-sm',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground">
              Knowledge Base & Embedding Engine
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Tiến độ vector hóa kho tri thức nghiên cứu
            </p>
          </div>
        </div>

        <div
          data-testid="embedding-model-badge"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20"
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>Model: <span className="uppercase">{finalModel}</span></span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span>Đang đồng bộ trạng thái vector...</span>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-foreground flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>{progressText}</span>
            </span>
            <span className="text-muted-foreground text-[11px]">
              {progressPercent}% hoàn tất
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
            <span>
              Tổng số chunks: <strong>{finalEmbeddedChunks}</strong> / {finalTotalChunks}
            </span>
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Provider: <strong className="text-foreground capitalize">{finalProvider}</strong></span>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
