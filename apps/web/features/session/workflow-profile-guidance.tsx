'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Compass, CheckCircle2, Sparkles, AlertCircle, Loader2 } from 'lucide-react'
import { getWorkflowProfiles } from '@/lib/api-client'
import type {
  WorkflowProfile,
  WorkflowProfileId,
  WorkflowProfilesResponse,
  WorkflowStage,
  TrizNineWindowsLens,
} from '@/lib/types'
import { cn } from '@/lib/utils'

const LENS_LABELS: Record<TrizNineWindowsLens, string> = {
  engineering: 'Kỹ thuật',
  business: 'Kinh doanh',
  everyday: 'Đời sống',
  systems_thinking: 'Tư duy Hệ thống',
  design_thinking: 'Tư duy Thiết kế',
  lean_startup: 'Khởi nghiệp Tinh gọn',
}

const STAGE_LABELS: Record<string, string> = {
  idle: 'Khởi tạo',
  intake: 'Nhập vấn đề',
  structuring: 'Chuẩn hóa mâu thuẫn',
  retrieval: 'Tra cứu tri thức',
  ideation: 'Sáng tạo giải pháp',
  evaluation: 'Đánh giá & lựa chọn',
  synthesis: 'Tổng hợp báo cáo',
  completed: 'Hoàn thành',
}

interface WorkflowProfileGuidanceProps {
  currentStage?: WorkflowStage | string
  onSelectLens?: (lens: TrizNineWindowsLens) => void
  className?: string
}

export function WorkflowProfileGuidance({
  currentStage = 'intake',
  onSelectLens,
  className,
}: WorkflowProfileGuidanceProps) {
  const [selectedProfileId, setSelectedProfileId] = useState<WorkflowProfileId>('standard_triz')

  const { data, isLoading, isError, error } = useQuery<WorkflowProfilesResponse>({
    queryKey: ['sessions', 'workflow-profiles'],
    queryFn: () => getWorkflowProfiles(),
    staleTime: 1000 * 60 * 10, // 10 minutes cache
  })

  const profiles: WorkflowProfile[] = data?.data ?? []
  const activeProfile =
    profiles.find((p) => p.id === selectedProfileId) ?? profiles[0]

  if (isLoading) {
    return (
      <div
        data-testid="workflow-profiles-loading"
        className="rounded-2xl border border-border/60 bg-card/60 p-5 shadow-xs flex items-center justify-center gap-3 text-sm text-muted-foreground animate-pulse"
      >
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        <span>Đang tải hướng dẫn quy trình làm việc...</span>
      </div>
    )
  }

  if (isError) {
    return (
      <div
        data-testid="workflow-profiles-error"
        className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-xs text-destructive flex items-center gap-2"
      >
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>Không thể tải hồ sơ quy trình làm việc. Vui lòng thử lại.</span>
      </div>
    )
  }

  if (!activeProfile) {
    return null
  }

  const activeStageGuidance = activeProfile.stages_guidance?.[currentStage]

  return (
    <div
      className={cn(
        'rounded-2xl border border-border/80 bg-card/60 backdrop-blur-xs p-5 shadow-xs space-y-4',
        className
      )}
      data-testid="workflow-profile-guidance"
    >
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
              Chỉ Dẫn Quy Trình & Lăng Kính (Workflow Profiles)
            </h3>
            <p className="text-xs text-muted-foreground">
              Chọn luồng tiếp cận phù hợp với bài toán thực tế của bạn
            </p>
          </div>
        </div>

        {/* Profile Tabs */}
        <div
          role="tablist"
          aria-label="Chọn hồ sơ quy trình"
          className="inline-flex items-center rounded-xl border border-border p-1 bg-muted/40 overflow-x-auto max-w-full scrollbar-none gap-1 self-start sm:self-auto"
        >
          {profiles.map((profile) => {
            const isSelected = profile.id === activeProfile.id
            return (
              <button
                key={profile.id}
                role="button"
                aria-pressed={isSelected ? 'true' : 'false'}
                onClick={() => setSelectedProfileId(profile.id)}
                className={cn(
                  'shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-primary focus:outline-none cursor-pointer',
                  isSelected
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
                )}
              >
                {profile.name_vi}
              </button>
            )
          })}
        </div>
      </div>

      {/* Profile Overview Card */}
      <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-foreground">
              Chi tiết: {activeProfile.name_vi}
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {activeProfile.description_vi}
            </p>
          </div>

          {/* Recommended Lenses Badges */}
          <div className="shrink-0 space-y-1 sm:text-right">
            <div className="text-[11px] font-medium text-muted-foreground flex items-center sm:justify-end gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Lăng kính khuyến nghị:</span>
            </div>
            <div className="flex flex-wrap items-center sm:justify-end gap-1.5">
              {activeProfile.recommended_lenses.map((lens) => (
                <button
                  key={lens}
                  type="button"
                  onClick={() => onSelectLens?.(lens)}
                  className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                >
                  {LENS_LABELS[lens] ?? lens}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Current Stage Guidance Spotlight */}
        {activeStageGuidance && (
          <div className="pt-2 border-t border-border/40 flex items-start gap-2.5 text-xs">
            <div className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <div className="space-y-0.5">
              <span className="font-semibold text-foreground">
                Giai đoạn hiện tại ({STAGE_LABELS[currentStage] ?? currentStage}):{' '}
              </span>
              <span className="text-muted-foreground">Chỉ dẫn trọng tâm: {activeStageGuidance}</span>
            </div>
          </div>
        )}

        {/* Stages Timeline Map */}
        <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
          {Object.entries(activeProfile.stages_guidance || {}).map(([stageKey, guidance]) => {
            const isCurrent = stageKey === currentStage
            return (
              <div
                key={stageKey}
                className={cn(
                  'p-2.5 rounded-lg border text-xs space-y-1 transition-all',
                  isCurrent
                    ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20'
                    : 'border-border/40 bg-background/50 text-muted-foreground'
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      'font-semibold text-[11px]',
                      isCurrent ? 'text-primary' : 'text-foreground/80'
                    )}
                  >
                    {STAGE_LABELS[stageKey] ?? stageKey}
                  </span>
                  {isCurrent && (
                    <span className="px-1.5 py-0.2 rounded text-[10px] bg-primary text-primary-foreground font-medium">
                      Hiện tại
                    </span>
                  )}
                </div>
                <p className="text-[11px] leading-relaxed line-clamp-2">{guidance}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
