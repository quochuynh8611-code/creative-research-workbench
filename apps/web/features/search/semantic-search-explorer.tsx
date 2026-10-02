'use client'

import React, { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Search,
  Sparkles,
  Filter,
  Loader2,
  AlertCircle,
  BookOpen,
  Star,
  FileText,
  Clock,
  RotateCcw,
  CheckCircle,
  SlidersHorizontal,
  Layers,
  ArrowLeft,
  Plus,
  Check,
  Bookmark,
  Copy,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { searchKnowledge, createResearchNote, listResearchNotes, getSession } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import type { SearchResultItem } from '@/lib/types'
import {
  parseSearchExplorerParams,
  buildSearchExplorerUrl,
  buildSearchPayload,
} from './search-utils'

const QUICK_SUGGESTIONS = [
  'mâu thuẫn kỹ thuật',
  '40 nguyên tắc sáng chế',
  'tối ưu độ bền và trọng lượng',
  'làm mát pin xe điện',
  'nguyên tắc phân nhỏ trong triz',
]

const TOPIC_OPTIONS = [
  { value: '', label: 'Tất cả chủ đề (All Topics)' },
  { value: 'contradiction', label: 'Mâu thuẫn (Contradiction)' },
  { value: 'function', label: 'Chức năng (Function)' },
  { value: 'evolution', label: 'Quy luật tiến hóa (Evolution)' },
  { value: 'business', label: 'Kinh doanh & Quản trị (Business)' },
  { value: 'case_study', label: 'Tình huống thực tế (Case Study)' },
  { value: 'learning', label: 'Học tập & Hướng dẫn (Learning)' },
]

const SOURCE_TYPE_OPTIONS = [
  { value: '', label: 'Tất cả nguồn (All Sources)' },
  { value: 'golden_kb', label: 'Golden Knowledge Base' },
  { value: 'standard_triz', label: 'Standard TRIZ Matrix' },
  { value: 'case_study', label: 'Case Study' },
  { value: 'research_paper', label: 'Research Paper' },
  { value: 'manual', label: 'Manual & Guidelines' },
]

export function SemanticSearchExplorer() {
  const searchParams = useSearchParams()
  const router = useRouter()

  // Parse initial state from URL parameters
  const initialState = parseSearchExplorerParams(searchParams)

  const [searchInput, setSearchInput] = useState(initialState.query)
  const [submittedQuery, setSubmittedQuery] = useState(initialState.query)
  const [selectedTopic, setSelectedTopic] = useState(initialState.topic || '')
  const [selectedSourceType, setSelectedSourceType] = useState(initialState.source_type || '')
  const [goldenOnly, setGoldenOnly] = useState(initialState.golden || false)
  const [selectedPhase, setSelectedPhase] = useState(initialState.phase || '')
  const [topK, setTopK] = useState(initialState.top_k || 10)
  const [sessionId, setSessionId] = useState(initialState.session_id || '')
  const [fromTab, setFromTab] = useState(initialState.from_tab || '')

  // Track attached chunks for this session
  const [attachedChunkIds, setAttachedChunkIds] = useState<Set<string>>(new Set())
  const [attachingChunkId, setAttachingChunkId] = useState<string | null>(null)
  const [copiedChunkId, setCopiedChunkId] = useState<string | null>(null)

  // Re-sync if URL params change externally
  useEffect(() => {
    const nextState = parseSearchExplorerParams(searchParams)
    if (nextState.query !== submittedQuery) {
      setSearchInput(nextState.query)
      setSubmittedQuery(nextState.query)
    }
    if (nextState.topic !== selectedTopic) {
      setSelectedTopic(nextState.topic || '')
    }
    if (nextState.source_type !== selectedSourceType) {
      setSelectedSourceType(nextState.source_type || '')
    }
    if (nextState.golden !== goldenOnly) {
      setGoldenOnly(nextState.golden || false)
    }
    if (nextState.phase !== selectedPhase) {
      setSelectedPhase(nextState.phase || '')
    }
    if (nextState.top_k !== topK) {
      setTopK(nextState.top_k || 10)
    }
    if (nextState.session_id !== sessionId) {
      setSessionId(nextState.session_id || '')
    }
    if (nextState.from_tab !== fromTab) {
      setFromTab(nextState.from_tab || '')
    }
  }, [searchParams])

  // Build active filters payload
  const activeFilters: Record<string, any> = {}
  if (selectedTopic) activeFilters.topic = selectedTopic
  if (selectedSourceType) activeFilters.source_type = selectedSourceType
  if (goldenOnly) activeFilters.golden = true
  if (selectedPhase) activeFilters.phase = selectedPhase

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['semantic-explorer-search', submittedQuery, activeFilters, topK],
    queryFn: () =>
      searchKnowledge(
        buildSearchPayload({
          query: submittedQuery,
          top_k: topK,
          topic: selectedTopic,
          source_type: selectedSourceType,
          golden: goldenOnly,
          phase: selectedPhase,
        })
      ),
    enabled: Boolean(submittedQuery.trim()),
    staleTime: 30_000,
  })

  // Pre-hydrate existing notes if in Contextual Mode (session_id present)
  const { data: existingNotesResponse } = useQuery({
    queryKey: ['sessions', sessionId, 'notes'],
    queryFn: () => listResearchNotes(sessionId),
    enabled: Boolean(sessionId),
  })

  // Load session metadata if in Contextual Mode
  const { data: sessionData } = useQuery({
    queryKey: ['sessions', sessionId],
    queryFn: () => getSession(sessionId),
    enabled: Boolean(sessionId),
  })

  useEffect(() => {
    const rawNotes = (existingNotesResponse as any)?.data || (Array.isArray(existingNotesResponse) ? existingNotesResponse : [])
    if (rawNotes && rawNotes.length > 0) {
      const chunkIdsFromNotes = rawNotes
        .map((n: any) => n.source_chunk_id)
        .filter((id: any): id is string => Boolean(id))

      if (chunkIdsFromNotes.length > 0) {
        setAttachedChunkIds((prev) => {
          const next = new Set(prev)
          chunkIdsFromNotes.forEach((id: string) => next.add(id))
          return next
        })
      }
    }
  }, [existingNotesResponse])

  const syncUrl = (newState: {
    query: string
    topic?: string
    source_type?: string
    golden?: boolean
    phase?: string
    top_k?: number
    session_id?: string
    from_tab?: string
  }) => {
    const url = buildSearchExplorerUrl({
      ...newState,
      session_id: sessionId || newState.session_id,
      from_tab: fromTab || newState.from_tab,
    })
    router.replace(url)
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchInput.trim()) {
      setSubmittedQuery(searchInput.trim())
      syncUrl({
        query: searchInput.trim(),
        topic: selectedTopic,
        source_type: selectedSourceType,
        golden: goldenOnly,
        phase: selectedPhase,
        top_k: topK,
        session_id: sessionId,
        from_tab: fromTab,
      })
    }
  }

  const handleSelectSuggestion = (suggestion: string) => {
    setSearchInput(suggestion)
    setSubmittedQuery(suggestion)
    syncUrl({
      query: suggestion,
      topic: selectedTopic,
      source_type: selectedSourceType,
      golden: goldenOnly,
      phase: selectedPhase,
      top_k: topK,
      session_id: sessionId,
      from_tab: fromTab,
    })
  }

  const handleResetFilters = () => {
    setSelectedTopic('')
    setSelectedSourceType('')
    setGoldenOnly(false)
    setSelectedPhase('')
    setTopK(10)
    // Synchronize URL to clear stale parameters but preserve query, session_id and from_tab
    const targetUrl = buildSearchExplorerUrl({
      query: submittedQuery,
      session_id: sessionId || undefined,
      from_tab: fromTab || undefined,
    })
    router.replace(targetUrl)
  }

  const handleAttachToSession = async (item: SearchResultItem) => {
    if (!sessionId || !item.chunk_id || attachedChunkIds.has(item.chunk_id) || attachingChunkId) return
    try {
      setAttachingChunkId(item.chunk_id)
      const scorePercent = Math.round(item.score * 100)
      const content = `[${item.source_ref}] (Độ liên quan: ${scorePercent}%)\n${item.excerpt}`
      await createResearchNote(sessionId, {
        content,
        note_type: 'insight',
        source_chunk_id: item.chunk_id,
      })
      setAttachedChunkIds((prev) => new Set([...prev, item.chunk_id]))
    } catch (err) {
      console.error('Lỗi khi đính kèm vào session:', err)
    } finally {
      setAttachingChunkId(null)
    }
  }

  const handleCopyCitation = (item: SearchResultItem) => {
    const citationText = `[${item.source_ref}]\n"${item.excerpt}"`
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(citationText)
      setCopiedChunkId(item.chunk_id)
      setTimeout(() => setCopiedChunkId(null), 2000)
    }
  }

  const results: SearchResultItem[] = data?.results || []
  const hasSearched = Boolean(submittedQuery.trim())

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="space-y-4 border-b border-border pb-6">
        {sessionId && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-primary/5 border border-primary/20 text-xs">
            <div className="flex items-center gap-2.5">
              <Bookmark className="w-4 h-4 text-primary shrink-0" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">
                    {sessionData?.title || 'Phiên nghiên cứu'}
                  </span>
                  {sessionData?.domain && (
                    <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-semibold">
                      {sessionData.domain}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Đã lưu <strong className="text-foreground">{attachedChunkIds.size}</strong> bằng chứng vào sổ tay
                </p>
              </div>
            </div>
            <Link
              href={`/sessions/${sessionId}${fromTab ? `?tab=${fromTab}` : ''}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-background border border-border text-foreground hover:bg-muted transition-colors font-medium shadow-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Quay lại Session</span>
            </Link>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-primary/10 text-primary">
              <Search className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Semantic Knowledge Base Explorer
            </h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-3xl">
            Công cụ tìm kiếm ngữ nghĩa toàn diện trên kho tri thức chuẩn hóa (10 Golden Documents & Case Studies). Kết hợp Full-text Search và pgvector Cosine Distance qua thuật toán RRF.
          </p>
        </div>
      </div>

      {/* Main Grid: Sidebar Filters + Search & Results */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar: Filter Controls */}
        <aside className="lg:col-span-1 space-y-5 bg-card border border-border rounded-2xl p-5 h-fit shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground">
              <Filter className="w-3.5 h-3.5 text-primary" />
              <span>Bộ lọc nâng cao</span>
            </div>
            {(selectedTopic || selectedSourceType || goldenOnly || selectedPhase) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                title="Đặt lại bộ lọc"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Đặt lại</span>
              </button>
            )}
          </div>

          {/* Golden Documents Toggle */}
          <div className="space-y-2">
            <label className="flex items-center gap-2.5 text-xs font-medium text-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={goldenOnly}
                onChange={(e) => setGoldenOnly(e.target.checked)}
                className="w-4 h-4 rounded border-input text-primary focus:ring-primary accent-primary cursor-pointer"
              />
              <span className="flex items-center gap-1.5">
                <Star className={cn('w-3.5 h-3.5', goldenOnly ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground')} />
                <span>Chỉ tài liệu chuẩn vàng (Golden Only)</span>
              </span>
            </label>
          </div>

          {/* Topic Filter */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Chủ đề (Topic)
            </label>
            <select
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              className="w-full text-xs rounded-xl border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {TOPIC_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Source Type Filter */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Loại nguồn (Source Type)
            </label>
            <select
              value={selectedSourceType}
              onChange={(e) => setSelectedSourceType(e.target.value)}
              className="w-full text-xs rounded-xl border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {SOURCE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Phase Filter */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Giai đoạn nghiên cứu (Phase)
            </label>
            <select
              value={selectedPhase}
              onChange={(e) => setSelectedPhase(e.target.value)}
              className="w-full text-xs rounded-xl border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Tất cả giai đoạn (All Phases)</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((phaseNum) => (
                <option key={phaseNum} value={String(phaseNum)}>
                  Phase {phaseNum}
                </option>
              ))}
            </select>
          </div>

          {/* Top K Limit */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Số lượng kết quả tối đa
            </label>
            <div className="flex gap-2">
              {[5, 10, 20].map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTopK(k)}
                  className={cn(
                    'flex-1 py-1 text-xs font-semibold rounded-lg border transition-all',
                    topK === k
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border bg-background text-muted-foreground hover:text-foreground'
                  )}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Right Content: Search Input + Results List */}
        <main className="lg:col-span-3 space-y-6">
          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="flex gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Nhập câu hỏi hoặc từ khóa nghiên cứu (ví dụ: mâu thuẫn tốc độ và độ bền)..."
                className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-xl border border-input bg-card/80 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !searchInput.trim()}
              className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs sm:text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang tìm...</span>
                </>
              ) : (
                <span>Tìm kiếm</span>
              )}
            </button>
          </form>

          {/* Initial Blank State with Quick Suggestions */}
          {!hasSearched && !isLoading && (
            <div className="p-8 rounded-2xl border border-border bg-card/40 text-center space-y-5 shadow-sm">
              <div className="p-3 rounded-2xl bg-primary/10 text-primary w-fit mx-auto">
                <Sparkles className="w-7 h-7" />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="text-base font-bold text-foreground">
                  Bắt đầu khám phá kho tri thức
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Nhập câu hỏi bằng tiếng Việt tự nhiên hoặc chọn các từ khóa gợi ý bên dưới để tra cứu các tài liệu nguyên lý TRIZ và tình huống mẫu.
                </p>
              </div>

              <div className="pt-2 space-y-2.5 max-w-lg mx-auto">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Gợi ý truy vấn phổ biến
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {QUICK_SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => handleSelectSuggestion(suggestion)}
                      className="px-3 py-1.5 rounded-xl border border-border bg-background text-xs text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all text-left"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Loading Skeletons */}
          {isLoading && (
            <div className="space-y-3.5">
              <div className="h-5 w-48 bg-muted/60 rounded-md animate-pulse" />
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-5 rounded-2xl border border-border bg-card/60 space-y-3 animate-pulse">
                  <div className="h-4 w-3/4 bg-muted rounded" />
                  <div className="h-3 w-full bg-muted/70 rounded" />
                  <div className="h-3 w-5/6 bg-muted/50 rounded" />
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {isError && (
            <div className="p-5 rounded-2xl border border-destructive/30 bg-destructive/10 flex items-center justify-between gap-3 text-xs text-destructive">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>
                  Lỗi khi tìm kiếm tri thức: {(error as any)?.message || 'Không thể kết nối máy chủ'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => refetch()}
                className="px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground font-semibold hover:opacity-90 shrink-0"
              >
                Thử lại
              </button>
            </div>
          )}

          {/* Empty Results State */}
          {!isLoading && !isError && hasSearched && results.length === 0 && (
            <div className="p-10 rounded-2xl border border-dashed border-border bg-muted/10 text-center space-y-2">
              <Layers className="w-8 h-8 text-muted-foreground/60 mx-auto" />
              <h3 className="text-sm font-bold text-foreground">
                Không tìm thấy đoạn tri thức nào phù hợp
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Hãy thử nới lỏng các bộ lọc (chủ đề, loại nguồn) hoặc nhập từ khóa ngắn gọn hơn.
              </p>
            </div>
          )}

          {/* Success Results List */}
          {!isLoading && !isError && hasSearched && results.length > 0 && (
            <div className="space-y-4">
              {/* Summary Bar */}
              <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                <span>
                  <strong>{results.length}</strong> kết quả tìm thấy
                </span>
                {data?.latency_ms !== undefined && (
                  <span className="flex items-center gap-1 text-[11px]">
                    <Clock className="w-3 h-3" />
                    <span>{data.latency_ms} ms</span>
                  </span>
                )}
              </div>

              {/* Cards List */}
              <div className="space-y-3.5">
                {results.map((item) => {
                  const scorePercent = Math.round(item.score * 100)
                  const meta = item.metadata || {}

                  return (
                    <article
                      key={item.chunk_id}
                      className="p-5 rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all space-y-3"
                    >
                      {/* Top Row: Source Ref & Badges */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-primary" />
                            <span>{item.source_ref}</span>
                          </span>

                          {meta.golden && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                              <span>Golden</span>
                            </span>
                          )}

                          {meta.topic && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-muted text-muted-foreground">
                              {meta.topic}
                            </span>
                          )}

                          {meta.source_type && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-muted/60 text-muted-foreground">
                              {meta.source_type}
                            </span>
                          )}
                        </div>

                        {/* RRF Score Pill */}
                        <span className="shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                          Score: {item.score.toFixed(4)}
                        </span>
                      </div>

                      {/* Excerpt Snippet */}
                      <p className="text-xs text-foreground/90 leading-relaxed bg-muted/20 p-3 rounded-xl border border-border/40 font-mono text-[11.5px]">
                        {item.excerpt}
                      </p>

                      {/* Card Actions Bar */}
                      <div className="pt-1 flex items-center justify-between gap-2 border-t border-border/40">
                        <button
                          type="button"
                          onClick={() => handleCopyCitation(item)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors border border-transparent hover:border-border cursor-pointer"
                          title="Sao chép trích dẫn Markdown"
                        >
                          {copiedChunkId === item.chunk_id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                              <span className="text-emerald-600 dark:text-emerald-400 text-xs font-semibold">Đã chép</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Trích dẫn</span>
                            </>
                          )}
                        </button>

                        {/* Contextual Mode Action: Attach to Session */}
                        {sessionId && (
                          <div>
                            {attachedChunkIds.has(item.chunk_id) ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold border border-emerald-500/20 shadow-xs">
                                <Check className="w-3.5 h-3.5" />
                                <span>Đã đính kèm</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAttachToSession(item)}
                                disabled={attachingChunkId === item.chunk_id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 shadow-xs"
                              >
                                {attachingChunkId === item.chunk_id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Plus className="w-3.5 h-3.5" />
                                )}
                                <span>Đính kèm vào Session</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
