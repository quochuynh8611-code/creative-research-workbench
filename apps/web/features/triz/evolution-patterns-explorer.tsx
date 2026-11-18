'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  TrendingUp,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  Bookmark,
  Layers,
  ArrowRight,
  Lightbulb,
} from 'lucide-react'
import { getTrizEvolutionTrends } from '@/lib/api-client'
import { validateTrizEvolutionContext } from '@/lib/triz-evolution-context-validator'
import type { TrizEvolutionResponse, NoteDraft } from '@/lib/types'

interface EvolutionPatternsExplorerProps {
  onSaveAsNote?: (draft: NoteDraft) => void
}

export function EvolutionPatternsExplorer({ onSaveAsNote }: EvolutionPatternsExplorerProps) {
  const [expandedTrendId, setExpandedTrendId] = useState<string | null>(null)
  const [userNotes, setUserNotes] = useState<Record<string, string>>({})
  const [saveSuccessId, setSaveSuccessId] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<TrizEvolutionResponse>({
    queryKey: ['triz', 'evolution-trends'],
    queryFn: () => getTrizEvolutionTrends(),
    staleTime: 1000 * 60 * 60, // 1 hour cache
  })

  const trends = data?.data ?? []

  const toggleExpand = (trendId: string) => {
    setExpandedTrendId((prev) => (prev === trendId ? null : trendId))
    setValidationError(null)
  }

  const handleSaveNote = (trend: TrizEvolutionResponse['data'][0]) => {
    if (!onSaveAsNote) return

    const contextCandidate = {
      schema_version: 1,
      source_type: 'triz_evolution',
      trend_id: trend.trend_id,
      trend_name: trend.name_vi,
    }

    const validation = validateTrizEvolutionContext(contextCandidate)
    if (!validation.ok) {
      setValidationError(validation.error)
      return
    }
    setValidationError(null)

    const noteText = userNotes[trend.trend_id]?.trim() || ''
    const stagesText = trend.evolution_stages.length > 0
      ? `\n\nCác giai đoạn tiến hóa: ${trend.evolution_stages.join(' -> ')}`
      : ''
    const examplesText = Object.keys(trend.domain_examples || {}).length > 0
      ? `\n\nVí dụ thực tế:\n${Object.entries(trend.domain_examples)
          .map(([domain, ex]) => `- [${domain}]: ${ex}`)
          .join('\n')}`
      : ''

    const content = `[TRIZ Evolution: ${trend.name_vi} (${trend.trend_id})]\n${
      noteText ? `Ghi chú định hướng: ${noteText}\n` : ''
    }Mô tả: ${trend.description}${stagesText}${examplesText}`

    onSaveAsNote({
      content,
      note_type: 'insight',
      source_context: validation.data,
    })

    setSaveSuccessId(trend.trend_id)
    setTimeout(() => setSaveSuccessId(null), 2500)
  }

  if (isError) {
    return (
      <div
        data-testid="evolution-patterns-error"
        className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive flex items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>
            {error instanceof Error ? error.message : 'Lỗi tải quy luật tiến hóa TRIZ từ máy chủ.'}
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

  if (isLoading) {
    return (
      <div className="p-6 rounded-xl border border-border bg-card/60 animate-pulse space-y-4">
        <div className="h-6 w-1/3 bg-muted rounded"></div>
        <div className="h-20 w-full bg-muted/60 rounded"></div>
        <div className="h-20 w-full bg-muted/40 rounded"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/60 pb-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            8 Quy luật Tiến hóa Kỹ thuật (Altshuller)
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Dự đoán hướng phát triển tự nhiên của sản phẩm và công nghệ để đón đầu tương lai
          </p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary self-start sm:self-auto">
          {trends.length} quy luật kinh điển
        </span>
      </div>

      {/* Accordion List */}
      <div className="space-y-3">
        {trends.map((trend, idx) => {
          const isExpanded = expandedTrendId === trend.trend_id
          const isSaved = saveSuccessId === trend.trend_id

          return (
            <div
              key={trend.trend_id}
              className={`rounded-xl border transition-all ${
                isExpanded
                  ? 'border-primary/50 bg-card/90 shadow-xs ring-1 ring-primary/20'
                  : 'border-border bg-card/60 hover:border-primary/30'
              }`}
            >
              <button
                type="button"
                onClick={() => toggleExpand(trend.trend_id)}
                aria-expanded={isExpanded}
                className="w-full flex items-center justify-between p-4 text-left cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      {trend.name_vi}
                    </h3>
                    <p className="text-xs text-muted-foreground italic mt-0.5">
                      {trend.name_en}
                    </p>
                  </div>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground transition-transform duration-200 shrink-0 ml-2 ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isExpanded && (
                <div className="p-4 pt-0 border-t border-border/60 space-y-4 mt-1">
                  <p className="text-xs text-muted-foreground leading-relaxed pt-3">
                    {trend.description}
                  </p>

                  {/* Evolution Stages Timeline */}
                  {trend.evolution_stages.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-primary" />
                        Các giai đoạn tiến hóa tuần tự:
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {trend.evolution_stages.map((stage, sIdx) => (
                          <React.Fragment key={stage}>
                            <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-muted text-foreground border border-border/60">
                              {stage}
                            </span>
                            {sIdx < trend.evolution_stages.length - 1 && (
                              <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Domain Examples */}
                  {Object.keys(trend.domain_examples || {}).length > 0 && (
                    <div className="space-y-2 rounded-lg bg-muted/20 border border-border/60 p-3">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                        Ví dụ thực tế đa lĩnh vực:
                      </span>
                      <div className="space-y-1.5 text-xs text-muted-foreground">
                        {Object.entries(trend.domain_examples).map(([domain, example]) => (
                          <div key={domain} className="flex flex-col sm:flex-row sm:gap-2">
                            <span className="font-semibold text-foreground capitalize shrink-0 sm:w-28">
                              [{domain}]:
                            </span>
                            <span>{example}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* User Note Input */}
                  <div className="space-y-2 pt-2 border-t border-border/60">
                    <label
                      htmlFor={`trend-note-${trend.trend_id}`}
                      className="text-xs font-medium text-foreground block"
                    >
                      Ghi chú định hướng tiến hóa:
                    </label>
                    <textarea
                      id={`trend-note-${trend.trend_id}`}
                      value={userNotes[trend.trend_id] || ''}
                      onChange={(e) =>
                        setUserNotes((prev) => ({
                          ...prev,
                          [trend.trend_id]: e.target.value,
                        }))
                      }
                      placeholder="Ghi chú định hướng tiến hóa cho hệ thống..."
                      rows={2}
                      className="w-full text-xs rounded-lg border border-border bg-background p-2.5 focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                    />
                  </div>

                  {validationError && (
                    <p className="text-xs text-destructive">{validationError}</p>
                  )}

                  {/* Action Button */}
                  {onSaveAsNote && (
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => handleSaveNote(trend)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors cursor-pointer"
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                        {isSaved ? 'Đã lưu vào sổ tay!' : 'Lưu vào sổ tay'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
