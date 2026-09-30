'use client'

import React, { useState } from 'react'
import { ArrowRight, Check, Loader2, AlertCircle, Sparkles } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { WORKFLOW_STAGES, STAGE_LABELS, cn } from '@/lib/utils'
import { nextStep } from '@/lib/api-client'
import type { WorkflowStage, NextStepResponse } from '@/lib/types'

interface WorkflowStepperProps {
  sessionId: string
  currentStage: WorkflowStage
  onSelectStage?: (stage: WorkflowStage) => void
  onNextStepSuccess?: (response: NextStepResponse) => void
  className?: string
}

export function WorkflowStepper({
  sessionId,
  currentStage,
  onSelectStage,
  onNextStepSuccess,
  className,
}: WorkflowStepperProps) {
  const queryClient = useQueryClient()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const stageIndex = WORKFLOW_STAGES.indexOf(currentStage as any) >= 0
    ? WORKFLOW_STAGES.indexOf(currentStage as any)
    : 0

  const isLastStage = stageIndex >= WORKFLOW_STAGES.length - 1
  const nextStageName = !isLastStage ? WORKFLOW_STAGES[stageIndex + 1] : null

  const advanceMutation = useMutation({
    mutationFn: () => nextStep(sessionId),
    onSuccess: (data) => {
      setErrorMessage(null)
      queryClient.invalidateQueries({ queryKey: ['session', sessionId] })
      if (onNextStepSuccess) {
        onNextStepSuccess(data)
      }
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.detail || error?.message || 'Không thể chuyển bước quy trình.'
      setErrorMessage(msg)
    },
  })

  return (
    <div className={cn('p-5 rounded-2xl border border-border bg-card/60 backdrop-blur-md space-y-4 shadow-sm', className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Tiến trình nghiên cứu TRIZ (FSM Workflow)</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Giai đoạn hiện tại: <strong className="text-foreground font-semibold">{STAGE_LABELS[currentStage] || currentStage}</strong>
          </p>
        </div>

        {!isLastStage && (
          <button
            type="button"
            onClick={() => advanceMutation.mutate()}
            disabled={advanceMutation.isPending}
            className={cn(
              'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all',
              'bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none'
            )}
          >
            {advanceMutation.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Đang chuyển bước...</span>
              </>
            ) : (
              <>
                <span>Chuyển sang bước tiếp theo</span>
                {nextStageName && (
                  <span className="opacity-80">({STAGE_LABELS[nextStageName]})</span>
                )}
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        )}
      </div>

      {errorMessage && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong>Không thể chuyển bước:</strong> {errorMessage}
          </div>
        </div>
      )}

      {/* Stepper nodes */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1">
        {WORKFLOW_STAGES.map((stage, idx) => {
          const isPassed = idx < stageIndex
          const isCurrent = idx === stageIndex
          const isUpcoming = idx > stageIndex

          return (
            <div key={stage} className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onSelectStage?.(stage)}
                className={cn(
                  'flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all text-left',
                  isPassed && 'bg-primary/15 text-primary border border-primary/30 hover:bg-primary/20',
                  isCurrent && 'bg-primary text-primary-foreground font-semibold shadow-md ring-2 ring-primary/30',
                  isUpcoming && 'bg-muted/70 text-muted-foreground opacity-70 hover:opacity-100 hover:bg-muted'
                )}
              >
                <span
                  className={cn(
                    'w-4 h-4 rounded-full inline-flex items-center justify-center text-[10px] font-bold',
                    isPassed && 'bg-primary text-primary-foreground',
                    isCurrent && 'bg-primary-foreground text-primary',
                    isUpcoming && 'bg-muted-foreground/30 text-muted-foreground'
                  )}
                >
                  {isPassed ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : idx + 1}
                </span>
                <span>{STAGE_LABELS[stage] || stage}</span>
              </button>

              {idx < WORKFLOW_STAGES.length - 1 && (
                <div
                  className={cn(
                    'h-0.5 w-4 shrink-0 transition-colors',
                    isPassed ? 'bg-primary/60' : 'bg-border'
                  )}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
