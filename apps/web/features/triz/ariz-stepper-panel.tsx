'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  GitCommit,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  CheckCircle2,
  Bookmark,
  Sparkles,
} from 'lucide-react'
import { getTrizArizSteps } from '@/lib/api-client'
import { validateTrizArizContext } from '@/lib/triz-ariz-context-validator'
import type { TrizArizResponse, NoteDraft } from '@/lib/types'

interface ArizStepperPanelProps {
  onSaveAsNote?: (draft: NoteDraft) => void
}

export function ArizStepperPanel({ onSaveAsNote }: ArizStepperPanelProps) {
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0)
  const [userNotes, setUserNotes] = useState<Record<number, string>>({})
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<TrizArizResponse>({
    queryKey: ['triz', 'ariz-steps'],
    queryFn: () => getTrizArizSteps(),
    staleTime: 1000 * 60 * 60, // 1 hour cache
  })

  const steps = data?.data ?? []
  const currentStep = steps[activeStepIndex]

  const handleNext = () => {
    if (activeStepIndex < steps.length - 1) {
      setActiveStepIndex((prev) => prev + 1)
      setSaveSuccess(false)
      setValidationError(null)
    }
  }

  const handlePrev = () => {
    if (activeStepIndex > 0) {
      setActiveStepIndex((prev) => prev - 1)
      setSaveSuccess(false)
      setValidationError(null)
    }
  }

  const handleSaveNote = () => {
    if (!currentStep || !onSaveAsNote) return

    const contextCandidate = {
      schema_version: 1,
      source_type: 'triz_ariz',
      step_number: currentStep.step_number,
      step_name: currentStep.code,
    }

    const validation = validateTrizArizContext(contextCandidate)
    if (!validation.ok) {
      setValidationError(validation.error)
      return
    }
    setValidationError(null)

    const noteText = userNotes[currentStep.step_number]?.trim() || ''
    const questionsBlock = currentStep.trigger_questions.length > 0
      ? `\n\nCâu hỏi gợi mở:\n${currentStep.trigger_questions.map((q) => `- ${q}`).join('\n')}`
      : ''
    const actionsBlock = currentStep.recommended_actions.length > 0
      ? `\n\nHành động khuyến nghị:\n${currentStep.recommended_actions.map((a) => `- ${a}`).join('\n')}`
      : ''

    const content = `[ARIZ Bước ${currentStep.step_number}: ${currentStep.name_vi} (${currentStep.code})]\n${
      noteText ? `Ghi chú giải pháp: ${noteText}\n` : ''
    }Mô tả: ${currentStep.description}${questionsBlock}${actionsBlock}`

    onSaveAsNote({
      content,
      note_type: 'action',
      source_context: validation.data,
    })

    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 2500)
  }

  if (isError) {
    return (
      <div
        data-testid="ariz-stepper-error"
        className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive flex items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>
            {error instanceof Error ? error.message : 'Lỗi tải hướng dẫn ARIZ từ máy chủ.'}
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

  if (isLoading || !currentStep) {
    return (
      <div className="p-6 rounded-xl border border-border bg-card/60 animate-pulse space-y-4">
        <div className="h-6 w-1/3 bg-muted rounded"></div>
        <div className="h-10 w-full bg-muted/60 rounded"></div>
        <div className="h-32 w-full bg-muted/40 rounded"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/60 pb-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <GitCommit className="w-5 h-5 text-primary" />
            Thuật giải ARIZ 6 bước rút gọn
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Quy trình tư duy từng bước chuyển hóa mâu thuẫn phức tạp sang Kết quả Lý tưởng Cuối cùng (IFR)
          </p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary self-start sm:self-auto">
          Bước {activeStepIndex + 1} / {steps.length}
        </span>
      </div>

      {/* Stepper Progress Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {steps.map((step, idx) => {
          const isActive = idx === activeStepIndex
          const isDone = idx < activeStepIndex
          return (
            <button
              key={step.code}
              type="button"
              onClick={() => {
                setActiveStepIndex(idx)
                setSaveSuccess(false)
                setValidationError(null)
              }}
              aria-label={`Bước ${step.step_number}: ${step.name_vi}`}
              className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                isActive
                  ? 'border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/40'
                  : isDone
                  ? 'border-border/80 bg-muted/40 text-foreground hover:bg-muted/70'
                  : 'border-border/40 bg-card/40 text-muted-foreground hover:bg-muted/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold">
                  B{step.step_number}
                </span>
                {isDone && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
              </div>
              <p className="text-xs font-medium truncate mt-1">
                {step.code.replace(/^B\d+_/, '')}
              </p>
            </button>
          )
        })}
      </div>

      {/* Step Detail Card */}
      <div className="rounded-xl border border-border bg-card/80 p-5 space-y-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-muted text-muted-foreground">
              {currentStep.code}
            </span>
            <span className="text-xs text-muted-foreground italic">
              {currentStep.name_en}
            </span>
          </div>
          <h3 className="text-base font-bold text-foreground mt-1.5">
            {currentStep.name_vi}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            {currentStep.description}
          </p>
        </div>

        {/* Two columns: Trigger questions & Recommended actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <HelpCircle className="w-4 h-4 text-sky-500" />
              Câu hỏi kích hoạt tư duy
            </div>
            <ul className="space-y-1.5 text-xs text-muted-foreground list-disc list-inside">
              {currentStep.trigger_questions.map((q, i) => (
                <li key={i} className="leading-normal">{q}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Hành động khuyến nghị
            </div>
            <ul className="space-y-1.5 text-xs text-muted-foreground list-disc list-inside">
              {currentStep.recommended_actions.map((a, i) => (
                <li key={i} className="leading-normal">{a}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* User notes textarea */}
        <div className="space-y-2 pt-2 border-t border-border/60">
          <label
            htmlFor="ariz-step-notes"
            className="text-xs font-medium text-foreground block"
          >
            Ghi chú giải pháp bước này:
          </label>
          <textarea
            id="ariz-step-notes"
            value={userNotes[currentStep.step_number] || ''}
            onChange={(e) =>
              setUserNotes((prev) => ({
                ...prev,
                [currentStep.step_number]: e.target.value,
              }))
            }
            placeholder="Ghi chú giải pháp hoặc câu trả lời cho bước này..."
            rows={3}
            className="w-full text-xs rounded-lg border border-border bg-background p-3 focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {validationError && (
          <p className="text-xs text-destructive">{validationError}</p>
        )}

        {/* Stepper Navigation Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border/60">
          <button
            type="button"
            onClick={handlePrev}
            disabled={activeStepIndex === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Bước trước
          </button>

          <div className="flex items-center gap-2">
            {onSaveAsNote && (
              <button
                type="button"
                onClick={handleSaveNote}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors cursor-pointer"
              >
                <Bookmark className="w-3.5 h-3.5" />
                {saveSuccess ? 'Đã lưu vào sổ tay!' : 'Lưu vào sổ tay'}
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              disabled={activeStepIndex === steps.length - 1}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Bước kế tiếp
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
