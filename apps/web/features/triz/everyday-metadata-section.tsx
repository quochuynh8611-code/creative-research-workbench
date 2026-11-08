'use client'

import React, { useState, useId } from 'react'
import { ChevronDown, Sparkles, HelpCircle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface EverydayMetadataSectionProps {
  everydayTitle?: string | null
  dailyApplication?: string | null
  dailyExamples?: string[] | null
  actionPrompt?: string | null
  technicalTitle: string
  technicalDescription: string
  explanation?: string | null
  className?: string
  principleId: number | string
}

export function EverydayMetadataSection({
  everydayTitle,
  dailyApplication,
  dailyExamples,
  actionPrompt,
  technicalTitle,
  technicalDescription,
  explanation,
  className,
  principleId,
}: EverydayMetadataSectionProps) {
  const generatedId = useId()
  const contentId = `everyday-content-${principleId}-${generatedId.replace(/:/g, '')}`

  const hasEverydayData = Boolean(
    everydayTitle || dailyApplication || (dailyExamples && dailyExamples.length > 0) || actionPrompt
  )

  // Mặc định mở rộng nếu có dữ liệu đời sống
  const [isExpanded, setIsExpanded] = useState<boolean>(true)

  return (
    <div className={cn('space-y-3', className)}>
      {/* Title area */}
      <div className="space-y-1">
        {everydayTitle ? (
          <div>
            <h4 className="text-base font-bold text-foreground tracking-tight">
              {everydayTitle}
            </h4>
            <p className="text-xs text-muted-foreground font-medium flex items-center gap-1 mt-0.5">
              <span>Thuật ngữ gốc:</span>
              <span className="font-semibold text-foreground/80">{technicalTitle}</span>
            </p>
          </div>
        ) : (
          <h4 className="text-base font-bold text-foreground tracking-tight">
            {technicalTitle}
          </h4>
        )}

        <p className="text-xs text-muted-foreground leading-relaxed">
          {technicalDescription}
        </p>

        {explanation && (
          <div className="p-2 rounded bg-muted/40 text-[11px] text-muted-foreground italic border-l-2 border-amber-500/40 mt-1.5">
            {explanation}
          </div>
        )}
      </div>

      {/* Everyday Details Accordion (Read-Only) */}
      {hasEverydayData && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 overflow-hidden transition-all">
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-expanded={isExpanded}
            aria-controls={contentId}
            aria-label={`Chi tiết đời sống và câu hỏi gợi mở nguyên tắc #${principleId}`}
            className="w-full px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center justify-between hover:bg-amber-500/10 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Chi tiết đời sống & Câu hỏi gợi mở</span>
            </span>
            <ChevronDown
              className={cn('w-3.5 h-3.5 transition-transform duration-200', isExpanded && 'rotate-180')}
            />
          </button>

          {isExpanded && (
            <div
              id={contentId}
              className="px-3 pb-3 pt-1 space-y-2.5 text-xs text-foreground/90 border-t border-amber-500/15"
            >
              {dailyApplication && (
                <div className="space-y-0.5">
                  <span className="font-semibold text-amber-700 dark:text-amber-400 text-[11px] uppercase tracking-wide">
                    Cách áp dụng trong đời sống:
                  </span>
                  <p className="leading-relaxed text-muted-foreground">{dailyApplication}</p>
                </div>
              )}

              {dailyExamples && dailyExamples.length > 0 && (
                <div className="space-y-1">
                  <span className="font-semibold text-amber-700 dark:text-amber-400 text-[11px] uppercase tracking-wide">
                    Ví dụ minh họa:
                  </span>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground pl-1">
                    {dailyExamples.map((ex, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {ex}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {actionPrompt && (
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 flex items-start gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p className="font-medium text-[11px] leading-relaxed">
                    <span className="font-bold">Câu hỏi gợi mở: </span>
                    {actionPrompt}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
