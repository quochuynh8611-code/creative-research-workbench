'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Grid3X3,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Lightbulb,
  Info,
  Bookmark,
} from 'lucide-react'
import { getTrizParameters, lookupTrizMatrix } from '@/lib/api-client'
import type { TrizPrinciple, TrizLookupResponse, NoteDraft } from '@/lib/types'
import { cn } from '@/lib/utils'

interface TrizMatrixLookupProps {
  onSelectPrinciple?: (principle: TrizPrinciple) => void
  onSaveAsNote?: (draft: NoteDraft) => void
  className?: string
}

export function TrizMatrixLookup({
  onSelectPrinciple,
  onSaveAsNote,
  className,
}: TrizMatrixLookupProps) {
  const [improvingId, setImprovingId] = useState<number | ''>('')
  const [worseningId, setWorseningId] = useState<number | ''>('')
  const [activeLookupQuery, setActiveLookupQuery] = useState<{
    improving: number
    worsening: number
  } | null>(null)

  // 1. Tải danh mục 39 thông số kỹ thuật TRIZ
  const {
    data: paramsData,
    isLoading: isLoadingParams,
    isError: isErrorParams,
  } = useQuery({
    queryKey: ['triz', 'parameters'],
    queryFn: () => getTrizParameters(),
    staleTime: 1000 * 60 * 30, // Dữ liệu chuẩn 39 thông số tĩnh trong 30 phút
  })

  // 2. Tra cứu ma trận mâu thuẫn Altshuller 39x39
  const {
    data: lookupResult,
    isLoading: isLoadingLookup,
    isError: isErrorLookup,
    error: lookupError,
  } = useQuery<TrizLookupResponse>({
    queryKey: ['triz', 'lookup', activeLookupQuery?.improving, activeLookupQuery?.worsening],
    queryFn: () =>
      lookupTrizMatrix({
        improving: activeLookupQuery!.improving,
        worsening: activeLookupQuery!.worsening,
      }),
    enabled: !!activeLookupQuery,
  })

  const parameters = paramsData?.data || []

  const handleLookup = () => {
    if (improvingId !== '' && worseningId !== '') {
      setActiveLookupQuery({
        improving: Number(improvingId),
        worsening: Number(worseningId),
      })
    }
  }

  return (
    <div className={cn('p-6 rounded-2xl border border-border bg-card/60 backdrop-blur-sm shadow-sm space-y-6', className)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
            <Grid3X3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">
              Tra cứu Ma trận Mâu thuẫn TRIZ (Altshuller Matrix 39×39)
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Chọn thông số kỹ thuật cần cải thiện và thông số bị suy giảm để nhận nguyên tắc sáng tạo phù hợp.
            </p>
          </div>
        </div>
      </div>

      {/* Selectors Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Improving Selector */}
        <div className="space-y-2">
          <label
            htmlFor="improving-param-select"
            className="text-xs font-semibold text-foreground flex items-center gap-1.5"
          >
            <ArrowUpRight className="w-4 h-4 text-emerald-500" />
            <span>Thông số cần cải thiện (Improving Parameter)</span>
          </label>
          <select
            id="improving-param-select"
            aria-label="Thông số cần cải thiện"
            value={improvingId}
            onChange={(e) => setImprovingId(e.target.value ? Number(e.target.value) : '')}
            disabled={isLoadingParams}
            className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 transition-colors"
          >
            <option value="">-- Chọn thông số cần nâng cao --</option>
            {parameters.map((param) => (
              <option key={`imp-${param.id}`} value={param.id}>
                {`#${param.id}. ${param.name_vi} (${param.name_en})`}
              </option>
            ))}
          </select>
        </div>

        {/* Worsening Selector */}
        <div className="space-y-2">
          <label
            htmlFor="worsening-param-select"
            className="text-xs font-semibold text-foreground flex items-center gap-1.5"
          >
            <ArrowDownRight className="w-4 h-4 text-rose-500" />
            <span>Thông số bị suy giảm (Worsening Parameter)</span>
          </label>
          <select
            id="worsening-param-select"
            aria-label="Thông số bị suy giảm"
            value={worseningId}
            onChange={(e) => setWorseningId(e.target.value ? Number(e.target.value) : '')}
            disabled={isLoadingParams}
            className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 transition-colors"
          >
            <option value="">-- Chọn thông số bị ảnh hưởng tiêu cực --</option>
            {parameters.map((param) => (
              <option key={`wors-${param.id}`} value={param.id}>
                {`#${param.id}. ${param.name_vi} (${param.name_en})`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Action Button */}
      <div className="flex items-center justify-between pt-1">
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <Info className="w-3.5 h-3.5" />
          <span>Dữ liệu 1,521 tọa độ Altshuller 1985 tất định</span>
        </div>
        <button
          type="button"
          onClick={handleLookup}
          disabled={improvingId === '' || worseningId === '' || isLoadingLookup}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {isLoadingLookup ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Đang tra cứu...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Tra cứu ma trận TRIZ</span>
            </>
          )}
        </button>
      </div>

      {/* Results Section */}
      {isErrorLookup && (
        <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 text-destructive text-sm flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Không thể tra cứu ma trận mâu thuẫn</p>
            <p className="text-xs mt-0.5 opacity-90">
              {(lookupError as any)?.message || 'Vui lòng kiểm tra lại kết nối mạng hoặc thử lại.'}
            </p>
          </div>
        </div>
      )}

      {lookupResult && (
        <div className="space-y-4 pt-2">
          {/* Physical Contradiction Banner (Diagonal) */}
          {lookupResult.is_diagonal ? (
            <div className="p-5 rounded-xl border border-purple-500/20 bg-purple-500/5 space-y-2">
              <div className="flex items-center gap-2 text-purple-600 font-bold text-sm">
                <AlertTriangle className="w-4 h-4 text-purple-500" />
                <span>Mâu thuẫn vật lý (Physical Contradiction)</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {`Hai yêu cầu trái ngược trên cùng một thông số (#${lookupResult.improving_parameter.id}. ${lookupResult.improving_parameter.name_vi}). Đối với mâu thuẫn vật lý, hãy áp dụng các nguyên tắc phân tách: Phân tách trong không gian, phân tách trong thời gian, phân tách theo điều kiện, hoặc phân tách giữa hệ thống và các phần tử con.`}
              </p>
            </div>
          ) : (
            /* Technical Contradiction Results */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-amber-500" />
                  <span>Nguyên tắc sáng tạo gợi ý ({lookupResult.principles_count})</span>
                </h4>
                <span className="text-[11px] text-muted-foreground">
                  Tọa độ ({lookupResult.improving_parameter.id}, {lookupResult.worsening_parameter.id})
                </span>
              </div>

              {lookupResult.principles.length === 0 ? (
                <div className="p-6 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
                  Không có nguyên tắc kỹ thuật cụ thể cho tọa độ này trong bảng Altshuller 1985 chuẩn.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {lookupResult.principles.map((principle) => {
                    const pid = principle.principle_id || principle.id
                    return (
                      <div
                        key={`principle-${pid}`}
                        className="p-4 rounded-xl border border-border bg-card/80 space-y-2.5 flex flex-col justify-between hover:border-amber-500/40 transition-all shadow-sm"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/15 text-amber-600 border border-amber-500/25">
                              #{pid}
                            </span>
                            <span className="text-[11px] text-muted-foreground font-medium truncate max-w-[150px]">
                              {principle.name_en}
                            </span>
                          </div>
                          <h5 className="text-sm font-bold text-foreground">
                            {principle.name_vi}
                          </h5>
                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                            {principle.description}
                          </p>
                          {principle.explanation && (
                            <div className="p-2 rounded bg-muted/40 text-[11px] text-muted-foreground italic border-l-2 border-amber-500/40">
                              {principle.explanation}
                            </div>
                          )}
                        </div>

                        <div className="pt-2 border-t border-border/50 flex flex-wrap items-center justify-end gap-2">
                          {onSaveAsNote && (
                            <button
                              type="button"
                              onClick={() =>
                                onSaveAsNote({
                                  content: `[Ma trận TRIZ - Nguyên tắc #${pid}: ${principle.name_vi} (${principle.name_en})]\n${principle.description}${principle.explanation ? `\n\nGiải thích: ${principle.explanation}` : ''}`,
                                  note_type: 'hypothesis',
                                })
                              }
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/20 transition-all cursor-pointer"
                            >
                              <Bookmark className="w-3.5 h-3.5" />
                              <span>Lưu vào sổ tay</span>
                            </button>
                          )}
                          {onSelectPrinciple && (
                            <button
                              type="button"
                              onClick={() => onSelectPrinciple(principle)}
                              className="text-[11px] text-primary font-medium hover:underline flex items-center gap-1"
                            >
                              <Lightbulb className="w-3 h-3" />
                              <span>Đưa vào ý tưởng nghiên cứu</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
