/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { BatchExportModal } from '../batch-export-modal'
import * as apiClient from '@/lib/api-client'

jest.mock('@/lib/api-client', () => ({
  ...jest.requireActual('@/lib/api-client'),
  batchExportSessions: jest.fn(),
}))

describe('C39 Lô 2: BatchExportModal Specification (WCAG 2.1 AA & Resilience)', () => {
  const dummyBlob = new Blob(['PK fake zip binary content'], { type: 'application/zip' })
  let originalCreateObjectURL: typeof window.URL.createObjectURL
  let originalRevokeObjectURL: typeof window.URL.revokeObjectURL
  let mockClick: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    originalCreateObjectURL = window.URL.createObjectURL
    originalRevokeObjectURL = window.URL.revokeObjectURL
    window.URL.createObjectURL = jest.fn(() => 'blob:http://test/fake-zip')
    window.URL.revokeObjectURL = jest.fn()
    mockClick = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  afterEach(() => {
    window.URL.createObjectURL = originalCreateObjectURL
    window.URL.revokeObjectURL = originalRevokeObjectURL
    mockClick.mockRestore()
  })

  describe('1. Trợ Năng & Quản Lý Modal (WCAG 2.1 AA Accessibility)', () => {
    it('1.1 Không render gì khi isOpen=false', () => {
      render(
        <BatchExportModal
          isOpen={false}
          onClose={jest.fn()}
          selectedSessionIds={['s1', 's2']}
        />
      )
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('1.2 Hiển thị role="dialog", aria-modal="true" và aria-labelledby khi isOpen=true', () => {
      render(
        <BatchExportModal
          isOpen={true}
          onClose={jest.fn()}
          selectedSessionIds={['s1', 's2']}
        />
      )
      const dialog = screen.getByRole('dialog')
      expect(dialog).toBeInTheDocument()
      expect(dialog).toHaveAttribute('aria-modal', 'true')
      expect(dialog).toHaveAttribute('aria-labelledby', 'batch-export-modal-title')
      expect(screen.getByText(/Xuất Lưu Trữ Hàng Loạt/i)).toBeInTheDocument()
    })

    it('1.3 Đóng modal khi nhấn phím Escape', () => {
      const handleClose = jest.fn()
      render(
        <BatchExportModal
          isOpen={true}
          onClose={handleClose}
          selectedSessionIds={['s1']}
        />
      )
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(handleClose).toHaveBeenCalledTimes(1)
    })

    it('1.4 Phục hồi tiêu điểm (Focus Restore) về trigger element khi đóng modal', () => {
      const triggerBtn = document.createElement('button')
      triggerBtn.textContent = 'Mở Export'
      document.body.appendChild(triggerBtn)
      triggerBtn.focus()
      expect(document.activeElement).toBe(triggerBtn)

      const handleClose = jest.fn()
      const { unmount } = render(
        <BatchExportModal
          isOpen={true}
          onClose={handleClose}
          selectedSessionIds={['s1']}
          triggerRef={{ current: triggerBtn }}
        />
      )

      // Đóng modal
      const closeBtn = screen.getByRole('button', { name: /Đóng/i })
      fireEvent.click(closeBtn)
      expect(handleClose).toHaveBeenCalled()

      unmount()
      expect(document.activeElement).toBe(triggerBtn)
      document.body.removeChild(triggerBtn)
    })
  })

  describe('2. Chế Độ Chọn Thủ Công & Lựa Chọn Định Dạng', () => {
    it('2.1 Hiển thị đúng số lượng phiên đã chọn thủ công và gửi format="both" mặc định', async () => {
      const mockExport = jest.spyOn(apiClient, 'batchExportSessions').mockResolvedValueOnce(dummyBlob)
      const handleClose = jest.fn()

      render(
        <BatchExportModal
          isOpen={true}
          onClose={handleClose}
          selectedSessionIds={['sess-uuid-1', 'sess-uuid-2', 'sess-uuid-3']}
        />
      )

      expect(screen.getByText(/Đang xuất 3 phiên nghiên cứu đã chọn/i)).toBeInTheDocument()

      // Submit xuất
      const submitBtn = screen.getByRole('button', { name: /Tải xuống tệp ZIP/i })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(mockExport).toHaveBeenCalledWith({
          session_ids: ['sess-uuid-1', 'sess-uuid-2', 'sess-uuid-3'],
          format: 'both',
          archive_after_export: false,
        })
      })
      expect(window.URL.createObjectURL).toHaveBeenCalledWith(dummyBlob)
    })

    it('2.2 Cho phép chọn định dạng Markdown (.md) hoặc JSON snapshot (.json)', async () => {
      const mockExport = jest.spyOn(apiClient, 'batchExportSessions').mockResolvedValueOnce(dummyBlob)

      render(
        <BatchExportModal
          isOpen={true}
          onClose={jest.fn()}
          selectedSessionIds={['sess-uuid-1']}
        />
      )

      // Chọn định dạng Markdown
      const mdRadio = screen.getByLabelText(/Chỉ tài liệu Markdown/i)
      fireEvent.click(mdRadio)

      const submitBtn = screen.getByRole('button', { name: /Tải xuống tệp ZIP/i })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(mockExport).toHaveBeenCalledWith(
          expect.objectContaining({
            format: 'markdown',
          })
        )
      })
    })

    it('2.3 Hỗ trợ tùy chọn archive_after_export, mặc định là false', async () => {
      const mockExport = jest.spyOn(apiClient, 'batchExportSessions').mockResolvedValueOnce(dummyBlob)

      render(
        <BatchExportModal
          isOpen={true}
          onClose={jest.fn()}
          selectedSessionIds={['sess-uuid-1']}
        />
      )

      const archiveCheckbox = screen.getByLabelText(/Đồng thời chuyển sang Đã lưu trữ/i)
      expect(archiveCheckbox).not.toBeChecked()

      // Tích chọn archive
      fireEvent.click(archiveCheckbox)
      expect(archiveCheckbox).toBeChecked()

      const submitBtn = screen.getByRole('button', { name: /Tải xuống tệp ZIP/i })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(mockExport).toHaveBeenCalledWith(
          expect.objectContaining({
            archive_after_export: true,
          })
        )
      })
    })
  })

  describe('3. Chế Độ Xuất Theo Bộ Lọc (Filter-Based Export)', () => {
    it('3.1 Khi không có session_ids được chọn, cho phép xuất theo bộ lọc (filters)', async () => {
      const mockExport = jest.spyOn(apiClient, 'batchExportSessions').mockResolvedValueOnce(dummyBlob)

      render(
        <BatchExportModal
          isOpen={true}
          onClose={jest.fn()}
          initialFilters={{
            status: 'active',
            domain: 'business',
            q: 'ST25',
          }}
        />
      )

      expect(screen.getByText(/Xuất theo bộ lọc tìm kiếm/i)).toBeInTheDocument()

      // Nhập tag filter
      const tagInput = screen.getByLabelText(/Lọc theo thẻ ghi chép/i)
      fireEvent.change(tagInput, { target: { value: 'pin-lithium' } })

      // Nhập khoảng ngày
      const dateFromInput = screen.getByLabelText(/Từ ngày/i)
      fireEvent.change(dateFromInput, { target: { value: '2026-01-01' } })

      const submitBtn = screen.getByRole('button', { name: /Tải xuống tệp ZIP/i })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(mockExport).toHaveBeenCalledWith({
          filters: expect.objectContaining({
            status: 'active',
            domain: 'business',
            q: 'ST25',
            tag: 'pin-lithium',
            date_from: expect.stringContaining('2026-01-01'),
          }),
          format: 'both',
          archive_after_export: false,
        })
      })
    })
  })

  describe('4. Xử Lý Lỗi & Phục Hồi Dữ Liệu (Error Handling & Resilience)', () => {
    it('4.1 Hiển thị role="alert" khi gặp lỗi HTTP 422 (Vượt quá 100 phiên) và bảo toàn form state', async () => {
      const errorObj: any = new Error('Request failed with status code 422')
      errorObj.response = {
        status: 422,
        data: {
          detail: 'Số lượng phiên phù hợp (125) vượt quá giới hạn an toàn (100 phiên). Vui lòng thu hẹp bộ lọc ngày hoặc thẻ.',
        },
      }
      jest.spyOn(apiClient, 'batchExportSessions').mockRejectedValueOnce(errorObj)

      render(
        <BatchExportModal
          isOpen={true}
          onClose={jest.fn()}
          initialFilters={{ domain: 'business' }}
        />
      )

      // Thay đổi tag và chọn archive
      const tagInput = screen.getByLabelText(/Lọc theo thẻ ghi chép/i)
      fireEvent.change(tagInput, { target: { value: 'cooling' } })
      const archiveCheckbox = screen.getByLabelText(/Đồng thời chuyển sang Đã lưu trữ/i)
      fireEvent.click(archiveCheckbox)

      const submitBtn = screen.getByRole('button', { name: /Tải xuống tệp ZIP/i })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        const alert = screen.getByRole('alert')
        expect(alert).toBeInTheDocument()
        expect(alert).toHaveTextContent(/vượt quá giới hạn an toàn \(100 phiên\)/i)
      })

      // Form state không bị mất
      expect(tagInput).toHaveValue('cooling')
      expect(archiveCheckbox).toBeChecked()
    })

    it('4.2 Hiển thị role="alert" khi gặp lỗi mạng (TypeError: Failed to fetch) và không tự động đóng modal', async () => {
      jest.spyOn(apiClient, 'batchExportSessions').mockRejectedValueOnce(new TypeError('Failed to fetch'))

      render(
        <BatchExportModal
          isOpen={true}
          onClose={jest.fn()}
          selectedSessionIds={['s1']}
        />
      )

      const submitBtn = screen.getByRole('button', { name: /Tải xuống tệp ZIP/i })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        const alert = screen.getByRole('alert')
        expect(alert).toBeInTheDocument()
        expect(alert).toHaveTextContent(/Không thể kết nối đến máy chủ/i)
      })

      // Modal vẫn mở
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })
})
