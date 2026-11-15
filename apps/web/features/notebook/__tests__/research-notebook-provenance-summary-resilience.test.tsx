/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, within, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ResearchNotebook } from '../research-notebook'
import * as apiClient from '@/lib/api-client'
import type {
  ResearchNotesResponse,
  ResearchNote,
  TrizMatrixSourceContext,
} from '@/lib/types'

jest.mock('@/lib/api-client', () => ({
  listResearchNotes: jest.fn(),
  createResearchNote: jest.fn(),
  deleteResearchNote: jest.fn(),
}))

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

const defaultProps = {
  sessionId: 'ses-resilience-test',
  initialDraft: null,
  content: '',
  noteType: 'insight' as const,
  onContentChange: jest.fn(),
  onNoteTypeChange: jest.fn(),
  onClearDraft: jest.fn(),
  onNoteCreated: jest.fn(),
}

describe('Batch C10: ResearchNotebook Provenance Summary Resilience Tests', () => {
  const originalCreateObjectURL = window.URL.createObjectURL
  const originalRevokeObjectURL = window.URL.revokeObjectURL

  let mockCreateObjectURL: jest.Mock
  let mockRevokeObjectURL: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    mockCreateObjectURL = jest.fn(() => 'blob:mock-url')
    mockRevokeObjectURL = jest.fn()
    window.URL.createObjectURL = mockCreateObjectURL
    window.URL.revokeObjectURL = mockRevokeObjectURL
  })

  afterEach(() => {
    jest.useRealTimers()
    window.URL.createObjectURL = originalCreateObjectURL
    window.URL.revokeObjectURL = originalRevokeObjectURL
  })

  function renderWithNotes(notes: ResearchNote[]) {
    const mockResponse: ResearchNotesResponse = {
      data: notes,
      meta: { total: notes.length },
    }
    ;(apiClient.listResearchNotes as jest.Mock).mockResolvedValueOnce(mockResponse)

    const queryClient = createTestQueryClient()
    return render(
      <QueryClientProvider client={queryClient}>
        <ResearchNotebook {...defaultProps} />
      </QueryClientProvider>
    )
  }

  describe('Scenario 1: Show an empty state without notes', () => {
    it('hiển thị thông điệp empty-state rõ ràng khi phiên không có ghi chú', async () => {
      renderWithNotes([])

      expect(await screen.findByText('Chưa có ghi chú nào trong phiên này')).toBeInTheDocument()
    })

    it('ẩn hoặc vô hiệu hóa các thao tác export và không kích hoạt request download', async () => {
      renderWithNotes([])
      expect(await screen.findByText('Chưa có ghi chú nào trong phiên này')).toBeInTheDocument()

      // Các nút export (Sao chép, Xuất CSV, Xuất JSON) không hiển thị trong DOM
      expect(screen.queryByRole('button', { name: /sao chép tổng hợp/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /xuất csv/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /xuất json/i })).not.toBeInTheDocument()

      // Không có lời gọi tạo URL tải tệp
      expect(mockCreateObjectURL).not.toHaveBeenCalled()
    })
  })

  describe('Scenario 2: Show an empty state without valid source contexts', () => {
    const notesOnlyManualAndInvalid: ResearchNote[] = [
      {
        id: 'note-manual-1',
        session_id: 'ses-resilience-test',
        content: 'Ghi chú thủ công thuần túy',
        note_type: 'insight',
        source_context: null,
        created_at: '2026-10-01T08:00:00Z',
      },
      {
        id: 'note-invalid-1',
        session_id: 'ses-resilience-test',
        content: 'Ghi chú nguồn lỗi',
        note_type: 'hypothesis',
        source_context: {
          schema_version: 99,
          source_type: 'unknown_source',
        },
        created_at: '2026-10-01T08:10:00Z',
      },
    ]

    it('hiển thị thông báo rõ ràng khi có ghi chú nhưng không có ngữ cảnh nguồn hợp lệ nào', async () => {
      renderWithNotes(notesOnlyManualAndInvalid)
      expect(await screen.findByText('Ghi chú thủ công thuần túy')).toBeInTheDocument()

      const summaryPanel = screen.getByLabelText('Tổng quan nguồn gốc ghi chú')
      expect(summaryPanel).toBeInTheDocument()

      // Phải có thông báo guidance chỉ ra chưa có nguồn được xác thực
      expect(
        within(summaryPanel).getByText(/chưa có ghi chú nào từ nguồn được xác thực|chưa có nguồn gốc được xác thực/i)
      ).toBeInTheDocument()
    })

    it('vẫn hiển thị đúng nhóm thủ công/invalid (Thủ công: 2) và cho phép export dữ liệu hiện có', async () => {
      const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

      renderWithNotes(notesOnlyManualAndInvalid)
      expect(await screen.findByText('Ghi chú thủ công thuần túy')).toBeInTheDocument()

      const summaryPanel = screen.getByLabelText('Tổng quan nguồn gốc ghi chú')
      expect(within(summaryPanel).getByText(/Thủ công:\s*2/)).toBeInTheDocument()

      // Nút xuất CSV vẫn khả dụng và xuất được dữ liệu summary hiện có
      const exportCsvBtn = within(summaryPanel).getByRole('button', { name: /xuất csv/i })
      await act(async () => {
        fireEvent.click(exportCsvBtn)
      })

      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1)
      clickSpy.mockRestore()
    })
  })

  describe('Scenario 3: Handle unreadable summary data safely', () => {
    it('hiển thị non-blocking error state khi dữ liệu summary bị malformed mà Research Notebook vẫn dùng được', async () => {
      // Mock dữ liệu lỗi (data chứa phần tử corrupted khiến validator/parsing throw exception)
      const corruptedResponse = {
        data: [
          {
            id: 'note-corrupted',
            session_id: 'ses-resilience-test',
            content: 'Ghi chú bình thường',
            note_type: 'insight' as const,
            source_context: {
              get source_type() {
                throw new Error('Fatal source_type read error')
              },
            },
            created_at: '2026-10-01T08:00:00Z',
          } as unknown as ResearchNote,
        ],
        meta: { total: 1 },
      }
      ;(apiClient.listResearchNotes as jest.Mock).mockResolvedValueOnce(corruptedResponse)

      const queryClient = createTestQueryClient()
      render(
        <QueryClientProvider client={queryClient}>
          <ResearchNotebook {...defaultProps} />
        </QueryClientProvider>
      )

      expect(await screen.findByText('Ghi chú bình thường')).toBeInTheDocument()

      // Hiển thị non-blocking error state trong Summary Panel
      expect(screen.getByText(/không thể tổng hợp dữ liệu nguồn gốc/i)).toBeInTheDocument()

      // Các nút export bị ẩn một cách an toàn để tránh xuất dữ liệu hỏng và không gây crash
      expect(screen.queryByRole('button', { name: /xuất csv/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /xuất json/i })).not.toBeInTheDocument()
      expect(mockCreateObjectURL).not.toHaveBeenCalled()

      // Form tạo ghi chú vẫn hoạt động bình thường, không crash UI
      expect(screen.getByPlaceholderText(/nhập ghi chú nghiên cứu/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /lưu ghi chú/i })).toBeInTheDocument()
    })
  })

  describe('Scenario 4: Prevent export without exportable data', () => {
    it('không kích hoạt download và hiển thị thông báo hướng dẫn khi không có dữ liệu để xuất', async () => {
      // Khi không có dữ liệu nào (ví dụ mảng rỗng nhưng nếu cố gọi action)
      renderWithNotes([])
      expect(await screen.findByText('Chưa có ghi chú nào trong phiên này')).toBeInTheDocument()

      // Không có download nào xảy ra
      expect(mockCreateObjectURL).not.toHaveBeenCalled()
    })
  })

  describe('Scenario 5: Preserve existing export behavior when valid data is present', () => {
    const validNotes: ResearchNote[] = [
      {
        id: 'note-valid-1',
        session_id: 'ses-resilience-test',
        content: 'Ghi chú TRIZ Ma trận hợp lệ',
        note_type: 'insight',
        source_context: {
          schema_version: 1,
          source_type: 'triz_matrix',
          principle_id: 35,
          improving_param_id: 1,
          worsening_param_id: 14,
          lens: 'engineering',
        } as TrizMatrixSourceContext,
        created_at: '2026-10-01T08:00:00Z',
      },
    ]

    it('giữ nguyên đầy đủ metadata, filename timestamp và không hiển thị thông báo "chưa có nguồn xác thực"', async () => {
      const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

      renderWithNotes(validNotes)
      expect(await screen.findByText('Ghi chú TRIZ Ma trận hợp lệ')).toBeInTheDocument()

      const summaryPanel = screen.getByLabelText('Tổng quan nguồn gốc ghi chú')

      // Không hiển thị thông báo "chưa có nguồn xác thực" vì đã có 1 note TRIZ Matrix
      expect(
        within(summaryPanel).queryByText(/chưa có ghi chú nào từ nguồn được xác thực|chưa có nguồn gốc được xác thực/i)
      ).not.toBeInTheDocument()

      // Thao tác xuất CSV vẫn hoạt động bình thường
      const exportCsvBtn = within(summaryPanel).getByRole('button', { name: /xuất csv/i })
      await act(async () => {
        fireEvent.click(exportCsvBtn)
      })

      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1)
      clickSpy.mockRestore()
    })
  })
})
