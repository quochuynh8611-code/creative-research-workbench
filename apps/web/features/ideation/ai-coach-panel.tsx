'use client'

import React, { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Sparkles,
  Bot,
  Brain,
  HelpCircle,
  Lightbulb,
  AlertTriangle,
  ArrowRight,
  Bookmark,
  CheckCircle2,
  EyeOff,
  RefreshCw,
  Loader2,
  ShieldAlert,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ConfirmationModal } from '@/components/confirmation-modal'
import {
  getAICoachSuggestions,
  createCandidateSolution,
  createResearchNote,
} from '@/lib/api-client'
import type {
  ProblemFrame,
  CoachSuggestion,
  AICoachResult,
  NoteType,
} from '@/lib/types'

export interface AICoachPanelProps {
  sessionId: string
  problemFrame?: ProblemFrame | null
  className?: string
}

const CATEGORY_META: Record<
  string,
  { label: string; icon: React.ElementType; colorClass: string }
> = {
  possible_cause: {
    label: 'Nguyên nhân cốt lõi',
    icon: AlertTriangle,
    colorClass: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
  },
  contradiction_direction: {
    label: 'Hướng mâu thuẫn',
    icon: ArrowRight,
    colorClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
  },
  relevant_principle: {
    label: 'Nguyên tắc TRIZ',
    icon: Brain,
    colorClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  },
  clarifying_question: {
    label: 'Câu hỏi làm rõ',
    icon: HelpCircle,
    colorClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  },
  solution_candidate: {
    label: 'Giải pháp đề xuất',
    icon: Lightbulb,
    colorClass: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30',
  },
}

function isValidSuggestion(s: unknown): s is CoachSuggestion {
  if (!s || typeof s !== 'object') return false
  const item = s as Partial<CoachSuggestion>
  return Boolean(
    typeof item.id === 'string' &&
      item.id.trim() &&
      typeof item.category === 'string' &&
      item.category.trim() &&
      typeof item.title === 'string' &&
      item.title.trim() &&
      typeof item.description === 'string' &&
      item.description.trim() &&
      item.source_grounding &&
      typeof item.source_grounding === 'object' &&
      typeof item.source_grounding.source_type === 'string' &&
      item.source_grounding.source_type.trim() &&
      typeof item.source_grounding.source_reference === 'string' &&
      item.source_grounding.source_reference.trim()
  )
}

