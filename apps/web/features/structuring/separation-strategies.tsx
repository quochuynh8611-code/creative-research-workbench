'use client'

import React, { useState, useMemo } from 'react'
import { Split, Sparkles, Check, HelpCircle, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SeparationStrategy {
  id: string
  name_vi: string
  name_en: string
  diagnostic_question_vi: string
  principle_ids: number[]
}

export const SEPARATION_STRATEGIES: SeparationStrategy[] = [
  {
    id: 'space',
    name_vi: 'Phân tách trong không gian',
    name_en: 'Separation in Space',
    diagnostic_question_vi:
      'Vấn đề hoặc tính chất đối nghịch này có thể tách biệt tại các vị trí/vùng không gian khác nhau không?',
    principle_ids: [1, 2, 3, 4, 7, 13, 17, 24, 26, 30],
  },
  {
    id: 'time',
    name_vi: 'Phân tách trong thời gian',
    name_en: 'Separation in Time',
    diagnostic_question_vi:
      'Tính chất đối nghịch này có thể xuất hiện tại các thời điểm hoặc giai đoạn khác nhau không?',
    principle_ids: [9, 10, 11, 15, 16, 18, 19, 20, 21, 29, 34, 37],
  },
  {
    id: 'condition',
    name_vi: 'Phân tách theo điều kiện',
    name_en: 'Separation upon Condition',
    diagnostic_question_vi:
      'Hệ thống có thể chuyển đổi tính chất khi điều kiện môi trường hoặc trạng thái thay đổi không?',
    principle_ids: [28, 31, 32, 35, 36, 38, 39, 40],
  },
  {
    id: 'system_level',
    name_vi: 'Phân tách giữa hệ thống và các thành phần (mức hệ thống)',
    name_en: 'Separation between System and its Components',
    diagnostic_question_vi:
      'Tính chất này có thể thuộc về toàn bộ hệ thống trong khi các thành phần riêng lẻ có tính chất ngược lại không?',
    principle_ids: [1, 3, 5, 6, 7, 12, 25, 27, 33, 40],
  },
]

export const DEFAULT_PHYSICAL_FALLBACK_PRINCIPLES: number[] = [1, 2, 3, 4]

interface SeparationStrategiesProps {
  className?: string
  onPrinciplesChange?: (principleIds: number[]) => void
}

export function SeparationStrategies({
  className,
  onPrinciplesChange,
}: SeparationStrategiesProps) {
  const [selectedStrategyIds, setSelectedStrategyIds] = useState<string[]>([])

  const toggleStrategy = (id: string) => {
    setSelectedStrategyIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
      return next
    })
  }

  // Hợp nhất (Union) và khử trùng lặp principle IDs theo thứ tự
  const activePrinciples = useMemo(() => {
    if (selectedStrategyIds.length === 0) {
      return DEFAULT_PHYSICAL_FALLBACK_PRINCIPLES
    }
    const seen = new Set<number>()
    const result: number[] = []

    for (const stratId of selectedStrategyIds) {
      const strat = SEPARATION_STRATEGIES.find((s) => s.id === stratId)
      if (strat) {
        for (const pid of strat.principle_ids) {
          if (!seen.has(pid)) {
            seen.add(pid)
            result.push(pid)
          }
        }
      }
    }
    return result
  }, [selectedStrategyIds])

  return (
    <div
      className={cn(
        'p-6 rounded-xl border border-border bg-card/60 backdrop-blur-sm shadow-sm space-y-5',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Split className="w-5 h-5 text-purple-500" />
          <h3 className="text-base font-semibold text-foreground">
            Chiến lược phân tách cho mâu thuẫn vật lý (Separation Strategies)
          </h3>
        </div>
        <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-medium border border-purple-500/20">
          TRIZ Classical
        </span>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Đối với mâu thuẫn vật lý (hai yêu cầu trái ngược trên cùng một đối tượng), TRIZ đề xuất 4 chiến lược phân tách. Hãy chọn một hoặc nhiều chiến lược phù hợp với bối cảnh bài toán:
      </p>

      {/* Strategy Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {SEPARATION_STRATEGIES.map((strat) => {
          const isSelected = selectedStrategyIds.includes(strat.id)
          return (
            <button
              key={strat.id}
              type="button"
              onClick={() => toggleStrategy(strat.id)}
              aria-pressed={isSelected}
              className={cn(
                'text-left p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3',
                isSelected
                  ? 'border-purple-500 bg-purple-500/10 ring-1 ring-purple-500/30'
                  : 'border-border/60 bg-muted/20 hover:bg-muted/40 hover:border-border'
              )}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">
                    {strat.name_vi}
                  </span>
                  <div
                    className={cn(
                      'w-5 h-5 rounded-md flex items-center justify-center border text-xs transition-colors',
                      isSelected
                        ? 'bg-purple-600 border-purple-600 text-white'
                        : 'border-muted-foreground/30 text-transparent'
                    )}
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground font-normal leading-relaxed flex items-start gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0 mt-0.5" />
                  <span>{strat.diagnostic_question_vi}</span>
                </p>
              </div>

              <div className="text-[11px] text-muted-foreground font-medium pt-1 border-t border-border/40">
                Gợi ý {strat.principle_ids.length} nguyên tắc sáng tạo
              </div>
            </button>
          )
        })}
      </div>

      {/* Suggested Principles Section */}
      <div className="pt-2">
        {selectedStrategyIds.length > 0 ? (
          <div
            data-testid="separation-principles-list"
            className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-purple-700 dark:text-purple-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Nguyên tắc được gợi ý theo chiến lược đã chọn ({activePrinciples.length} nguyên tắc):
              </span>
              <button
                type="button"
                onClick={() => setSelectedStrategyIds([])}
                className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                Đặt lại
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {activePrinciples.map((pid) => (
                <span
                  key={pid}
                  data-testid={`principle-item-${pid}`}
                  data-principle-id={pid}
                  className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 shadow-xs"
                >
                  #{pid}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div
            data-testid="separation-fallback-principles"
            className="p-4 rounded-xl border border-border/60 bg-muted/30 space-y-2"
          >
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Layers className="w-3.5 h-3.5" />
              <span>Chưa chọn chiến lược cụ thể — Danh sách gợi ý cơ bản (Fallback mặc định):</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_PHYSICAL_FALLBACK_PRINCIPLES.map((pid) => (
                <span
                  key={pid}
                  className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground border border-border"
                >
                  #{pid}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
