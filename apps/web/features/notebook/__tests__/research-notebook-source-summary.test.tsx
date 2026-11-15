/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ResearchNotebook } from '../research-notebook'
import * as apiClient from '@/lib/api-client'
import type {
  ResearchNotesResponse,
  ResearchNote,
  Triz9WindowsSourceContext,
  TrizMatrixSourceContext,
  PrincipleSuggestionSourceContext,
  EvidenceSourceContext,
  CandidateSolutionSourceContext,
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
  sessionId: 'ses-source-summary-test',
  initialDraft: null,
  content: '',
  noteType: 'insight' as const,
  onContentChange: jest.fn(),
  onNoteTypeChange: jest.fn(),
  onClearDraft: jest.fn(),
  onNoteCreated: jest.fn(),
}

describe('Batch C7c-3d: ResearchNotebook Source Provenance Summary & Export Tests (RED Phase)', () => {
  const originalClipboard = navigator.clipboard

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.useRealTimers()
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
      writable: true,
    })
  })

  function mockClipboard(writeTextFn?: (text: string) => Promise<void>) {
    const clipboardObj = writeTextFn !== undefined ? { writeText: writeTextFn } : undefined
    Object.defineProperty(navigator, 'clipboard', {
      value: clipboardObj,
      configurable: true,
      writable: true,
    })
  }

  // 1. Fixture 5 context hợp lệ theo validator contract
  const ctxTriz9Windows: Triz9WindowsSourceContext = {
    schema_version: 1,
    source_type: 'triz_9_windows',
    lens: 'engineering',
    level: 'system',
    time: 'present',
    cell_label: 'Hiện tại / Hệ thống',
  }

  const ctxTrizMatrix: TrizMatrixSourceContext = {
    schema_version: 1,
    source_type: 'triz_matrix',
    principle_id: 35,
    improving_param_id: 1,
    worsening_param_id: 14,
    lens: 'engineering',
  }

  const ctxPrincipleSuggestion: PrincipleSuggestionSourceContext = {
    schema_version: 1,
    source_type: 'principle_suggestion',
    principle_id: 10,
    method_id: 'method-triz-param-transform',
  }

  const ctxEvidence: EvidenceSourceContext = {
    schema_version: 1,
    source_type: 'evidence',
    source_ref: 'Báo cáo thử nghiệm độ bền vật liệu composite 2026',
  }

  const ctxCandidateSolution: CandidateSolutionSourceContext = {
    schema_version: 1,
    source_type: 'candidate_solution',
    solution_id: '550e8400-e29b-41d4-a716-446655440001',
    solution_status: 'accepted',
    principle_used: 35,
  }

  // 2. Bộ 7 Notes chuẩn: 5 nguồn hợp lệ + 1 thủ công null + 1 invalid context
  const MOCK_SUMMARY_NOTES: ResearchNote[] = [
    {
      id: 'note-01-triz9',
      session_id: 'ses-source-summary-test',
      content: 'Ghi chú 9 Màn hình: Quan sát hệ thống hiện tại',
      note_type: 'insight',
      source_context: ctxTriz9Windows,
      created_at: '2026-10-01T08:00:00Z',
    },
    {
      id: 'note-02-matrix',
      session_id: 'ses-source-summary-test',
      content: 'Ghi chú Ma trận TRIZ: Giả thuyết thay đổi thông số nhiệt độ',
      note_type: 'hypothesis',
      source_context: ctxTrizMatrix,
      created_at: '2026-10-01T08:10:00Z',
    },
    {
      id: 'note-03-principle',
      session_id: 'ses-source-summary-test',
      content: 'Ghi chú Gợi ý nguyên tắc: Quyết định áp dụng sơ bộ nguyên tắc 10',
      note_type: 'decision',
      source_context: ctxPrincipleSuggestion,
      created_at: '2026-10-01T08:20:00Z',
    },
    {
      id: 'note-04-evidence',
      session_id: 'ses-source-summary-test',
      content: 'Ghi chú Bằng chứng: Câu hỏi về độ tin cậy kết quả thử nghiệm composite',
      note_type: 'question',
      source_context: ctxEvidence,
      created_at: '2026-10-01T08:30:00Z',
    },
    {
      id: 'note-05-candidate',
      session_id: 'ses-source-summary-test',
      content: 'Ghi chú Giải pháp ứng viên: Hành động tích hợp module giải pháp',
      note_type: 'action',
      source_context: ctxCandidateSolution,
      created_at: '2026-10-01T08:40:00Z',
    },
    {
      id: 'note-06-manual-null',
      session_id: 'ses-source-summary-test',
      content: 'Ghi chú Thủ công: Ý tưởng do người dùng tự nhập không có nguồn',
      note_type: 'insight',
      source_context: null,
      created_at: '2026-10-01T08:50:00Z',
    },
    {
      id: 'note-07-invalid-ctx',
      session_id: 'ses-source-summary-test',
      content: 'Ghi chú Context lỗi: Dữ liệu nguồn không hợp lệ hoặc lạ',
      note_type: 'hypothesis',
      source_context: {
        schema_version: 99,
        source_type: 'corrupted',
      },
      created_at: '2026-10-01T09:00:00Z',
    },
  ]

  const EXPECTED_METRICS_CLIPBOARD = [
    'Tổng hợp nguồn ghi chú:',
    '- Tổng số ghi chú: 7',
    '- Lưới 9 màn hình: 1',
    '- Ma trận TRIZ: 1',
    '- Gợi ý nguyên tắc: 1',
    '- Bằng chứng: 1',
    '- Giải pháp ứng viên: 1',
    '- Thủ công: 2',
  ].join('\n')

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

  describe('1. Render Summary Panel & Đếm nguồn chính xác khi có ghi chú', () => {
    it('1.1 hiển thị Summary Panel với tiêu đề "Tổng quan nguồn gốc" và nút "Sao chép tổng hợp"', async () => {
      renderWithNotes(MOCK_SUMMARY_NOTES)

      expect(await screen.findByText('Ghi chú 9 Màn hình: Quan sát hệ thống hiện tại')).toBeInTheDocument()

      const summaryPanel = screen.getByLabelText('Tổng quan nguồn gốc ghi chú')
      expect(summaryPanel).toBeInTheDocument()
      expect(within(summaryPanel).getByText('Tổng quan nguồn gốc')).toBeInTheDocument()

      const copySummaryBtn = within(summaryPanel).getByRole('button', { name: /sao chép tổng hợp/i })
      expect(copySummaryBtn).toBeInTheDocument()
    })

    it('1.2 hiển thị chính xác số đếm 7 nhóm trong Summary panel (all=7, 5 nguồn=1, manual=2)', async () => {
      renderWithNotes(MOCK_SUMMARY_NOTES)

      expect(await screen.findByText('Ghi chú 9 Màn hình: Quan sát hệ thống hiện tại')).toBeInTheDocument()

      const summaryPanel = screen.getByLabelText('Tổng quan nguồn gốc ghi chú')

      // Kiểm tra 7 chỉ số trong summary panel
      expect(within(summaryPanel).getByText(/Tổng số:\s*7|Tất cả:\s*7/)).toBeInTheDocument()
      expect(within(summaryPanel).getByText(/Lưới 9 màn hình:\s*1/)).toBeInTheDocument()
      expect(within(summaryPanel).getByText(/Ma trận TRIZ:\s*1/)).toBeInTheDocument()
      expect(within(summaryPanel).getByText(/Gợi ý nguyên tắc:\s*1/)).toBeInTheDocument()
      expect(within(summaryPanel).getByText(/Bằng chứng:\s*1/)).toBeInTheDocument()
      expect(within(summaryPanel).getByText(/Giải pháp ứng viên:\s*1/)).toBeInTheDocument()
      expect(within(summaryPanel).getByText(/Thủ công:\s*2/)).toBeInTheDocument()
    })

    it('1.3 context invalid được tính vào nhóm "Thủ công" mà không gây lỗi runtime', async () => {
      renderWithNotes(MOCK_SUMMARY_NOTES)

      expect(await screen.findByText('Ghi chú Context lỗi: Dữ liệu nguồn không hợp lệ hoặc lạ')).toBeInTheDocument()

      const summaryPanel = screen.getByLabelText('Tổng quan nguồn gốc ghi chú')
      // Note 6 (null) + Note 7 (invalid) => 2 thủ công
      expect(within(summaryPanel).getByText(/Thủ công:\s*2/)).toBeInTheDocument()
    })
  })

  describe('2. Tính độc lập của Counter trong Summary Panel với các bộ lọc', () => {
    it('2.1 counter trong Summary panel không thay đổi khi chọn filter nguồn', async () => {
      renderWithNotes(MOCK_SUMMARY_NOTES)

      expect(await screen.findByText('Ghi chú 9 Màn hình: Quan sát hệ thống hiện tại')).toBeInTheDocument()

      const sourceToolbar = screen.getByRole('toolbar', { name: 'Bộ lọc nguồn' })
      const trizMatrixFilterBtn = within(sourceToolbar).getByRole('button', { name: /ma trận triz/i })

      // Click filter nguồn Ma trận TRIZ
      fireEvent.click(trizMatrixFilterBtn)

      // Danh sách chỉ còn 1 note Ma trận
      expect(screen.getByText('Ghi chú Ma trận TRIZ: Giả thuyết thay đổi thông số nhiệt độ')).toBeInTheDocument()
      expect(screen.queryByText('Ghi chú 9 Màn hình: Quan sát hệ thống hiện tại')).not.toBeInTheDocument()

      // Counter trong Summary panel vẫn giữ nguyên toàn bộ 7 notes
      const summaryPanel = screen.getByLabelText('Tổng quan nguồn gốc ghi chú')
      expect(within(summaryPanel).getByText(/Tổng số:\s*7|Tất cả:\s*7/)).toBeInTheDocument()
      expect(within(summaryPanel).getByText(/Lưới 9 màn hình:\s*1/)).toBeInTheDocument()
      expect(within(summaryPanel).getByText(/Ma trận TRIZ:\s*1/)).toBeInTheDocument()
      expect(within(summaryPanel).getByText(/Thủ công:\s*2/)).toBeInTheDocument()
    })

    it('2.2 counter trong Summary panel không thay đổi khi chọn filter phân loại ghi chú (note_type)', async () => {
      renderWithNotes(MOCK_SUMMARY_NOTES)

      expect(await screen.findByText('Ghi chú 9 Màn hình: Quan sát hệ thống hiện tại')).toBeInTheDocument()

      const typeToolbar = screen.getByRole('toolbar', { name: 'Bộ lọc danh sách' })
      const hypothesisFilterBtn = within(typeToolbar).getByRole('button', { name: /hypothesis/i })

      // Click filter Hypothesis
      fireEvent.click(hypothesisFilterBtn)

      // Danh sách chỉ còn các note hypothesis
      expect(screen.getByText('Ghi chú Ma trận TRIZ: Giả thuyết thay đổi thông số nhiệt độ')).toBeInTheDocument()
      expect(screen.queryByText('Ghi chú 9 Màn hình: Quan sát hệ thống hiện tại')).not.toBeInTheDocument()

      // Summary panel vẫn giữ nguyên toàn bộ số đếm
      const summaryPanel = screen.getByLabelText('Tổng quan nguồn gốc ghi chú')
      expect(within(summaryPanel).getByText(/Tổng số:\s*7|Tất cả:\s*7/)).toBeInTheDocument()
      expect(within(summaryPanel).getByText(/Lưới 9 màn hình:\s*1/)).toBeInTheDocument()
    })

    it('2.3 counter trong Summary panel không thay đổi khi nhập từ khóa tìm kiếm', async () => {
      renderWithNotes(MOCK_SUMMARY_NOTES)

      expect(await screen.findByText('Ghi chú 9 Màn hình: Quan sát hệ thống hiện tại')).toBeInTheDocument()

      const searchInput = screen.getByLabelText('Tìm kiếm ghi chú')
      fireEvent.change(searchInput, { target: { value: 'composite' } })

      // Danh sách chỉ còn note Bằng chứng composite
      expect(screen.getByText(/Ghi chú Bằng chứng: Câu hỏi về độ tin cậy/i)).toBeInTheDocument()
      expect(screen.queryByText('Ghi chú 9 Màn hình: Quan sát hệ thống hiện tại')).not.toBeInTheDocument()

      // Summary panel vẫn hiển thị đúng 7 ghi chú tổng quát
      const summaryPanel = screen.getByLabelText('Tổng quan nguồn gốc ghi chú')
      expect(within(summaryPanel).getByText(/Tổng số:\s*7|Tất cả:\s*7/)).toBeInTheDocument()
      expect(within(summaryPanel).getByText(/Thủ công:\s*2/)).toBeInTheDocument()
    })
  })

  describe('3. Hành vi sao chép Clipboard (Metrics-only Export)', () => {
    it('3.1 gọi navigator.clipboard.writeText với định dạng metrics-only và hiển thị "Đã chép tổng hợp"', async () => {
      const mockWriteText = jest.fn().mockResolvedValue(undefined)
      mockClipboard(mockWriteText)

      renderWithNotes(MOCK_SUMMARY_NOTES)

      expect(await screen.findByText('Ghi chú 9 Màn hình: Quan sát hệ thống hiện tại')).toBeInTheDocument()

      const summaryPanel = screen.getByLabelText('Tổng quan nguồn gốc ghi chú')
      const copySummaryBtn = within(summaryPanel).getByRole('button', { name: /sao chép tổng hợp/i })

      await act(async () => {
        fireEvent.click(copySummaryBtn)
      })

      // Kiểm tra writeText được gọi chính xác 1 lần với nội dung metrics-only
      expect(mockWriteText).toHaveBeenCalledTimes(1)
      expect(mockWriteText).toHaveBeenCalledWith(EXPECTED_METRICS_CLIPBOARD)

      // Kiểm tra phản hồi trực quan "Đã chép tổng hợp"
      expect(within(summaryPanel).getByText('Đã chép tổng hợp')).toBeInTheDocument()
    })

    it('3.2 hiển thị lỗi "Trình duyệt không hỗ trợ sao chép" khi navigator.clipboard không khả dụng', async () => {
      mockClipboard(undefined)

      renderWithNotes(MOCK_SUMMARY_NOTES)

      expect(await screen.findByText('Ghi chú 9 Màn hình: Quan sát hệ thống hiện tại')).toBeInTheDocument()

      const summaryPanel = screen.getByLabelText('Tổng quan nguồn gốc ghi chú')
      const copySummaryBtn = within(summaryPanel).getByRole('button', { name: /sao chép tổng hợp/i })

      await act(async () => {
        fireEvent.click(copySummaryBtn)
      })

      expect(within(summaryPanel).getByText('Trình duyệt không hỗ trợ sao chép')).toBeInTheDocument()
    })

    it('3.3 hiển thị lỗi "Không thể sao chép vào bộ nhớ tạm" khi writeText bị reject', async () => {
      const mockWriteText = jest.fn().mockRejectedValue(new Error('Permission denied'))
      mockClipboard(mockWriteText)

      renderWithNotes(MOCK_SUMMARY_NOTES)

      expect(await screen.findByText('Ghi chú 9 Màn hình: Quan sát hệ thống hiện tại')).toBeInTheDocument()

      const summaryPanel = screen.getByLabelText('Tổng quan nguồn gốc ghi chú')
      const copySummaryBtn = within(summaryPanel).getByRole('button', { name: /sao chép tổng hợp/i })

      await act(async () => {
        fireEvent.click(copySummaryBtn)
      })

      expect(within(summaryPanel).getByText('Không thể sao chép vào bộ nhớ tạm')).toBeInTheDocument()
    })

    it('3.4 state copy của Summary panel hoàn toàn tách biệt với copyStatus của từng note card', async () => {
      const mockWriteText = jest.fn().mockResolvedValue(undefined)
      mockClipboard(mockWriteText)

      renderWithNotes(MOCK_SUMMARY_NOTES)

      expect(await screen.findByText('Ghi chú 9 Màn hình: Quan sát hệ thống hiện tại')).toBeInTheDocument()

      const summaryPanel = screen.getByLabelText('Tổng quan nguồn gốc ghi chú')
      const copySummaryBtn = within(summaryPanel).getByRole('button', { name: /sao chép tổng hợp/i })

      // Click sao chép tổng hợp
      await act(async () => {
        fireEvent.click(copySummaryBtn)
      })

      expect(within(summaryPanel).getByText('Đã chép tổng hợp')).toBeInTheDocument()

      // Các card bên dưới không bị hiển thị nhãn "Đã chép" của từng card
      const noteCards = screen.getAllByRole('button', { name: /^Sao chép ghi chú/i })
      expect(noteCards.length).toBe(7)
      expect(screen.queryByText(/^Đã chép$/)).not.toBeInTheDocument()
    })
  })

  describe('4. Empty State: Không render Summary Panel khi không có ghi chú', () => {
    it('4.1 phiên chưa có ghi chú (notes = []) => không render Summary Panel và không có nút "Sao chép tổng hợp"', async () => {
      renderWithNotes([])

      expect(await screen.findByText('Chưa có ghi chú nào trong phiên này')).toBeInTheDocument()

      // Summary panel không được render
      expect(screen.queryByLabelText('Tổng quan nguồn gốc ghi chú')).not.toBeInTheDocument()
      expect(screen.queryByText('Tổng quan nguồn gốc')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /sao chép tổng hợp/i })).not.toBeInTheDocument()
    })
  })
})
