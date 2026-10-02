'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  X,
  Loader2,
  AlertCircle,
  Bookmark,
  Sparkles,
  CornerDownLeft,
  Command,
  ArrowUpRight,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { searchKnowledge } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import type { SearchResultItem } from '@/lib/types'
import { buildSearchExplorerUrl } from './search-utils'

interface SearchOverlayProps {
  defaultOpen?: boolean
  isOpen?: boolean
  onClose?: () => void
  onSelectResult?: (item: SearchResultItem) => void
}

const QUICK_SUGGESTIONS = [
  'mâu thuẫn kỹ thuật',
  'mâu thuẫn vật lý',
  '40 nguyên tắc sáng chế',
  'kiến trúc hybrid search',
  'quy trình nghiên cứu TRIZ',
]

export function SearchOverlay({
  defaultOpen = false,
  isOpen: controlledIsOpen,
  onClose,
  onSelectResult,
}: SearchOverlayProps) {
  const router = useRouter()
  const [internalIsOpen, setInternalIsOpen] = useState(defaultOpen)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const isVisible = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen

  // Keyboard shortcut listener (Cmd+K / Ctrl+K and Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setInternalIsOpen((prev) => !prev)
      } else if (e.key === 'Escape') {
        if (isVisible) {
          e.preventDefault()
          handleClose()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isVisible])

  // Focus input when opened
  useEffect(() => {
    if (isVisible) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
    } else {
      setSearchTerm('')
      setDebouncedQuery('')
    }
  }, [isVisible])

  // Debounce input value 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchTerm.trim())
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Query search knowledge
  const {
    data,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['global-search', debouncedQuery],
    queryFn: () => searchKnowledge({ query: debouncedQuery, top_k: 5 }),
    enabled: !!debouncedQuery && isVisible,
  })

  const handleClose = () => {
    setInternalIsOpen(false)
    if (onClose) {
      onClose()
    }
  }

  const handleSelect = (item: SearchResultItem) => {
    if (onSelectResult) {
      onSelectResult(item)
    }
    handleClose()
  }

  const handleOpenInExplorer = () => {
    const queryToUse = searchTerm.trim() || debouncedQuery
    if (queryToUse) {
      const url = buildSearchExplorerUrl({ query: queryToUse })
      router.push(url)
      handleClose()
    }
  }

  if (!isVisible) {
    return null
  }

  const results = data?.results || []
  const hasQuery = Boolean(searchTerm.trim() || debouncedQuery)

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-background/80 backdrop-blur-md transition-all animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose()
        }
      }}
    >
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border bg-background/50">
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm trong kho tri thức (Nhập câu hỏi, từ khóa, nguyên tắc TRIZ)..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="px-2 py-1 rounded-md bg-muted text-muted-foreground text-[11px] font-mono hover:bg-muted/80"
          >
            ESC
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* CTA Banner to Open in Search Explorer when query is present */}
          {hasQuery && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs">
              <span className="text-muted-foreground">
                Muốn khám phá chi tiết với các bộ lọc sâu và toàn bộ kết quả?
              </span>
              <button
                type="button"
                onClick={handleOpenInExplorer}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all shadow-sm shrink-0 cursor-pointer"
              >
                <span>Mở trong Search Explorer</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Suggestions when query is empty */}
          {!debouncedQuery && !isLoading && (
            <div className="space-y-3 py-2">
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span>Gợi ý tìm kiếm phổ biến</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {QUICK_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setSearchTerm(suggestion)}
                    className="px-3 py-1.5 rounded-xl bg-accent text-accent-foreground text-xs font-medium hover:bg-accent/80 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="py-12 text-center space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
              <p className="text-xs text-muted-foreground">Đang tìm kiếm trong kho tài liệu...</p>
            </div>
          )}

          {/* Error State */}
          {isError && (
            <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 text-destructive text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong>Không thể thực hiện tìm kiếm:</strong> {(error as any)?.message || 'Lỗi không xác định.'}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !isError && debouncedQuery && results.length === 0 && (
            <div className="py-12 text-center space-y-2 text-muted-foreground">
              <Search className="w-8 h-8 mx-auto opacity-40" />
              <p className="text-sm font-semibold text-foreground">Không tìm thấy tài liệu nào</p>
              <p className="text-xs max-w-sm mx-auto">
                Không tìm thấy kết quả phù hợp với &ldquo;{debouncedQuery}&rdquo;. Hãy thử dùng từ khóa ngắn gọn hơn.
              </p>
            </div>
          )}

          {/* Results List */}
          {!isLoading && !isError && results.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-1">
                <span>Kết quả tìm kiếm ({results.length})</span>
                <span className="text-[10px] font-normal normal-case text-muted-foreground">Nhấp để xem tài liệu</span>
              </div>
              {results.map((item, idx) => {
                const scorePercent = Math.round((item.score || 0) * 100)
                const topic = item.metadata?.topic

                return (
                  <button
                    key={item.chunk_id || `res-${idx}`}
                    type="button"
                    onClick={() => handleSelect(item)}
                    className="w-full text-left p-3.5 rounded-xl border border-border bg-card/60 hover:bg-accent/30 hover:border-primary/40 transition-all space-y-2 group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Bookmark className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="text-xs font-mono font-semibold text-foreground group-hover:text-primary transition-colors">
                          {item.source_ref}
                        </span>
                        {topic && (
                          <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px]">
                            {topic}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        {scorePercent}%
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed italic border-l-2 border-primary/30 pl-2.5">
                      &ldquo;{item.excerpt}&rdquo;
                    </p>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2.5 border-t border-border bg-muted/30 flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <span>Dùng</span>
            <kbd className="px-1.5 py-0.5 rounded bg-background border border-border font-mono text-[10px]">⌘K</kbd>
            <span>hoặc</span>
            <kbd className="px-1.5 py-0.5 rounded bg-background border border-border font-mono text-[10px]">Ctrl+K</kbd>
            <span>để mở nhanh</span>
          </div>
          <div className="flex items-center gap-1">
            <span>Chọn kết quả để điều hướng</span>
            <CornerDownLeft className="w-3 h-3" />
          </div>
        </div>
      </div>
    </div>
  )
}
