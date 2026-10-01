'use client'

import React, { useState } from 'react'
import { FolderSearch, Search, Loader2, AlertCircle, ExternalLink, Bookmark, Sparkles } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { searchKnowledge } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import type { SearchResultItem, NoteDraft } from '@/lib/types'

interface EvidencePanelProps {
  sessionId: string
  initialQuery?: string
  domain?: string
  onSaveAsNote?: (draft: NoteDraft) => void
  className?: string
}

export function EvidencePanel({
  sessionId,
  initialQuery = '',
  domain,
  onSaveAsNote,
  className,
}: EvidencePanelProps) {
  const [searchInput, setSearchInput] = useState(initialQuery)
  const [activeQuery, setActiveQuery] = useState(initialQuery)

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['evidence-search', sessionId, activeQuery],
    queryFn: () => searchKnowledge({ query: activeQuery || 'TRIZ mâu thuẫn giải pháp', top_k: 5 }),
    enabled: true,
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchInput.trim()) {
      setActiveQuery(searchInput.trim())
    }
  }

  const results: SearchResultItem[] = data?.results || []

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <FolderSearch className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Bằng chứng & Tài liệu trích dẫn (Evidence Panel)
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Truy xuất tự động từ kho 10 Golden Documents & Case Studies theo thuật toán Hybrid Search.
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm kiếm tài liệu & bằng chứng..."
              className="pl-9 pr-3 py-1.5 text-xs rounded-xl border border-input bg-background/80 focus:outline-none focus:ring-2 focus:ring-primary w-64"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            Tìm
          </button>
        </form>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="p-12 text-center space-y-3 rounded-2xl border border-border bg-card/20">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-xs font-medium text-muted-foreground">
            Đang truy xuất bằng chứng từ Knowledge Base...
          </p>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="p-6 rounded-2xl border border-destructive/20 bg-destructive/5 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">
              Không thể truy xuất bằng chứng
            </h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              {(error as any)?.message || 'Đã có lỗi xảy ra trong quá trình tìm kiếm tài liệu.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && results.length === 0 && (
        <div className="p-12 text-center space-y-3 rounded-2xl border border-dashed border-border bg-card/20">
          <FolderSearch className="w-10 h-10 mx-auto text-muted-foreground opacity-50" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">
              Không tìm thấy tài liệu phù hợp
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Hãy thử tìm kiếm với các từ khóa khác về mâu thuẫn, nguyên tắc hoặc linh vực nghiên cứu.
            </p>
          </div>
        </div>
      )}

      {/* Results list */}
      {!isLoading && !isError && results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>Tìm thấy {results.length} đoạn trích tài liệu liên quan</span>
            {data?.latency_ms !== undefined && (
              <span>Thời gian phản hồi: {data.latency_ms}ms</span>
            )}
          </div>

          <div className="space-y-3">
            {results.map((item, idx) => {
              const scorePercent = Math.round((item.score || 0) * 100)
              const topic = item.metadata?.topic

              return (
                <div
                  key={item.chunk_id || `chunk-${idx}`}
                  className="p-5 rounded-2xl border border-border bg-card/60 backdrop-blur-sm space-y-3 hover:border-primary/40 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Bookmark className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-xs font-mono font-semibold text-foreground">
                        {item.source_ref}
                      </span>
                      {topic && (
                        <span className="px-2 py-0.5 rounded-md bg-accent text-accent-foreground text-[11px] font-medium">
                          {topic}
                        </span>
                      )}
                    </div>

                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-full text-xs font-bold shrink-0',
                        scorePercent >= 80
                          ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                          : scorePercent >= 60
                          ? 'bg-blue-500/15 text-blue-600 border border-blue-500/30'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {scorePercent}%
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed italic border-l-2 border-primary/40 pl-3">
                    &ldquo;{item.excerpt}&rdquo;
                  </p>

                  {onSaveAsNote && (
                    <div className="pt-2 border-t border-border/50 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          onSaveAsNote({
                            content: `[Trích dẫn từ ${item.source_ref}]\n"${item.excerpt}"`,
                            note_type: 'insight',
                            source_chunk_id: item.chunk_id || null,
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all cursor-pointer"
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                        <span>Lưu vào sổ tay</span>
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
