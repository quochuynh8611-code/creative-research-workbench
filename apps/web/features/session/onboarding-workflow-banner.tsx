'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Sparkles,
  Inbox,
  GitFork,
  Search,
  Lightbulb,
  CheckCircle,
  FileText,
  Loader2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react'
import { getSessionTemplates, createSessionFromTemplate } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import type { SessionTemplate } from '@/lib/types'

const WORKFLOW_STEPS = [
  {
    step: 1,
    name: 'Intake',
    title: 'Thu nhận bài toán',
    desc: 'Phát biểu mong muốn và rào cản',
    icon: Inbox,
  },
  {
    step: 2,
    name: 'Structuring',
    title: 'Cấu trúc mâu thuẫn',
    desc: 'Chuẩn hóa mâu thuẫn kỹ thuật / vật lý',
    icon: GitFork,
  },
  {
    step: 3,
    name: 'Retrieval',
    title: 'Truy xuất tri thức',
    desc: 'Tìm kiếm bằng chứng và case tương tự',
    icon: Search,
  },
  {
    step: 4,
    name: 'Ideation',
    title: 'Phát kiến giải pháp',
    desc: 'Áp dụng 40 nguyên tắc qua 4 lăng kính',
    icon: Lightbulb,
  },
  {
    step: 5,
    name: 'Evaluation',
    title: 'Đánh giá phương án',
    desc: 'Chấm điểm tính mới và tính khả thi',
    icon: CheckCircle,
  },
  {
    step: 6,
    name: 'Synthesis',
    title: 'Tổng hợp báo cáo',
    desc: 'Xuất kết quả nghiên cứu và kế hoạch',
    icon: FileText,
  },
]

export interface OnboardingWorkflowBannerProps {
  className?: string
}

export function OnboardingWorkflowBanner({ className }: OnboardingWorkflowBannerProps) {
  let router: any = null
  try {
    router = useRouter()
  } catch {
    router = null
  }
  const queryClient = useQueryClient()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const quickStartMutation = useMutation({
    mutationFn: async () => {
      setErrorMessage(null)
      const templates = typeof getSessionTemplates === 'function' ? await getSessionTemplates() : []
      if (!Array.isArray(templates) || templates.length === 0) {
        throw new Error('Không tìm thấy danh sách mẫu nghiên cứu từ hệ thống.')
      }

      // 1. Ưu tiên 1: business_delivery_speed_cost (hoặc logistics)
      let selectedTemplate: SessionTemplate | undefined = templates.find(
        (t) =>
          t.id === 'business_delivery_speed_cost' ||
          t.id === 'tpl-business-logistics' ||
          (t.tags && t.tags.includes('logistics'))
      )

      // 2. Fallback 2: personal_healthy_meal_time_cost (hoặc nutrition)
      if (!selectedTemplate) {
        selectedTemplate = templates.find(
          (t) =>
            t.id === 'personal_healthy_meal_time_cost' ||
            t.id === 'tpl-personal-nutrition' ||
            (t.tags && t.tags.includes('nutrition'))
        )
      }

      // 3. RÀNG BUỘC CHẶT CHẼ: Tuyệt đối KHÔNG dùng templates[0] làm fallback.
      if (!selectedTemplate) {
        throw new Error(
          'Không tìm thấy mẫu phù hợp (yêu cầu mẫu Logistics hoặc Nutrition). Vui lòng tạo session thủ công hoặc tải lại trang.'
        )
      }

      return createSessionFromTemplate({ template_id: selectedTemplate.id })
    },
    onSuccess: (newSession) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      if (router?.push) {
        router.push(`/sessions/${newSession.id}`)
      } else if (typeof window !== 'undefined') {
        window.location.href = `/sessions/${newSession.id}`
      }
    },
    onError: (err: any) => {
      setErrorMessage(err?.message || 'Không thể khởi tạo phiên mẫu. Vui lòng thử lại.')
    },
  })

  return (
    <div
      data-testid="onboarding-workflow-banner"
      className={cn(
        'bg-card border border-primary/20 rounded-xl p-6 shadow-xs space-y-6 animate-in fade-in duration-200',
        className
      )}
    >
      {/* Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Chào mừng bạn đến với Creative Research Workbench</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Chu trình Giải quyết Bài toán Sáng tạo theo TRIZ
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Khám phá quy trình 6 chặng giúp biến mâu thuẫn phức tạp thành các phương án giải pháp hành động cụ thể.
          </p>
        </div>

        <button
          type="button"
          onClick={() => quickStartMutation.mutate()}
          disabled={quickStartMutation.isPending}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-xs shrink-0 disabled:opacity-50 cursor-pointer"
        >
          {quickStartMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          <span>Bắt đầu phiên mẫu</span>
          <ArrowRight className="w-4 h-4 ml-0.5" />
        </button>
      </div>

      {/* Error notification if quick-start fails */}
      {errorMessage && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3.5 rounded-lg flex items-start gap-2.5 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1 text-xs sm:text-sm leading-relaxed">{errorMessage}</span>
        </div>
      )}

      {/* 6 Steps Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {WORKFLOW_STEPS.map((st) => {
          const StepIcon = st.icon
          return (
            <div
              key={st.step}
              className="bg-accent/20 hover:bg-accent/40 border border-border/60 hover:border-primary/40 rounded-lg p-3.5 transition-colors flex flex-col justify-between space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  0{st.step}
                </span>
                <StepIcon className="w-4 h-4 text-primary" />
              </div>
              <div className="space-y-0.5">
                <h3 className="font-semibold text-xs text-foreground">{st.name}</h3>
                <p className="text-[11px] text-primary/80 font-medium">{st.title}</p>
                <p className="text-[11px] text-muted-foreground line-clamp-2 leading-tight pt-1">
                  {st.desc}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
