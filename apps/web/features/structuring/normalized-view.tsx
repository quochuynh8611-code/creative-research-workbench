'use client'

import React from 'react'
import { Edit3, CheckCircle, Sparkles, FileText, ArrowRight } from 'lucide-react'
import { ContradictionBadge } from './contradiction-badge'
import type { ProblemFrame } from '@/lib/types'

interface NormalizedViewProps {
  problemFrame: ProblemFrame
  onEditIntake?: () => void
  onProceedToRetrieval?: () => void
}

export function NormalizedView({
  problemFrame,
  onEditIntake,
  onProceedToRetrieval,
}: NormalizedViewProps) {
  const statement = problemFrame.normalized_statement || problemFrame.raw_statement

  return (
    <div className="space-y-6">
      {/* Header card with structured statement */}
      <div className="p-6 rounded-xl border border-border bg-card/60 backdrop-blur-sm shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h3 className="text-base font-semibold text-foreground">
              Bài toán đã chuẩn hóa (Normalized Problem Statement)
            </h3>
          </div>
          {onEditIntake && (
            <button
              onClick={onEditIntake}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md hover:bg-muted transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Chỉnh sửa bài toán
            </button>
          )}
        </div>

        <div className="p-4 rounded-lg bg-muted/40 border border-border/50 text-sm leading-relaxed text-foreground font-medium">
          {statement}
        </div>

        {problemFrame.normalized_statement && problemFrame.raw_statement !== problemFrame.normalized_statement && (
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" /> Mô tả gốc từ người dùng:
            </span>
            <p className="text-xs text-muted-foreground italic pl-4 border-l-2 border-border">
              &ldquo;{problemFrame.raw_statement}&rdquo;
            </p>
          </div>
        )}
      </div>

      {/* Contradiction Analysis Card */}
      <div className="p-6 rounded-xl border border-border bg-card/60 backdrop-blur-sm shadow-sm space-y-4">
        <div>
          <h3 className="text-base font-semibold text-foreground mb-1">
            Phân tích mâu thuẫn TRIZ (Contradiction Analysis)
          </h3>
          <p className="text-xs text-muted-foreground">
            Hệ thống tự động phát hiện mâu thuẫn cốt lõi và ánh xạ các thông số kỹ thuật/vật lý.
          </p>
        </div>

        <ContradictionBadge
          type={problemFrame.contradiction_type}
          improvingParameter={problemFrame.improving_parameter}
          worseningParameter={problemFrame.worsening_parameter}
        />
      </div>

      {/* Action Footer */}
      {onProceedToRetrieval && (
        <div className="flex justify-end pt-2">
          <button
            onClick={onProceedToRetrieval}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-all shadow-sm"
          >
            <span>Tiến hành tra cứu tài liệu & nguyên tắc</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