export function AICoachPanel({
  sessionId,
  problemFrame,
  className,
}: AICoachPanelProps) {
  const queryClient = useQueryClient()
  const [coachResult, setCoachResult] = useState<AICoachResult | null>(null)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    type: 'solution' | 'note'
    suggestion: CoachSuggestion | null
  }>({
    isOpen: false,
    type: 'solution',
    suggestion: null,
  })

  // Coach Analysis Mutation
  const coachMutation = useMutation({
    mutationFn: () => getAICoachSuggestions(sessionId),
    onSuccess: (response) => {
      setCoachResult(response.data)
      setDismissedIds(new Set())
      setActionSuccess(null)
    },
  })

  // Save Candidate Solution Mutation
  const saveSolutionMutation = useMutation({
    mutationFn: async (suggestion: CoachSuggestion) => {
      const payload = suggestion.actionable_payload
      const title = payload?.title?.trim() || suggestion.title
      const mechanism = payload?.mechanism?.trim() || suggestion.description
      return createCandidateSolution(sessionId, {
        title,
        mechanism,
        status: 'candidate',
      })
    },
    onSuccess: (_, suggestion) => {
      queryClient.invalidateQueries({ queryKey: ['sessions', sessionId, 'solutions'] })
      setActionSuccess(`Đã lưu "${suggestion.title}" thành Giải pháp thành công.`)
      setConfirmModal({ isOpen: false, type: 'solution', suggestion: null })
      setDismissedIds((prev) => new Set(prev).add(suggestion.id))
    },
  })

  // Save Research Note Mutation
  const saveNoteMutation = useMutation({
    mutationFn: async (suggestion: CoachSuggestion) => {
      const payload = suggestion.actionable_payload
      const content =
        payload?.content?.trim() ||
        `[${suggestion.title}]\n${suggestion.description}\n(Căn cứ: ${suggestion.source_grounding.source_reference})`
      const noteType: NoteType =
        (payload?.note_type as NoteType) ||
        (suggestion.category === 'clarifying_question'
          ? 'question'
          : suggestion.category === 'possible_cause'
          ? 'insight'
          : 'hypothesis')
      return createResearchNote(sessionId, {
        content,
        note_type: noteType,
      })
    },
    onSuccess: (_, suggestion) => {
      queryClient.invalidateQueries({ queryKey: ['sessions', sessionId, 'notes'] })
      setActionSuccess(`Đã lưu "${suggestion.title}" vào Sổ tay nghiên cứu.`)
      setConfirmModal({ isOpen: false, type: 'note', suggestion: null })
      setDismissedIds((prev) => new Set(prev).add(suggestion.id))
    },
  })

  const hasProblemFrame = Boolean(problemFrame && problemFrame.raw_statement?.trim())

  // Suggestions with contract validation & cap 5
  const rawSuggestions = coachResult?.suggestions || []
  const validSuggestions = rawSuggestions.filter(isValidSuggestion)
  const hasExceededCap = validSuggestions.length > 5
  const activeSuggestions = validSuggestions
    .slice(0, 5)
    .filter((s) => !dismissedIds.has(s.id))

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id))
  }

  const handleConfirmAction = () => {
    if (!confirmModal.suggestion) return
    if (confirmModal.type === 'solution') {
      saveSolutionMutation.mutate(confirmModal.suggestion)
    } else {
      saveNoteMutation.mutate(confirmModal.suggestion)
    }
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-border/80 bg-card/60 p-6 shadow-sm backdrop-blur-xs space-y-5',
        className
      )}
      data-testid="ai-coach-panel"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-foreground">AI Solution Coach</h3>
              {coachResult && (
                <span
                  className={cn(
                    'text-xs font-medium px-2 py-0.5 rounded-full border',
                    coachResult.provenance === 'ai_coach'
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                      : coachResult.provenance === 'rule_based_fallback'
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                      : 'bg-muted text-muted-foreground border-border'
                  )}
                >
                  {coachResult.provenance === 'ai_coach'
                    ? 'AI Coach'
                    : coachResult.provenance === 'rule_based_fallback'
                    ? 'Rule-based fallback'
                    : 'Mock Coach'}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Phân tích mâu thuẫn kỹ thuật và đề xuất hướng giải quyết dựa trên 40 nguyên tắc TRIZ
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => coachMutation.mutate()}
          disabled={!hasProblemFrame || coachMutation.isPending}
          className={cn(
            'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer',
            'bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {coachMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Đang phân tích...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Phân tích với AI Coach</span>
            </>
          )}
        </button>
      </div>

      {/* Success Notification */}
      {actionSuccess && (
        <div className="flex items-center gap-2 p-3 text-xs rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* State 1: Empty ProblemFrame Banner */}
      {!hasProblemFrame && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border border-border/60 text-sm text-muted-foreground">
          <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">
              Phiên nghiên cứu chưa có thông tin bài toán
            </p>
            <p className="text-xs mt-1 leading-relaxed">
              Vui lòng hoàn thành bước Nhập vấn đề hoặc Phân tích cấu trúc trước khi nhờ AI Coach
              phân tích.
            </p>
          </div>
        </div>
      )}

      {/* State 2: Analyzing (Loading Skeleton) */}
      {coachMutation.isPending && (
        <div className="p-8 text-center space-y-4 rounded-lg border border-dashed border-border/80 bg-muted/20 animate-pulse">
          <div className="flex justify-center">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              AI Coach đang rà soát mâu thuẫn, nguyên tắc TRIZ và bằng chứng...
            </p>
            <p className="text-xs text-muted-foreground">
              Quá trình tổng hợp góc nhìn sáng tạo thường diễn ra trong vài giây
            </p>
          </div>
        </div>
      )}

      {/* State 3: Error State */}
      {coachMutation.isError && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm space-y-2">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="w-4 h-4" />
            <span>Không thể lấy gợi ý từ AI Coach vào lúc này. Vui lòng thử lại sau.</span>
          </div>
          <button
            type="button"
            onClick={() => coachMutation.mutate()}
            className="text-xs font-semibold underline hover:no-underline cursor-pointer"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* State 4: Suggestions Ready */}
      {!coachMutation.isPending && coachResult && (
        <div className="space-y-4">
          {/* Summary Box */}
          {coachResult.summary && (
            <div className="p-3.5 rounded-lg bg-muted/40 border border-border/60 text-xs text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">Nhận định tổng quan: </span>
              {coachResult.summary}
            </div>
          )}

          {/* Cap notice */}
          {hasExceededCap && (
            <div className="text-xs text-muted-foreground italic px-1">
              * Đã hiển thị 5 gợi ý ưu tiên.
            </div>
          )}

          {/* Suggestions List */}
          <div className="space-y-3">
            {activeSuggestions.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground bg-muted/20 rounded-lg">
                Bạn đã xử lý hoặc bỏ qua tất cả các gợi ý trong lượt này. Bấm &quot;Phân tích với AI
                Coach&quot; để phân tích lại.
              </div>
            ) : (
              activeSuggestions.map((suggestion) => {
                const meta =
                  CATEGORY_META[suggestion.category] || {
                    label: suggestion.category,
                    icon: Lightbulb,
                    colorClass: 'bg-muted text-muted-foreground border-border',
                  }
                const CategoryIcon = meta.icon
                const isSolutionCandidate = suggestion.category === 'solution_candidate'

                return (
                  <div
                    key={suggestion.id}
                    className="p-4 rounded-xl border border-border/80 bg-background/50 hover:bg-background/80 transition-all space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border',
                          meta.colorClass
                        )}
                      >
                        <CategoryIcon className="w-3.5 h-3.5" />
                        {meta.label}
                      </span>

                      {/* Source Grounding */}
                      <span className="text-xs text-muted-foreground bg-muted/60 px-2.5 py-0.5 rounded-md border border-border/40">
                        Nguồn: {suggestion.source_grounding.source_reference}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-foreground">
                        {suggestion.title}
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {suggestion.description}
                      </p>
                    </div>

                    {/* Action Rules by Category */}
                    <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-border/40">
                      <button
                        type="button"
                        onClick={() => handleDismiss(suggestion.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors cursor-pointer"
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Bỏ qua</span>
                      </button>

                      {/* Only solution_candidate has "Lưu thành Giải pháp" */}
                      {isSolutionCandidate ? (
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmModal({
                              isOpen: true,
                              type: 'solution',
                              suggestion,
                            })
                          }
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/20 rounded-md transition-colors cursor-pointer border border-yellow-500/30"
                        >
                          <Lightbulb className="w-3.5 h-3.5" />
                          <span>Lưu thành Giải pháp</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmModal({
                              isOpen: true,
                              type: 'note',
                              suggestion,
                            })
                          }
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors cursor-pointer border border-primary/20"
                        >
                          <Bookmark className="w-3.5 h-3.5" />
                          <span>Lưu vào Ghi chép</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal for Human-in-the-Loop Actions */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={
          confirmModal.type === 'solution'
            ? 'Xác nhận lưu giải pháp'
            : 'Xác nhận lưu ghi chép'
        }
        description={
          confirmModal.type === 'solution'
            ? `Bạn có chắc chắn muốn lưu gợi ý "${confirmModal.suggestion?.title}" thành một Candidate Solution trong phiên nghiên cứu này?`
            : `Bạn có chắc chắn muốn lưu gợi ý "${confirmModal.suggestion?.title}" vào Sổ tay nghiên cứu (Notebook)?`
        }
        confirmLabel="Xác nhận lưu"
        cancelLabel="Hủy"
        destructive={false}
        isLoading={saveSolutionMutation.isPending || saveNoteMutation.isPending}
        onConfirm={handleConfirmAction}
        onCancel={() =>
          setConfirmModal({ isOpen: false, type: 'solution', suggestion: null })
        }
      />
    </div>
  )
}
