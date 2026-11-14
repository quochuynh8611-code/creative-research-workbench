'use client'

import React, { useState } from 'react'
import { Lightbulb, CheckCircle2, ArrowRight, Sparkles, HelpCircle, Bookmark, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RecommendedMethod, NoteDraft } from '@/lib/types'
import { EverydayMetadataSection } from '@/features/triz/everyday-metadata-section'
import { validatePrincipleSuggestionContext } from '@/lib/principle-suggestion-context-validator'

interface PrincipleSuggestionsProps {
  methods?: RecommendedMethod[]
  onSelectPrinciple?: (method: RecommendedMethod) => void
  onSaveAsNote?: (draft: NoteDraft) => void
  className?: string
}

export function PrincipleSuggestions({
  methods = [],
  onSelectPrinciple,
  onSaveAsNote,
  className,
}: PrincipleSuggestionsProps) {
  const [saveError, setSaveError] = useState<string | null>(null)

  if (!methods || methods.length === 0) {
    return (
      <div className={cn('p-8 rounded-2xl border border-dashed border-border text-center space-y-4 bg-card/30', className)}>
        <Lightbulb className="w-12 h-12 mx-auto text-amber-500/50" />
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">
            Chưa có gợi ý nguyên tắc sáng chế
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Hãy hoàn thành bước <strong>Phân tích cấu trúc (Problem Structuring)</strong> để hệ thống nhận diện mâu thuẫn và đề xuất các nguyên tắc sáng tạo TRIZ tương ứng.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Nguyên tắc sáng tạo TRIZ được gợi ý
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Các nguyên tắc được đề xuất dựa trên ma trận giải quyết mâu thuẫn (Altshuller Contradiction Matrix).
          </p>
        </div>
        <div className="text-xs font-semibold px-3 py-1 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-full w-fit">
          {methods.length} nguyên tắc phù hợp
        </div>
      </div>

      {saveError && (
        <div
          role="alert"
          className="p-3 rounded-lg border border-destructive/20 bg-destructive/10 text-destructive text-xs flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {methods.map((method) => {
          const principleNum = method.principle_id || method.principle || method.id
          return (
            <div
              key={`${method.id}-${principleNum}`}
              className="p-5 rounded-2xl border border-border bg-card/60 backdrop-blur-sm space-y-3 hover:border-amber-500/40 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="px-2.5 py-0.5 bg-amber-500/15 text-amber-600 border border-amber-500/30 rounded-full text-xs font-bold shrink-0">
                    #{principleNum}
                  </span>
                </div>
                <EverydayMetadataSection
                  principleId={principleNum}
                  everydayTitle={method.everyday_title}
                  dailyApplication={method.daily_application}
                  dailyExamples={method.daily_examples}
                  actionPrompt={method.action_prompt}
                  technicalTitle={method.title}
                  technicalDescription={method.description}
                />
              </div>

              <div className="pt-2 border-t border-border/50 flex flex-wrap items-center justify-end gap-2">
                {onSaveAsNote && (
                  <button
                    type="button"
                    onClick={() => {
                      const contextCandidate = {
                        schema_version: 1,
                        source_type: 'principle_suggestion',
                        principle_id: method.principle_id,
                        method_id: method.method_id,
                      }

                      const validation = validatePrincipleSuggestionContext(contextCandidate)
                      if (!validation.ok) {
                        setSaveError(`Context không hợp lệ: ${validation.error}`)
                        return
                      }

                      setSaveError(null)
                      onSaveAsNote({
                        content: `[Nguyên tắc sáng tạo #${principleNum}: ${method.title}]\n${method.description}`,
                        note_type: 'hypothesis',
                        source_context: validation.data,
                      })
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/20 transition-all cursor-pointer"
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>Lưu vào sổ tay</span>
                  </button>
                )}
                {onSelectPrinciple && (
                  <button
                    type="button"
                    onClick={() => onSelectPrinciple(method)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                  >
                    <span>Áp dụng nguyên tắc</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
