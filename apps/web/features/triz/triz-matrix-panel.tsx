'use client'

import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Grid3X3,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Lightbulb,
  AlertTriangle,
  Loader2,
  Bookmark,
} from 'lucide-react'
import { getTrizParameters, lookupTrizMatrix } from '@/lib/api-client'
import type { TrizLookupResponse, TrizPrinciple, NoteDraft } from '@/lib/types'
import { resolveParamId } from '@/lib/triz-param-resolver'
import { cn } from '@/lib/utils'

export interface TrizMatrixPanelProps {
  improvingParameter?: string | number | null
  worseningParameter?: string | number | null
  onSelectPrinciple?: (principle: any) => void
  onSaveAsNote?: (draft: NoteDraft) => void
  className?: string
}

export function TrizMatrixPanel({
  improvingParameter,
  worseningParameter,
  onSelectPrinciple,
  onSaveAsNote,
  className,
}: TrizMatrixPanelProps) {
  // 1. Tải danh mục 39 thông số kỹ thuật TRIZ
  const { data: paramsData, isLoading: isLoadingParams } = useQuery({
    queryKey: ['triz', 'parameters'],
    queryFn: () => getTrizParameters(),
    staleTime: 1000 * 60 * 30,
  })

  const parameters = paramsData?.data || []

  // 2. Phân giải ID thông số
  const { impId, worsId, impParam, worsParam } = useMemo(() => {
    if (!parameters || parameters.length === 0) {
      return { impId: null, worsId: null, impParam: null, worsParam: null }
    }
    const resolvedImp = improvingParameter ? resolveParamId(improvingParameter, parameters) : null
    const resolvedWors = worseningParameter ? resolveParamId(worseningParameter, parameters) : null

    const foundImp = parameters.find((p) => p.id === resolvedImp)
    const foundWors = parameters.find((p) => p.id === resolvedWors)

    return {
      impId: resolvedImp,
      worsId: resolvedWors,
      impParam: foundImp,
      worsParam: foundWors,
    }
  }, [improvingParameter, worseningParameter, parameters])

  // 3. Tra cứu ma trận mâu thuẫn 39x39
  const {
    data: lookupResult,
    isLoading: isLoadingLookup,
    isError: isErrorLookup,
  } = useQuery<TrizLookupResponse>({
    queryKey: ['triz', 'matrix-panel-lookup', impId, worsId],
    queryFn: () => lookupTrizMatrix({ improving: impId!, worsening: worsId! }),
    enabled: !!(impId && worsId),
  })

  const impLabel =
    impParam?.name_vi || (typeof improvingParameter === 'string' ? improvingParameter : `Thông số #${improvingParameter}`)
  const worsLabel =
    worsParam?.name_vi || (typeof worseningParameter === 'string' ? worseningParameter : `Thông số #${worseningParameter}`)

  return (
    <div
      data-testid="triz-matrix-panel"
      className={cn(
        'p-6 rounded-2xl border border-border bg-card/60 backdrop-blur-sm shadow-sm space-y-6',
        className
      )}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
            <Grid3X3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">
              Ma trận Mâu thuẫn Kỹ thuật TRIZ (Contradiction Matrix 39×39)
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Đối chiếu thông số nâng cao và thông số bị suy giảm để trích xuất các nguyên tắc sáng chế tối ưu.
            </p>
          </div>
        </div>

        {impId && worsId && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20 w-fit">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Tọa độ Altshuller: ({impId}, {worsId})</span>
          </div>
        )}
      </div>

      {/* Parameter Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Improving */}
        <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600">
            <ArrowUpRight className="w-4 h-4 text-emerald-500" />
            <span>Thông số cần cải thiện (Improving Parameter)</span>
          </div>
          <div className="text-sm font-bold text-foreground">
            {impParam ? `#${impParam.id}. ${impParam.name_vi}` : impLabel}
          </div>
          {impParam?.name_en && (
            <div className="text-xs text-muted-foreground italic">
              {impParam.name_en}
            </div>
          )}
        </div>

        {/* Worsening */}
        <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-rose-600">
            <ArrowDownRight className="w-4 h-4 text-rose-500" />
            <span>Thông số bị suy giảm (Worsening Parameter)</span>
          </div>
          <div className="text-sm font-bold text-foreground">
            {worsParam ? `#${worsParam.id}. ${worsParam.name_vi}` : worsLabel}
          </div>
          {worsParam?.name_en && (
            <div className="text-xs text-muted-foreground italic">
              {worsParam.name_en}
            </div>
          )}
        </div>
      </div>

      {/* Loading & Status */}
      {isLoadingLookup && (
        <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
          <span>Đang đối chiếu tọa độ ma trận mâu thuẫn Altshuller...</span>
        </div>
      )}

      {isErrorLookup && (
        <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 text-destructive text-sm flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Không thể tra cứu ma trận mâu thuẫn</p>
            <p className="text-xs mt-0.5 opacity-90">Vui lòng kiểm tra lại kết nối mạng hoặc thử lại.</p>
          </div>
        </div>
      )}

      {/* Lookup Result Principles */}
      {lookupResult && (
        <div className="space-y-4 pt-2">
          {lookupResult.is_diagonal ? (
            <div className="p-5 rounded-xl border border-purple-500/20 bg-purple-500/5 space-y-2">
              <div className="flex items-center gap-2 text-purple-600 font-bold text-sm">
                <AlertTriangle className="w-4 h-4 text-purple-500" />
                <span>Mâu thuẫn vật lý (Physical Contradiction)</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {`Hai yêu cầu trái ngược trên cùng một thông số (#${lookupResult.improving_parameter?.id || impId}). Hãy áp dụng 4 nguyên tắc phân tách: không gian, thời gian, điều kiện hoặc hệ thống.`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-amber-500" />
                  <span>Nguyên tắc sáng tạo được kích hoạt ({lookupResult.principles?.length || 0})</span>
                </h4>
                <span className="text-[11px] text-muted-foreground">
                  Highlight từ Altshuller 1985 Matrix
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {lookupResult.principles.map((principle) => {
                  const pid = principle.principle_id || principle.id
                  return (
                    <div
                      key={`matrix-principle-${pid}`}
                      className="p-4 rounded-xl border border-amber-500/30 bg-card/90 space-y-2.5 flex flex-col justify-between hover:border-amber-500/60 shadow-sm transition-all"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span
                            data-testid="highlighted-principle"
                            className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-500 text-white shadow-sm flex items-center gap-1"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>#{pid}</span>
                          </span>
                          <span className="text-xs text-muted-foreground font-medium truncate max-w-[160px]">
                            {principle.name_en}
                          </span>
                        </div>

                        <div>
                          <h5 className="text-sm font-bold text-foreground">
                            {principle.name_vi}
                          </h5>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            {principle.description}
                          </p>
                        </div>

                        {principle.explanation && (
                          <div className="text-[11px] p-2 rounded-lg bg-muted/60 text-foreground border border-border/40">
                            <strong>Gợi ý: </strong>
                            <span>{principle.explanation}</span>
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-border/50 flex flex-wrap items-center justify-end gap-2">
                        {onSaveAsNote && (
                          <button
                            type="button"
                            onClick={() =>
                              onSaveAsNote({
                                content: `[Ma trận TRIZ - Nguyên tắc #${pid}: ${principle.name_vi} (${principle.name_en})]\n${principle.description}`,
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
                            className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                            aria-label={`Áp dụng nguyên tắc #${pid}`}
                          >
                            <Lightbulb className="w-3.5 h-3.5" />
                            <span>Áp dụng thành giải pháp</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
