'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Archive,
  Download,
  X,
  AlertTriangle,
  Loader2,
  FileText,
  FileCode,
  Files,
  Tag,
  Calendar,
  Layers,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { batchExportSessions } from '@/lib/api-client'
import type { BatchExportFilter, BatchExportFormat, BatchExportRequest } from '@/lib/types'

export interface BatchExportModalProps {
  isOpen: boolean
  onClose: () => void
  selectedSessionIds?: string[]
  initialFilters?: BatchExportFilter
  totalCount?: number
  triggerRef?: React.RefObject<HTMLElement | null>
  onSuccess?: (exportedCount?: number) => void
}

export function BatchExportModal({
  isOpen,
  onClose,
  selectedSessionIds = [],
  initialFilters = {},
  totalCount,
  triggerRef,
  onSuccess,
}: BatchExportModalProps) {
  const [format, setFormat] = useState<BatchExportFormat>('both')
  const [archiveAfterExport, setArchiveAfterExport] = useState(false)

  // Filter criteria state (for filter-based export mode)
  const isExplicitMode = selectedSessionIds.length > 0
  const [tag, setTag] = useState(initialFilters.tag || '')
  const [dateFrom, setDateFrom] = useState(initialFilters.date_from || '')
  const [dateTo, setDateTo] = useState(initialFilters.date_to || '')

  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const modalRef = useRef<HTMLDivElement>(null)
  const firstFocusableRef = useRef<HTMLButtonElement>(null)

  // Focus trap and escape key handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!isLoading) {
          onClose()
        }
        return
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault()
            lastElement?.focus()
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault()
            firstElement?.focus()
          }
        }
      }
    },
    [isLoading, onClose]
  )

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      // Focus the first element inside the modal
      setTimeout(() => {
        firstFocusableRef.current?.focus()
      }, 50)
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (triggerRef?.current) {
        triggerRef.current.focus()
      }
    }
  }, [isOpen, handleKeyDown, triggerRef])

  if (!isOpen) return null

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const requestPayload: BatchExportRequest = {
        format,
        archive_after_export: archiveAfterExport,
      }

      if (isExplicitMode) {
        requestPayload.session_ids = selectedSessionIds
      } else {
        const filters: BatchExportFilter = {
          ...initialFilters,
        }
        if (tag.trim()) {
          filters.tag = tag.trim().replace(/^#/, '')
        }
        if (dateFrom) {
          filters.date_from = new Date(dateFrom).toISOString()
        }
        if (dateTo) {
          filters.date_to = new Date(dateTo).toISOString()
        }
        requestPayload.filters = filters
      }

      const blob = await batchExportSessions(requestPayload)

      // Direct client download trigger
      const url = window.URL.createObjectURL(blob)
      const downloadAnchor = document.createElement('a')
      downloadAnchor.href = url
      const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
      downloadAnchor.download = `creative-research-archive-${timestamp}.zip`
      document.body.appendChild(downloadAnchor)
      downloadAnchor.click()
      document.body.removeChild(downloadAnchor)
      window.URL.revokeObjectURL(url)

      onSuccess?.(isExplicitMode ? selectedSessionIds.length : totalCount)
      onClose()
    } catch (err: any) {
      const status = err.response?.status
      const detail = err.response?.data?.detail

      if (detail && typeof detail === 'string') {
        setErrorMessage(detail)
      } else if (status === 422) {
        setErrorMessage(
          'Số lượng phiên yêu cầu vượt quá giới hạn an toàn (100 phiên). Vui lòng thu hẹp bộ lọc ngày hoặc thẻ.'
        )
      } else if (status === 404) {
        setErrorMessage('Không tìm thấy phiên nghiên cứu nào phù hợp với tiêu chí xuất.')
      } else if (err instanceof TypeError || err.message?.includes('fetch') || err.message?.includes('NetworkError')) {
        setErrorMessage('Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại kết nối mạng.')
      } else {
        setErrorMessage(err.message || 'Lỗi khi xuất tệp lưu trữ. Vui lòng thử lại.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-export-modal-title"
      aria-describedby="batch-export-modal-description"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) {
          onClose()
        }
      }}
    >
      <div
        ref={modalRef}
        className="bg-card border border-border rounded-xl max-w-lg w-full p-6 shadow-xl space-y-5 animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <h3 id="batch-export-modal-title" className="text-base font-semibold text-foreground">
                Xuất Lưu Trữ Hàng Loạt (Batch Export)
              </h3>
              <p id="batch-export-modal-description" className="text-xs text-muted-foreground mt-0.5">
                {isExplicitMode
                  ? `Đang xuất ${selectedSessionIds.length} phiên nghiên cứu đã chọn ra tệp nén ZIP.`
                  : 'Xuất theo bộ lọc tìm kiếm ra tệp nén ZIP (Tối đa 100 phiên).'}
              </p>
            </div>
          </div>
          <button
            ref={firstFocusableRef}
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors disabled:opacity-50"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 text-xs"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold">Lỗi xuất tệp nén</p>
              <p className="leading-relaxed">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleExport} className="space-y-4">
          {/* Format Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-muted-foreground" />
              Định dạng đóng gói trong tệp ZIP
            </label>
            <div className="grid grid-cols-3 gap-2">
              <label
                className={cn(
                  'flex flex-col items-center justify-center p-3 rounded-lg border text-center cursor-pointer transition-all',
                  format === 'both'
                    ? 'border-primary bg-primary/5 text-primary font-medium'
                    : 'border-border/60 hover:bg-muted/50 text-muted-foreground'
                )}
              >
                <input
                  type="radio"
                  name="exportFormat"
                  value="both"
                  checked={format === 'both'}
                  onChange={() => setFormat('both')}
                  className="sr-only"
                />
                <Files className="w-4 h-4 mb-1" />
                <span className="text-xs">Cả hai (.md & .json)</span>
              </label>

              <label
                className={cn(
                  'flex flex-col items-center justify-center p-3 rounded-lg border text-center cursor-pointer transition-all',
                  format === 'markdown'
                    ? 'border-primary bg-primary/5 text-primary font-medium'
                    : 'border-border/60 hover:bg-muted/50 text-muted-foreground'
                )}
              >
                <input
                  type="radio"
                  name="exportFormat"
                  value="markdown"
                  checked={format === 'markdown'}
                  onChange={() => setFormat('markdown')}
                  className="sr-only"
                />
                <FileText className="w-4 h-4 mb-1" />
                <span className="text-xs">Chỉ tài liệu Markdown</span>
              </label>

              <label
                className={cn(
                  'flex flex-col items-center justify-center p-3 rounded-lg border text-center cursor-pointer transition-all',
                  format === 'json'
                    ? 'border-primary bg-primary/5 text-primary font-medium'
                    : 'border-border/60 hover:bg-muted/50 text-muted-foreground'
                )}
              >
                <input
                  type="radio"
                  name="exportFormat"
                  value="json"
                  checked={format === 'json'}
                  onChange={() => setFormat('json')}
                  className="sr-only"
                />
                <FileCode className="w-4 h-4 mb-1" />
                <span className="text-xs">Chỉ bản snapshot JSON</span>
              </label>
            </div>
          </div>

          {/* Additional Filter Criteria (when filter-based mode) */}
          {!isExplicitMode && (
            <div className="p-3 rounded-lg bg-muted/40 border border-border/40 space-y-3">
              <div className="space-y-1">
                <label
                  htmlFor="batch-export-tag"
                  className="text-xs font-medium text-foreground flex items-center gap-1.5"
                >
                  <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                  Lọc theo thẻ ghi chép (#tag)
                </label>
                <input
                  id="batch-export-tag"
                  type="text"
                  placeholder="Ví dụ: pin-lithium, tan-nhiet..."
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-md border border-border bg-background focus:outline-hidden focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label
                    htmlFor="batch-export-date-from"
                    className="text-xs font-medium text-foreground flex items-center gap-1.5"
                  >
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    Từ ngày
                  </label>
                  <input
                    id="batch-export-date-from"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full text-xs px-2 py-1.5 rounded-md border border-border bg-background focus:outline-hidden focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="batch-export-date-to"
                    className="text-xs font-medium text-foreground flex items-center gap-1.5"
                  >
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    Đến ngày
                  </label>
                  <input
                    id="batch-export-date-to"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full text-xs px-2 py-1.5 rounded-md border border-border bg-background focus:outline-hidden focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Archive After Export Checkbox */}
          <div className="pt-1">
            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-foreground select-none">
              <input
                type="checkbox"
                checked={archiveAfterExport}
                onChange={(e) => setArchiveAfterExport(e.target.checked)}
                className="mt-0.5 rounded-sm border-border text-primary focus:ring-primary h-4 w-4"
              />
              <div className="space-y-0.5">
                <span className="font-medium text-foreground">
                  Đồng thời chuyển sang Đã lưu trữ (Archived) sau khi xuất
                </span>
                <p className="text-[11px] text-muted-foreground leading-normal">
                  Dữ liệu được bảo toàn nguyên vẹn và bạn có thể khôi phục lại bất kỳ lúc nào từ tab
                  &quot;Đã lưu trữ&quot;.
                </p>
              </div>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/40">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang nén dữ liệu...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải xuống tệp ZIP</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
