'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { HelpCircle, AlertCircle, RefreshCw, Bookmark } from 'lucide-react'
import { getTrizNineWindows } from '@/lib/api-client'
import { validateTriz9WindowsContext } from '@/lib/triz-9-windows-context-validator'
import type { TrizNineWindowsLens, TrizNineWindowsResponse, NoteDraft } from '@/lib/types'

const LEVEL_LABELS: Record<string, string> = {
  supersystem: 'Siêu hệ thống',
  system: 'Hệ thống',
  subsystem: 'Phân hệ',
}

const TIME_LABELS: Record<string, string> = {
  past: 'Quá khứ',
  present: 'Hiện tại',
  future: 'Tương lai',
}

const LENSES: { key: TrizNineWindowsLens; label: string }[] = [
  { key: 'engineering', label: 'Kỹ thuật' },
  { key: 'business', label: 'Kinh doanh' },
  { key: 'everyday', label: 'Đời sống' },
]

interface TrizNineWindowsProps {
  onSaveAsNote?: (draft: NoteDraft) => void
  initialLens?: TrizNineWindowsLens
}

export function TrizNineWindows({
  onSaveAsNote,
  initialLens,
}: TrizNineWindowsProps = {}) {
  const [activeLens, setActiveLens] = useState<TrizNineWindowsLens>(
    initialLens ?? 'engineering',
  )
  const [cellError, setCellError] = useState<string | null>(null)

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<TrizNineWindowsResponse>({
    queryKey: ['triz', 'nine-windows', activeLens],
    queryFn: () => getTrizNineWindows(activeLens),
    placeholderData: (previousData) => previousData,
  })

  return (
    <div className="space-y-6">
      {/* Header & Lens Selector */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Sơ đồ 9 Màn hình TRIZ (System Operator)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Khung phân tích đa chiều mở rộng không gian và thời gian của hệ thống
          </p>
        </div>

        {/* Lens Segmented Controls */}
        <div
          role="group"
          aria-label="Chọn lăng kính TRIZ"
          className="inline-flex items-center rounded-lg border border-border p-1 bg-muted/40 self-start md:self-auto"
        >
          {LENSES.map(({ key, label }) => {
            const isActive = activeLens === key
            return (
              <button
                key={key}
                type="button"
                aria-pressed={isActive ? 'true' : 'false'}
                onClick={() => setActiveLens(key)}
                className={`px-3 py-1.5 text-xs md:text-sm font-medium rounded-md transition-all focus-visible:ring-2 focus-visible:ring-primary focus:outline-none ${
                  isActive
                    ? 'bg-background text-foreground shadow-sm font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Cell Validation Error Alert */}
      {cellError && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-destructive text-xs flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{cellError}</span>
          </div>
          <button
            type="button"
            onClick={() => setCellError(null)}
            className="text-destructive hover:underline text-[11px] font-medium cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Loading Skeleton State */}
      {isLoading && (
        <div data-testid="nine-windows-loading" className="space-y-4">
          <div className="hidden md:grid md:grid-cols-3 gap-4">
            {[1, 2, 3].map((col) => (
              <div key={col} className="h-6 bg-muted/50 rounded animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((cell) => (
              <div
                key={cell}
                className="h-44 rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3 animate-pulse"
              >
                <div className="h-4 w-24 bg-muted/60 rounded" />
                <div className="h-5 w-3/4 bg-muted/60 rounded" />
                <div className="h-12 w-full bg-muted/40 rounded" />
                <div className="h-4 w-5/6 bg-muted/30 rounded" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Alert State */}
      {isError && (
        <div
          data-testid="nine-windows-error"
          className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-destructive space-y-4"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <h3 className="font-semibold text-sm">Không thể tải dữ liệu 9 Cửa sổ TRIZ</h3>
              <p className="text-xs text-destructive/90">
                {error instanceof Error ? error.message : 'Đã có lỗi xảy ra khi truy vấn dữ liệu từ máy chủ.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors focus-visible:ring-2 focus-visible:ring-destructive focus:outline-none"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Thử lại
          </button>
        </div>
      )}

      {/* Success Grid Content */}
      {!isLoading && !isError && data && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              {data.lens_title}
            </h2>
            <span className="text-xs text-muted-foreground">
              9/9 cửa sổ canonical
            </span>
          </div>

          {/* Desktop Column Headers (Time Horizons) */}
          <div className="hidden md:grid md:grid-cols-3 gap-4 px-1 text-center font-semibold text-xs tracking-wider uppercase text-muted-foreground">
            <div>Quá khứ (Past)</div>
            <div>Hiện tại (Present)</div>
            <div>Tương lai (Future)</div>
          </div>

          {/* Single DOM Responsive Grid:
              - Mobile (<768px): 1 column stacked cards (supersystem -> system -> subsystem; past -> present -> future)
              - Desktop (>=768px): 3 columns matrix (Row 1: supersystem, Row 2: system, Row 3: subsystem)
          */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.grid.map((cell, idx) => {
              const levelLabel = LEVEL_LABELS[cell.level] ?? cell.level
              const timeLabel = TIME_LABELS[cell.time] ?? cell.time
              const accessibleLabel = `${levelLabel} • ${timeLabel}: ${cell.label_vi}`

              return (
                <article
                  key={`${cell.level}-${cell.time}-${idx}`}
                  role="article"
                  aria-label={accessibleLabel}
                  className="rounded-xl border border-border bg-card/80 p-4 flex flex-col justify-between shadow-xs hover:border-primary/40 transition-colors"
                >
                  <div className="space-y-2.5">
                    {/* Badge Tọa độ */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                        {levelLabel} • {timeLabel}
                      </span>
                    </div>

                    {/* Titles */}
                    <div>
                      <h3 className="font-bold text-sm text-foreground leading-snug">
                        {cell.label_vi}
                      </h3>
                      {cell.label_en && (
                        <p className="text-xs text-muted-foreground italic mt-0.5">
                          {cell.label_en}
                        </p>
                      )}
                    </div>

                    {/* Prompt tư duy */}
                    <div className="rounded-lg bg-primary/5 border border-primary/10 p-2.5 text-xs text-foreground/90 flex items-start gap-2">
                      <HelpCircle className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                      <p className="leading-relaxed font-medium">{cell.prompt_vi}</p>
                    </div>

                    {/* Mô tả chi tiết */}
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {cell.description_vi}
                    </p>
                  </div>

                  {/* Examples List (chỉ render khi có phần tử) */}
                  {cell.examples_vi && cell.examples_vi.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-border/50">
                      <span className="text-[11px] font-semibold text-muted-foreground block mb-1">
                        Ví dụ thực tế:
                      </span>
                      <ul
                        role="list"
                        className="list-disc list-inside space-y-1 text-xs text-muted-foreground"
                      >
                        {cell.examples_vi.map((example, i) => (
                          <li key={i} className="leading-normal">
                            {example}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Save to Notebook Action Button */}
                  {onSaveAsNote && (
                    <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          const contextCandidate = {
                            schema_version: 1,
                            source_type: 'triz_9_windows',
                            lens: data.lens,
                            level: cell.level,
                            time: cell.time,
                            cell_label: cell.label_vi,
                          }
                          const validation = validateTriz9WindowsContext(contextCandidate)
                          if (!validation.ok) {
                            setCellError(`Dữ liệu ô không hợp lệ: ${validation.error}`)
                            return
                          }
                          setCellError(null)

                          const examplesSection =
                            cell.examples_vi && cell.examples_vi.length > 0
                              ? `\n\nVí dụ: ${cell.examples_vi.join('; ')}`
                              : ''
                          const content = `[TRIZ 9-Windows: ${data.lens_title} • ${levelLabel} - ${timeLabel}: ${cell.label_vi}]\nCâu hỏi gợi mở: ${cell.prompt_vi}\n\nĐặc điểm: ${cell.description_vi}${examplesSection}`
                          onSaveAsNote({
                            content,
                            note_type: 'insight',
                            source_chunk_id: null,
                            source_context: validation.data,
                          })
                        }}
                        aria-label={`Lưu vào sổ tay: ${levelLabel} • ${timeLabel} - ${cell.label_vi}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus:outline-none"
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                        <span>Lưu vào sổ tay</span>
                      </button>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
