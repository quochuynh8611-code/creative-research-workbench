'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import {
  Sparkles,
  Inbox,
  GitFork,
  X,
  ArrowRight,
  Plus,
  Loader2,
  CheckCircle2,
} from 'lucide-react'
import { getSessionTemplates, createSessionFromTemplate } from '@/lib/api-client'
import type { SessionTemplate } from '@/lib/types'

export interface WelcomeOnboardingModalProps {
  isOpen: boolean
  onClose: () => void
  onOpenCreateForm?: () => void
}

const ONBOARDING_STORAGE_KEY = 'crw_onboarding_dismissed'

export function WelcomeOnboardingModal({
  isOpen,
  onClose,
  onOpenCreateForm,
}: WelcomeOnboardingModalProps) {
  let router: any = null
  try {
    router = useRouter()
  } catch {
    router = null
  }

  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Handle ESC key to dismiss
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleDismiss()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const handleDismiss = () => {
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true')
    } catch {
      // Ignore storage errors in restricted contexts
    }
    onClose()
  }

  const handleManualCreate = () => {
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true')
    } catch {
      // Ignore storage errors
    }
    onClose()
    if (onOpenCreateForm) {
      onOpenCreateForm()
    }
  }

  const quickStartMutation = useMutation({
    mutationFn: async () => {
      setErrorMessage(null)
      const templates =
        typeof getSessionTemplates === 'function' ? await getSessionTemplates() : []
      if (!Array.isArray(templates) || templates.length === 0) {
        throw new Error('Không tìm thấy danh sách mẫu nghiên cứu từ hệ thống.')
      }

      // Priority 1: business_delivery_speed_cost
      let selectedTemplate: SessionTemplate | undefined = templates.find(
        (t) =>
          t.id === 'business_delivery_speed_cost' ||
          t.id === 'tpl-business-logistics' ||
          (t.tags && t.tags.includes('logistics'))
      )

      // Fallback 2: personal_healthy_meal_time_cost
      if (!selectedTemplate) {
        selectedTemplate = templates.find(
          (t) =>
            t.id === 'personal_healthy_meal_time_cost' ||
            t.id === 'tpl-personal-nutrition' ||
            (t.tags && t.tags.includes('nutrition'))
        )
      }

      // Fallback 3: first available template
      if (!selectedTemplate && templates.length > 0) {
        selectedTemplate = templates[0]
      }

      if (!selectedTemplate) {
        throw new Error('Không thể chọn mẫu bài toán hợp lệ.')
      }

      const newSession = await createSessionFromTemplate({
        template_id: selectedTemplate.id,
      })
      return newSession
    },
    onSuccess: (newSession) => {
      try {
        localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true')
      } catch {
        // Ignore storage errors
      }
      onClose()
      if (router && newSession?.id) {
        router.push(`/sessions/${newSession.id}`)
      }
    },
    onError: (err: Error) => {
      setErrorMessage(err.message || 'Không thể khởi tạo bài toán mẫu.')
    },
  })

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-onboarding-title"
      aria-describedby="welcome-onboarding-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl p-6 sm:p-8 space-y-6">
        {/* Header & Close Button */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Hướng Dẫn Khởi Đầu</span>
            </div>
            <h2
              id="welcome-onboarding-title"
              className="text-xl sm:text-2xl font-bold tracking-tight text-foreground"
            >
              Chào mừng bạn đến với Creative Research Workbench
            </h2>
            <p
              id="welcome-onboarding-desc"
              className="text-sm text-muted-foreground"
            >
              Giải quyết bài toán phức tạp và phát kiến giải pháp đột phá trong 3 bước kết hợp TRIZ & AI Coach.
            </p>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Đóng hướng dẫn"
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Sequential Core Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {/* Step 1 */}
          <div className="p-4 rounded-lg border border-border bg-muted/40 space-y-2">
            <div className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center">
              <Inbox className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-sm text-foreground">
              1. Định nghĩa bài toán
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Mô tả mục tiêu mong muốn và nhận diện rào cản ngăn cách trong thực tế.
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-4 rounded-lg border border-border bg-muted/40 space-y-2">
            <div className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center">
              <GitFork className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-sm text-foreground">
              2. Chuẩn hóa mâu thuẫn
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Phát biểu mâu thuẫn TRIZ: thông số muốn cải thiện vs thông số bị xấu đi.
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-4 rounded-lg border border-border bg-muted/40 space-y-2">
            <div className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-sm text-foreground">
              3. Gợi ý AI Coach & Hành động
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Nhận gợi ý có căn cứ (Hard Grounding), lưu giải pháp ứng viên và xuất kế hoạch.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 text-xs rounded-md bg-destructive/10 text-destructive border border-destructive/20">
            {errorMessage}
          </div>
        )}

        {/* Action Buttons Footer */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border">
          <button
            type="button"
            onClick={handleDismiss}
            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Bỏ qua
          </button>

          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleManualCreate}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-input bg-background hover:bg-muted text-foreground transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Tự tạo phiên nghiên cứu</span>
            </button>

            <button
              type="button"
              onClick={() => quickStartMutation.mutate()}
              disabled={quickStartMutation.isPending}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {quickStartMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang khởi tạo...</span>
                </>
              ) : (
                <>
                  <span>Bắt đầu nhanh với bài toán mẫu</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
