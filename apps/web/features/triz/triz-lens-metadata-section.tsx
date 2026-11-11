'use client'

import React, { useState, useId } from 'react'
import { ChevronDown, Sparkles, HelpCircle, Briefcase } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TrizPrinciple } from '@/lib/types'

export type TrizLensType = 'engineering' | 'business' | 'everyday'

export interface TrizLensMetadataSectionProps {
  lens: TrizLensType
  principle: TrizPrinciple
  principleId?: number | string
  className?: string
}

export function TrizLensMetadataSection({
  lens,
  principle,
  principleId: explicitPrincipleId,
  className,
}: TrizLensMetadataSectionProps) {
  const generatedId = useId()
  const principleId = explicitPrincipleId ?? (principle.principle_id || principle.id || 0)
  const contentId = `triz-lens-content-${principleId}-${generatedId.replace(/:/g, '')}`

  const isBusiness = lens === 'business'
  const isEveryday = lens === 'everyday'
  const isEngineering = lens === 'engineering'

  // Metadata mapping theo lăng kính
  const technicalTitle = principle.name_vi
  const technicalDescription = principle.description
  const explanation = principle.explanation

  let lensTitle: string | undefined
  let application: string | undefined
  let examples: string[] | undefined
  let actionPrompt: string | undefined

  if (isBusiness) {
    lensTitle = principle.business_title || 'Đang cập nhật diễn giải kinh doanh...'
    application = principle.business_application || undefined
    examples =
      principle.business_examples && principle.business_examples.length > 0
        ? principle.business_examples
        : undefined
    actionPrompt = principle.business_action_prompt || undefined
  } else if (isEveryday) {
    lensTitle = principle.everyday_title || undefined
    application = principle.daily_application || undefined
    examples =
      principle.daily_examples && principle.daily_examples.length > 0
        ? principle.daily_examples
        : undefined
    actionPrompt = principle.action_prompt || undefined
  }

  // Khối accordion chỉ hiển thị khi ở lăng kính Business hoặc Everyday và có ít nhất 1 chi tiết
  const hasAccordionData =
    !isEngineering && Boolean(application || (examples && examples.length > 0) || actionPrompt)

  const [isExpanded, setIsExpanded] = useState<boolean>(true)

  // Nhãn ngữ cảnh tương ứng với lăng kính được chọn
  const accordionButtonTitle = isBusiness
    ? 'Diễn giải & Ứng dụng kinh doanh'
    : 'Chi tiết đời sống & Câu hỏi gợi mở'

  const accordionAriaLabel = isBusiness
    ? `Diễn giải & ứng dụng kinh doanh nguyên tắc #${principleId}`
    : `Chi tiết đời sống và câu hỏi gợi mở nguyên tắc #${principleId}`

  const applicationHeading = isBusiness
    ? 'Ứng dụng trong kinh doanh:'
    : 'Cách áp dụng trong đời sống:'

  const examplesHeading = isBusiness
    ? 'Ví dụ thực tế / Case study:'
    : 'Ví dụ minh họa:'

  const actionPromptHeading = isBusiness
    ? 'Câu hỏi gợi mở chiến lược: '
    : 'Câu hỏi gợi mở: '

  return (
    <div className={cn('space-y-3', className)}>
      {/* Title area */}
      <div className="space-y-1">
        {lensTitle ? (
          <div>
            <h4 className="text-base font-bold text-foreground tracking-tight">
              {lensTitle}
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

      {/* Details Accordion (Read-Only) */}
      {hasAccordionData && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 overflow-hidden transition-all">
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-expanded={isExpanded}
            aria-controls={contentId}
            aria-label={accordionAriaLabel}
            className="w-full px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center justify-between hover:bg-amber-500/10 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              {isBusiness ? (
                <Briefcase className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              )}
              <span>{accordionButtonTitle}</span>
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
              {application && (
                <div className="space-y-0.5">
                  <span className="font-semibold text-amber-700 dark:text-amber-400 text-[11px] uppercase tracking-wide">
                    {applicationHeading}
                  </span>
                  <p className="leading-relaxed text-muted-foreground">{application}</p>
                </div>
              )}

              {examples && examples.length > 0 && (
                <div className="space-y-1">
                  <span className="font-semibold text-amber-700 dark:text-amber-400 text-[11px] uppercase tracking-wide">
                    {examplesHeading}
                  </span>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground pl-1">
                    {examples.map((ex, idx) => (
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
                    <span className="font-bold">{actionPromptHeading}</span>
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
