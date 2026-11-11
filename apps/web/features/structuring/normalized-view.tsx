'use client'

import React, { useState } from 'react'
import { Edit3, CheckCircle, Sparkles, FileText, ArrowRight, ChevronDown, Grid3X3 } from 'lucide-react'
import { ContradictionBadge } from './contradiction-badge'
import { SeparationStrategies } from './separation-strategies'
import { TrizNineWindows } from '@/features/triz/triz-nine-windows'
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
  const [isNineWindowsExpanded, setIsNineWindowsExpanded] = useState(false)
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

      {/* Separation Strategies Card (Physical Contradictions Only) */}
      {String(problemFrame.contradiction_type || '').toLowerCase() === 'physical' && (
        <SeparationStrategies />
      )}

      {/* Collapsible TRIZ 9-Windows Section */}
      <div className="rounded-xl border border-border bg-card/60 backdrop-blur-sm shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setIsNineWindowsExpanded((prev) => !prev)}
          aria-expanded={isNineWindowsExpanded}
          aria-controls="nine-windows-collapsible-content"
          aria-label="Mở rộng góc nhìn hệ thống đa chiều (TRIZ 9-Windows)"
          className="w-full flex items-center justify-between p-5 text-left hover:bg-muted/30 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus:outline-none cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Grid3X3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Mở rộng góc nhìn hệ thống đa chiều (TRIZ 9-Windows)
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Khung ma trận 3x3 mở rộng bối cảnh siêu hệ thống, hệ thống và phân hệ qua trục thời gian
              </p>
            </div>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground transition-transform duration-200 shrink-0 ml-2 ${
              isNineWindowsExpanded ? 'rotate-180' : ''
            }`}
          />
        </button>

        {isNineWindowsExpanded && (
          <div
            id="nine-windows-collapsible-content"
            className="p-6 border-t border-border bg-background/50 space-y-4"
          >
            <TrizNineWindows />
          </div>
        )}
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
