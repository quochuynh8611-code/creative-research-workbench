'use client'

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Lightbulb,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Sparkles,
  Plus,
  Trash2,
  Filter,
  RefreshCw,
  BarChart2,
  ShieldAlert,
  RotateCcw,
  Bookmark,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  listCandidateSolutions,
  createCandidateSolution,
  updateCandidateSolution,
  deleteCandidateSolution,
} from '@/lib/api-client'
import type {
  SolutionStatus,
  CandidateSolution,
  CreateCandidateSolutionInput,
  NoteDraft,
} from '@/lib/types'

interface CandidateSolutionsProps {
  sessionId: string
  className?: string
  initialDraft?: {
    title?: string
    mechanism?: string
  } | null
  onSaveAsNote?: (draft: NoteDraft) => void
}

const STATUS_LABELS: Record<SolutionStatus, string> = {
  candidate: 'Đang xem xét',
  accepted: 'Đã chấp nhận',
  rejected: 'Đã từ chối',
}

const STATUS_STYLES: Record<SolutionStatus, string> = {
  candidate: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  accepted: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  rejected: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
}

export function CandidateSolutions({
  sessionId,
  className = '',
  initialDraft,
  onSaveAsNote,
}: CandidateSolutionsProps) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState(initialDraft?.title || '')
  const [mechanism, setMechanism] = useState(initialDraft?.mechanism || '')
  const [noveltyScore, setNoveltyScore] = useState<number>(0.5)
  const [feasibilityScore, setFeasibilityScore] = useState<number>(0.5)
  const [riskNotes, setRiskNotes] = useState('')
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(true)

  useEffect(() => {
    if (initialDraft) {
      if (initialDraft.title) setTitle(initialDraft.title)
      if (initialDraft.mechanism) setMechanism(initialDraft.mechanism)
      setIsFormOpen(true)
    }
  }, [initialDraft])

  const {
    data: solutionsResponse,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['sessions', sessionId, 'solutions'],
    queryFn: () => listCandidateSolutions(sessionId),
    enabled: Boolean(sessionId),
  })

  const createMutation = useMutation({
    mutationFn: (input: CreateCandidateSolutionInput) =>
      createCandidateSolution(sessionId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', sessionId, 'solutions'] })
      setTitle('')
      setMechanism('')
      setNoveltyScore(0.5)
      setFeasibilityScore(0.5)
      setRiskNotes('')
      setValidationError(null)
      setActionError(null)
    },
    onError: (err: any) => {
      setActionError(err?.message || 'Không thể tạo giải pháp. Vui lòng thử lại.')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({
      solutionId,
      status,
    }: {
      solutionId: string
      status: SolutionStatus
    }) => updateCandidateSolution(sessionId, solutionId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', sessionId, 'solutions'] })
      setActionError(null)
    },
    onError: (err: any) => {
      setActionError(err?.message || 'Không thể cập nhật trạng thái giải pháp.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (solutionId: string) =>
      deleteCandidateSolution(sessionId, solutionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', sessionId, 'solutions'] })
      setActionError(null)
    },
    onError: (err: any) => {
      setActionError(err?.message || 'Không thể xóa giải pháp.')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedTitle = title.trim()
    const trimmedMechanism = mechanism.trim()

    if (!trimmedTitle) {
      setValidationError('Vui lòng nhập tiêu đề giải pháp')
      return
    }
    if (!trimmedMechanism) {
      setValidationError('Vui lòng nhập mô tả cơ chế giải pháp')
      return
    }

    setValidationError(null)
    setActionError(null)

    const payload: CreateCandidateSolutionInput = {
      title: trimmedTitle,
      mechanism: trimmedMechanism,
      status: 'candidate',
      novelty_score: Number(noveltyScore),
      feasibility_score: Number(feasibilityScore),
      risk_notes: riskNotes.trim() ? riskNotes.trim() : null,
    }

    createMutation.mutate(payload)
  }

  const solutions = solutionsResponse?.data ?? []

  const filteredSolutions = solutions.filter((sol) => {
    if (selectedStatusFilter === 'all') return true
    return sol.status === selectedStatusFilter
  })

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Giải pháp sáng tạo ứng viên (Candidate Solutions)
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Lập danh sách, đánh giá điểm mới / tính khả thi và theo dõi trạng thái các giải pháp sáng tạo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full w-fit">
            {solutions.length} giải pháp đã ghi nhận
          </span>
        </div>
      </div>

      {/* Creation Form Card */}
      <div className="bg-card rounded-2xl border border-border p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" />
            <span>Đề xuất giải pháp mới</span>
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label htmlFor="solution-title" className="block text-xs font-semibold text-foreground mb-1.5">
                Tiêu đề giải pháp <span className="text-destructive">*</span>
              </label>
              <input
                id="solution-title"
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  if (validationError) setValidationError(null)
                }}
                placeholder="Nhập tiêu đề giải pháp sáng tạo..."
                className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm transition-all"
              />
            </div>

            <div>
              <label htmlFor="solution-mechanism" className="block text-xs font-semibold text-foreground mb-1.5">
                Cơ chế hoạt động / Nguyên lý cốt lõi <span className="text-destructive">*</span>
              </label>
              <textarea
                id="solution-mechanism"
                rows={3}
                value={mechanism}
                onChange={(e) => {
                  setMechanism(e.target.value)
                  if (validationError) setValidationError(null)
                }}
                placeholder="Mô tả cơ chế hoạt động, sự phối hợp vật liệu hoặc phương pháp áp dụng..."
                className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm resize-y transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 p-3 rounded-xl bg-accent/40 border border-border/50">
                <div className="flex justify-between items-center">
                  <label htmlFor="novelty-score" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Điểm mới (Novelty)</span>
                  </label>
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                    {Math.round(noveltyScore * 100)}%
                  </span>
                </div>
                <input
                  id="novelty-score"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={noveltyScore}
                  onChange={(e) => setNoveltyScore(parseFloat(e.target.value))}
                  aria-label="Điểm mới (Novelty)"
                  aria-valuemin={0}
                  aria-valuemax={1}
                  aria-valuenow={noveltyScore}
                  aria-valuetext={`${Math.round(noveltyScore * 100)}%`}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div className="space-y-1.5 p-3 rounded-xl bg-accent/40 border border-border/50">
                <div className="flex justify-between items-center">
                  <label htmlFor="feasibility-score" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <BarChart2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Tính khả thi (Feasibility)</span>
                  </label>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {Math.round(feasibilityScore * 100)}%
                  </span>
                </div>
                <input
                  id="feasibility-score"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={feasibilityScore}
                  onChange={(e) => setFeasibilityScore(parseFloat(e.target.value))}
                  aria-label="Tính khả thi (Feasibility)"
                  aria-valuemin={0}
                  aria-valuemax={1}
                  aria-valuenow={feasibilityScore}
                  aria-valuetext={`${Math.round(feasibilityScore * 100)}%`}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>
            </div>

            <div>
              <label htmlFor="solution-risk" className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Rủi ro, thách thức hoặc ghi chú bổ sung (tùy chọn)</span>
              </label>
              <textarea
                id="solution-risk"
                rows={2}
                value={riskNotes}
                onChange={(e) => setRiskNotes(e.target.value)}
                placeholder="Rủi ro, thách thức hoặc ghi chú về điều kiện triển khai..."
                className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm resize-y transition-all"
              />
            </div>
          </div>

          {validationError && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs font-medium text-destructive flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {actionError && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs font-medium text-destructive flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Lưu giải pháp</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Solutions List and Filters */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            <span>Danh sách giải pháp ứng viên</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground font-medium">
              {filteredSolutions.length}
            </span>
          </h3>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'candidate', label: 'Đang xem xét' },
              { id: 'accepted', label: 'Đã chấp nhận' },
              { id: 'rejected', label: 'Đã từ chối' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedStatusFilter(tab.id)}
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer whitespace-nowrap',
                  selectedStatusFilter === tab.id
                    ? 'bg-primary text-primary-foreground border-primary font-semibold shadow-xs'
                    : 'bg-card text-muted-foreground border-border hover:bg-accent hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="p-8 text-center bg-card rounded-2xl border border-border space-y-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
            <p className="text-xs text-muted-foreground font-medium">
              Đang tải giải pháp ứng viên...
            </p>
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div className="p-6 bg-destructive/10 border border-destructive/20 rounded-2xl text-center space-y-3">
            <AlertCircle className="w-6 h-6 text-destructive mx-auto" />
            <p className="text-xs font-medium text-destructive">
              Không thể tải danh sách giải pháp ({error instanceof Error ? error.message : 'Lỗi kết nối'})
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-destructive text-destructive-foreground rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Thử lại</span>
            </button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && filteredSolutions.length === 0 && (
          <div className="p-10 text-center bg-card rounded-2xl border border-dashed border-border space-y-3">
            <Lightbulb className="w-10 h-10 text-muted-foreground/40 mx-auto" />
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-foreground">
                Chưa có giải pháp ứng viên nào
              </h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {selectedStatusFilter !== 'all'
                  ? 'Không tìm thấy giải pháp nào phù hợp với bộ lọc đã chọn.'
                  : 'Hãy sử dụng form phía trên để ghi nhận các giải pháp sáng tạo tiềm năng cho bài toán.'}
              </p>
            </div>
          </div>
        )}

        {/* Solutions Grid */}
        {!isLoading && !isError && filteredSolutions.length > 0 && (
          <div className="grid grid-cols-1 gap-4">
            {filteredSolutions.map((sol: CandidateSolution) => {
              const noveltyPercent = Math.round((sol.novelty_score ?? 0) * 100)
              const feasibilityPercent = Math.round((sol.feasibility_score ?? 0) * 100)

              return (
                <div
                  key={sol.id}
                  className="bg-card rounded-2xl border border-border p-5 shadow-xs hover:border-border/80 hover:shadow-sm transition-all space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'px-2.5 py-0.5 rounded-full text-[11px] font-bold border shrink-0',
                            STATUS_STYLES[sol.status] || STATUS_STYLES.candidate
                          )}
                        >
                          {STATUS_LABELS[sol.status] || sol.status}
                        </span>
                        <h4 className="text-base font-bold text-foreground">
                          {sol.title}
                        </h4>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate(sol.id)}
                        disabled={deleteMutation.isPending}
                        aria-label="Xóa giải pháp"
                        title="Xóa giải pháp"
                        className="text-muted-foreground hover:text-destructive p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Mechanism */}
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed bg-accent/20 p-3.5 rounded-xl border border-border/40">
                    {sol.mechanism}
                  </p>

                  {/* Scores and Risks */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="p-3 rounded-xl bg-accent/30 border border-border/40 space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-medium text-muted-foreground flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          Điểm mới:
                        </span>
                        <span className="font-bold text-amber-600 dark:text-amber-400">
                          {noveltyPercent}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full"
                          style={{ width: `${noveltyPercent}%` }}
                        />
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-accent/30 border border-border/40 space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-medium text-muted-foreground flex items-center gap-1">
                          <BarChart2 className="w-3.5 h-3.5 text-emerald-500" />
                          Tính khả thi:
                        </span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {feasibilityPercent}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${feasibilityPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Risk notes if any */}
                  {sol.risk_notes && (
                    <div className="text-xs text-muted-foreground p-3 rounded-xl bg-muted/40 border border-border/40 flex items-start gap-2">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <strong className="text-foreground font-semibold">Ghi chú rủi ro / điều kiện:</strong>
                        <p>{sol.risk_notes}</p>
                      </div>
                    </div>
                  )}

                  {/* Quick Action Status Workflow */}
                  <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">
                        Chuyển trạng thái:
                      </span>
                      {sol.status !== 'accepted' && (
                        <button
                          type="button"
                          onClick={() =>
                            updateMutation.mutate({
                              solutionId: sol.id,
                              status: 'accepted',
                            })
                          }
                          disabled={updateMutation.isPending}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 transition-all cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Chấp nhận</span>
                        </button>
                      )}

                      {sol.status !== 'rejected' && (
                        <button
                          type="button"
                          onClick={() =>
                            updateMutation.mutate({
                              solutionId: sol.id,
                              status: 'rejected',
                            })
                          }
                          disabled={updateMutation.isPending}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition-all cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Từ chối</span>
                        </button>
                      )}

                      {sol.status !== 'candidate' && (
                        <button
                          type="button"
                          onClick={() =>
                            updateMutation.mutate({
                              solutionId: sol.id,
                              status: 'candidate',
                            })
                          }
                          disabled={updateMutation.isPending}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 transition-all cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Xem xét lại</span>
                        </button>
                      )}
                    </div>

                    {onSaveAsNote && (
                      <button
                        type="button"
                        onClick={() => {
                          const riskPart = sol.risk_notes ? `\nGhi chú rủi ro: ${sol.risk_notes}` : ''
                          onSaveAsNote({
                            content: `[Giải pháp ứng viên: ${sol.title}]\nCơ chế: ${sol.mechanism}\nĐiểm mới: ${noveltyPercent}% | Tính khả thi: ${feasibilityPercent}%${riskPart}`,
                            note_type: sol.status === 'accepted' ? 'decision' : 'hypothesis',
                          })
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all cursor-pointer"
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                        <span>Lưu vào sổ tay</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
