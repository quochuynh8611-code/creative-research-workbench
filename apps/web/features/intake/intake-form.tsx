'use client'

import { useState } from 'react'
import { Plus, X, ChevronRight, Loader2, AlertCircle, Sparkles, Zap } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { createProblemFrame, analyzeProblemWithAI } from '@/lib/api-client'
import type { ProblemFrame, AIProblemAnalysisResponse } from '@/lib/types'

interface ProblemFrameDraft {
  goal: string
  constraints: string[]
  affected_entities: string[]
  failure_signals: string[]
  success_criteria: string[]
}

function TagInput({
  label,
  items,
  onAdd,
  onRemove,
  placeholder,
}: {
  label: string
  items: string[]
  onAdd: (val: string) => void
  onRemove: (idx: number) => void
  placeholder: string
}) {
  const [input, setInput] = useState('')

  const handleAdd = () => {
    if (input.trim()) {
      onAdd(input.trim())
      setInput('')
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="px-3 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-accent transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {items.map((item, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 text-xs bg-accent text-accent-foreground px-2.5 py-1 rounded-full"
            >
              {item}
              <button
                type="button"
                onClick={() => onRemove(idx)}
                className="hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

interface IntakeFormProps {
  sessionId: string
  domain?: string | null
  initialProblemFrame?: ProblemFrame | null
  onProblemFrameCreated?: (frame: ProblemFrame) => void
}

export function IntakeForm({
  sessionId,
  domain,
  initialProblemFrame,
  onProblemFrameCreated,
}: IntakeFormProps) {
  const queryClient = useQueryClient()

  const [form, setForm] = useState<ProblemFrameDraft>({
    goal: initialProblemFrame?.raw_statement || '',
    constraints: [],
    affected_entities: [],
    failure_signals: [],
    success_criteria: [],
  })

  const [submitError, setSubmitError] = useState<string | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiSuggestion, setAiSuggestion] = useState<AIProblemAnalysisResponse | null>(null)

  const addItem = (field: keyof Omit<ProblemFrameDraft, 'goal'>) => (val: string) =>
    setForm((f) => ({ ...f, [field]: [...f[field], val] }))

  const removeItem = (field: keyof Omit<ProblemFrameDraft, 'goal'>) => (idx: number) =>
    setForm((f) => ({ ...f, [field]: f[field].filter((_, i) => i !== idx) }))

  const mutation = useMutation({
    mutationFn: (rawStatement: string) =>
      createProblemFrame(sessionId, {
        raw_statement: rawStatement,
        ...(domain ? { domain } : {}),
      }),
    onSuccess: (data) => {
      setSubmitError(null)
      queryClient.invalidateQueries({ queryKey: ['session', sessionId] })
      onProblemFrameCreated?.(data)
    },
    onError: (err: any) => {
      const errorMsg =
        err?.response?.data?.detail ||
        err?.message ||
        'Không thể lưu bài toán. Vui lòng kiểm tra lại kết nối.'
      setSubmitError(errorMsg)
    },
  })

  const aiMutation = useMutation({
    mutationFn: (rawStatement: string) =>
      analyzeProblemWithAI(sessionId, {
        raw_statement: rawStatement,
        ...(domain ? { domain } : {}),
      }),
    onSuccess: (data) => {
      setAiError(null)
      setAiSuggestion(data)
    },
    onError: (err: any) => {
      const errorMsg =
        err?.response?.data?.detail ||
        err?.message ||
        'Không thể phân tích bằng AI. Vui lòng kiểm tra lại kết nối.'
      setAiError(errorMsg)
    },
  })

  const composeStatement = (): string => {
    const parts: string[] = [form.goal.trim()]
    if (form.constraints.length > 0) {
      parts.push(`Ràng buộc: ${form.constraints.join(', ')}`)
    }
    if (form.affected_entities.length > 0) {
      parts.push(`Đối tượng: ${form.affected_entities.join(', ')}`)
    }
    if (form.failure_signals.length > 0) {
      parts.push(`Tín hiệu thất bại: ${form.failure_signals.join(', ')}`)
    }
    if (form.success_criteria.length > 0) {
      parts.push(`Tiêu chí: ${form.success_criteria.join(', ')}`)
    }
    return parts.join('. ')
  }

  const handleAnalyzeAI = () => {
    setAiError(null)
    const statement = composeStatement()
    if (!statement || statement.length < 10) return
    aiMutation.mutate(statement)
  }

  const handleApplySuggestion = () => {
    if (aiSuggestion?.data.normalized_statement) {
      setForm((f) => ({ ...f, goal: aiSuggestion.data.normalized_statement }))
    }
    setAiSuggestion(null)
  }

  const handleDiscardSuggestion = () => {
    setAiSuggestion(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    const statement = form.goal.trim()
    if (!statement) return
    mutation.mutate(statement)
  }

  const isValid = form.goal.trim().length >= 10
  const isAiEligible = form.goal.trim().length >= 10

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold mb-1">Problem Intake</h2>
        <p className="text-sm text-muted-foreground">
          Mô tả vấn đề hoặc mâu thuẫn để hệ thống chuẩn hóa và nhận diện bài toán TRIZ.
        </p>
      </div>

      {submitError && (
        <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      {aiError && (
        <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{aiError}</span>
        </div>
      )}

      {/* Goal / Raw Statement */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium">
            Mục tiêu / Mô tả bài toán <span className="text-destructive">*</span>
          </label>
          <button
            type="button"
            onClick={handleAnalyzeAI}
            disabled={!isAiEligible || aiMutation.isPending}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md border transition-colors',
              isAiEligible && !aiMutation.isPending
                ? 'bg-secondary hover:bg-accent text-secondary-foreground border-border cursor-pointer shadow-xs'
                : 'bg-muted text-muted-foreground border-transparent cursor-not-allowed'
            )}
          >
            {aiMutation.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Đang phân tích...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Gợi ý với AI</span>
              </>
            )}
          </button>
        </div>
        <textarea
          value={form.goal}
          onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
          placeholder="Bạn muốn đạt được điều gì? Ví dụ: Cần tăng độ bền và độ cứng của cánh tay robot nhưng không được làm tăng trọng lượng tổng thể..."
          rows={4}
          className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
        <p className="text-xs text-muted-foreground">{form.goal.length} ký tự (tối thiểu 10 ký tự)</p>

        {/* Ephemeral Suggestion Card */}
        {aiSuggestion && (
          <div className="p-4 rounded-lg border border-accent bg-accent/30 space-y-3 animate-in fade-in-50 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border',
                    aiSuggestion._meta.provenance === 'ai_hypothesis'
                      ? 'bg-primary/10 text-primary border-primary/20'
                      : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                  )}
                >
                  {aiSuggestion._meta.provenance === 'ai_hypothesis' ? (
                    <>
                      <Sparkles className="w-3 h-3" />
                      Gợi ý AI
                    </>
                  ) : (
                    <>
                      <Zap className="w-3 h-3" />
                      Rule-based (Fallback)
                    </>
                  )}
                </span>
                {aiSuggestion.data.contradiction_type && (
                  <span className="text-xs text-muted-foreground">
                    Mâu thuẫn: <strong>{aiSuggestion.data.contradiction_type}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Normalized Statement */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Câu bài toán chuẩn hóa
              </p>
              <p className="text-sm font-medium mt-0.5">{aiSuggestion.data.normalized_statement}</p>
            </div>

            {/* Parameters */}
            {(aiSuggestion.data.improving_parameter || aiSuggestion.data.worsening_parameter) && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                {aiSuggestion.data.improving_parameter && (
                  <div className="p-2 bg-background/50 rounded border border-border/50">
                    <span className="text-muted-foreground">Cần cải thiện: </span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {aiSuggestion.data.improving_parameter}
                    </span>
                  </div>
                )}
                {aiSuggestion.data.worsening_parameter && (
                  <div className="p-2 bg-background/50 rounded border border-border/50">
                    <span className="text-muted-foreground">Bị suy giảm: </span>
                    <span className="font-semibold text-rose-600 dark:text-rose-400">
                      {aiSuggestion.data.worsening_parameter}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Reasoning */}
            {aiSuggestion.data.reasoning && (
              <p className="text-xs text-muted-foreground italic bg-background/40 p-2 rounded">
                {aiSuggestion.data.reasoning}
              </p>
            )}

            {/* Suggested Keywords (Read-only) */}
            {aiSuggestion.data.suggested_keywords && aiSuggestion.data.suggested_keywords.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Từ khóa gợi ý:</p>
                <div className="flex flex-wrap gap-1.5">
                  {aiSuggestion.data.suggested_keywords.map((kw, idx) => (
                    <span
                      key={idx}
                      className="text-xs bg-background text-foreground px-2 py-0.5 rounded border border-border/60"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleApplySuggestion}
                className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-md hover:opacity-90 transition-opacity cursor-pointer"
              >
                Áp dụng gợi ý
              </button>
              <button
                type="button"
                onClick={handleDiscardSuggestion}
                className="px-3 py-1.5 bg-secondary text-secondary-foreground text-xs font-medium rounded-md hover:bg-muted transition-colors cursor-pointer"
              >
                Bỏ qua
              </button>
            </div>
          </div>
        )}
      </div>

      <TagInput
        label="Ràng buộc (Constraints)"
        items={form.constraints}
        onAdd={addItem('constraints')}
        onRemove={removeItem('constraints')}
        placeholder="Ví dụ: Ngân sách vật liệu < 100 triệu, kích thước cố định"
      />

      <TagInput
        label="Đối tượng bị tác động (Affected Entities)"
        items={form.affected_entities}
        onAdd={addItem('affected_entities')}
        onRemove={removeItem('affected_entities')}
        placeholder="Ví dụ: Động cơ servo, tải trọng đầu cuối"
      />

      <TagInput
        label="Tín hiệu thất bại / Mâu thuẫn phát sinh"
        items={form.failure_signals}
        onAdd={addItem('failure_signals')}
        onRemove={removeItem('failure_signals')}
        placeholder="Ví dụ: Rung lắc khi quay tốc độ cao"
      />

      <TagInput
        label="Tiêu chí thành công (Success Criteria)"
        items={form.success_criteria}
        onAdd={addItem('success_criteria')}
        onRemove={removeItem('success_criteria')}
        placeholder="Ví dụ: Tăng gia tốc 25%, sai số < 0.1mm"
      />

      <button
        type="submit"
        disabled={!isValid || mutation.isPending || aiMutation.isPending}
        className={cn(
          'inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium transition-all shadow-sm',
          isValid && !mutation.isPending && !aiMutation.isPending
            ? 'bg-primary text-primary-foreground hover:opacity-90 cursor-pointer'
            : 'bg-muted text-muted-foreground cursor-not-allowed'
        )}
      >
        {mutation.isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Đang chuẩn hóa bài toán...</span>
          </>
        ) : (
          <>
            <span>Lưu và chuyển sang Phân tích cấu trúc</span>
            <ChevronRight className="w-4 h-4" />
          </>
        )}
      </button>
    </form>
  )
}
