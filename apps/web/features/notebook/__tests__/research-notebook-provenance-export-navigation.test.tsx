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
  sessionId: 'ses-export-nav-test',
  initialDraft: null,
  content: '',
  noteType: 'insight' as const,
  onContentChange: jest.fn(),
  onNoteTypeChange: jest.fn(),
  onClearDraft: jest.fn(),
  onNoteCreated: jest.fn(),
}

describe('Batch C8: ResearchNotebook Provenance Export & Navigation Tests (RED Phase)', () => {
  const originalCreateObjectURL = window.URL.createObjectURL
  const originalRevokeObjectURL = window.URL.revokeObjectURL

  let createdUrls: string[] = []
  let blobStore: Map<string, Blob> = new Map()

  beforeEach(() => {
    jest.clearAllMocks()
    createdUrls = []
    blobStore.clear()

    window.URL.createObjectURL = jest.fn((blob: Blob) => {
      const url = `blob:mock-url-${createdUrls.length + 1}`
      createdUrls.push(url)
      blobStore.set(url, blob)
      return url
    })

    window.URL.revokeObjectURL = jest.fn((url: string) => {
      blobStore.delete(url)
    })
  })

  afterEach(() => {
    jest.useRealTimers()
    window.URL.createObjectURL = originalCreateObjectURL
    window.URL.revokeObjectURL = originalRevokeObjectURL
  })

  // Fixtures 5 context hợp lệ
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
    source_ref: 'Báo cáo thử nghiệm composite 2026',
  }

  const ctxCandidateSolution: CandidateSolutionSourceContext = {
    schema_version: 1,
    source_type: 'candidate_solution',
    solution_id: '550e8400-e29b-41d4-a716-446655440001',
    solution_status: 'accepted',
    principle_used: 35,
  }

  // Bộ 7 Notes: 5 nguồn hợp lệ + 1 thủ công null + 1 invalid context (fallback manual)
  const MOCK_PROVENANCE_NOTES: ResearchNote[] = [
    {
      id: 'note-01-triz9',
      session_id: 'ses-export-nav-test',
      content: 'Ghi chú 9 Màn hình: Hệ thống hiện tại',
      note_type: 'insight',
      source_context: ctxTriz9Windows,
      created_at: '2026-10-01T08:00:00Z',
    },
    {
      id: 'note-02-matrix',
      session_id: 'ses-export-nav-test',
      content: 'Ghi chú Ma trận TRIZ: Giả thuyết thông số',
      note_type: 'hypothesis',
      source_context: ctxTrizMatrix,
      created_at: '2026-10-01T08:10:00Z',
    },
    {
      id: 'note-03-principle',
      session_id: 'ses-export-nav-test',
      content: 'Ghi chú Gợi ý nguyên tắc: Áp dụng nguyên tắc 10',
      note_type: 'decision',
      source_context: ctxPrincipleSuggestion,
      created_at: '2026-10-01T08:20:00Z',
    },
    {
      id: 'note-04-evidence',
      session_id: 'ses-export-nav-test',
      content: 'Ghi chú Bằng chứng: Thử nghiệm độ bền',
      note_type: 'question',
      source_context: ctxEvidence,
      created_at: '2026-10-01T08:30:00Z',
    },
    {
      id: 'note-05-candidate',
      session_id: 'ses-export-nav-test',
      content: 'Ghi chú Giải pháp ứng viên: Tích hợp module',
      note_type: 'action',
      source_context: ctxCandidateSolution,
      created_at: '2026-10-01T08:40:00Z',
    },
    {
      id: 'note-06-manual-null',
      session_id: 'ses-export-nav-test',
      content: 'Ghi chú Thủ công: Ý tưởng cá nhân không nguồn',
      note_type: 'insight',
      source_context: null,
      created_at: '2026-10-01T08:50:00Z',
    },
    {
      id: 'note-07-invalid-ctx',
      session_id: 'ses-export-nav-test',
      content: 'Ghi chú Context lỗi: Dữ liệu nguồn lạ',
      note_type: 'hypothesis',
      source_context: {
        schema_version: 99,
        source_type: 'corrupted',
      },
      created_at: '2026-10-01T09:00:00Z',
    },
  ]

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

  describe('1. Export CSV action', () => {
    it('1.1 hiển thị nút "Export CSV" hoặc "Xuất CSV" trong Summary Panel', async () => {
      renderWithNotes(MOCK_PROVENANCE_NOTES)
      expect(await screen.findByText('Ghi chú 9 Màn hình: Hệ thống hiện tại')).toBeInTheDocument()

      const summaryPanel = screen.getByLabelText('Tổng quan nguồn gốc ghi chú')
      const exportCsvBtn = within(summaryPanel).getByRole('button', { name: /export csv|xuất csv/i })
      expect(exportCsvBtn).toBeInTheDocument()
    })

    it('1.2 kích hoạt download file CSV chứa đầy đủ các nhóm nguồn và số lượng', async () => {
      const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

      renderWithNotes(MOCK_PROVENANCE_NOTES)
      expect(await screen.findByText('Ghi chú 9 Màn hình: Hệ thống hiện tại')).toBeInTheDocument()

      const summaryPanel = screen.getByLabelText('Tổng quan nguồn gốc ghi chú')
      const exportCsvBtn = within(summaryPanel).getByRole('button', { name: /export csv|xuất csv/i })

      await act(async () => {
        fireEvent.click(exportCsvBtn)
      })

      expect(window.URL.createObjectURL).toHaveBeenCalledTimes(1)
      const passedBlob = (window.URL.createObjectURL as jest.Mock).mock.calls[0][0] as Blob
      expect(passedBlob).toBeInstanceOf(Blob)
      expect(passedBlob.type).toContain('text/csv')

      // Kiểm tra nội dung CSV
      const reader = new FileReader()
      const textPromise = new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string)
      })
      reader.readAsText(passedBlob)
      const csvText = await textPromise

      expect(csvText).toMatch(/triz_9_windows.*1/)
      expect(csvText).toMatch(/triz_matrix.*1/)
      expect(csvText).toMatch(/principle_suggestion.*1/)
      expect(csvText).toMatch(/evidence.*1/)
      expect(csvText).toMatch(/candidate_solution.*1/)
      expect(csvText).toMatch(/manual.*2/)

      expect(clickSpy).toHaveBeenCalledTimes(1)
      expect(window.URL.revokeObjectURL).toHaveBeenCalledTimes(1)

      clickSpy.mockRestore()
    })
  })

  describe('2. Export JSON action', () => {
    it('2.1 hiển thị nút "Export JSON" hoặc "Xuất JSON" trong Summary Panel', async () => {
      renderWithNotes(MOCK_PROVENANCE_NOTES)
      expect(await screen.findByText('Ghi chú 9 Màn hình: Hệ thống hiện tại')).toBeInTheDocument()

      const summaryPanel = screen.getByLabelText('Tổng quan nguồn gốc ghi chú')
      const exportJsonBtn = within(summaryPanel).getByRole('button', { name: /export json|xuất json/i })
      expect(exportJsonBtn).toBeInTheDocument()
    })

    it('2.2 kích hoạt download file JSON hợp lệ có đầy đủ thông tin nguồn và đếm chính xác', async () => {
      const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

      renderWithNotes(MOCK_PROVENANCE_NOTES)
      expect(await screen.findByText('Ghi chú 9 Màn hình: Hệ thống hiện tại')).toBeInTheDocument()

      const summaryPanel = screen.getByLabelText('Tổng quan nguồn gốc ghi chú')
      const exportJsonBtn = within(summaryPanel).getByRole('button', { name: /export json|xuất json/i })

      await act(async () => {
        fireEvent.click(exportJsonBtn)
      })

      expect(window.URL.createObjectURL).toHaveBeenCalledTimes(1)
      const passedBlob = (window.URL.createObjectURL as jest.Mock).mock.calls[0][0] as Blob
      expect(passedBlob).toBeInstanceOf(Blob)
      expect(passedBlob.type).toContain('application/json')

      // Kiểm tra parse JSON
      const reader = new FileReader()
      const textPromise = new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string)
      })
      reader.readAsText(passedBlob)
      const jsonText = await textPromise
      const parsed = JSON.parse(jsonText)

      // Cấu trúc có thể là array hoặc object có list items
      const items = Array.isArray(parsed) ? parsed : (parsed.items || parsed.sources || parsed.summary)
      expect(Array.isArray(items)).toBe(true)

      const findCount = (key: string) => {
        const item = items.find((i: { key: string }) => i.key === key)
        return item ? item.count : undefined
      }

      expect(findCount('all')).toBe(7)
      expect(findCount('triz_9_windows')).toBe(1)
      expect(findCount('triz_matrix')).toBe(1)
      expect(findCount('principle_suggestion')).toBe(1)
      expect(findCount('evidence')).toBe(1)
      expect(findCount('candidate_solution')).toBe(1)
      expect(findCount('manual')).toBe(2)

      expect(clickSpy).toHaveBeenCalledTimes(1)
      expect(window.URL.revokeObjectURL).toHaveBeenCalledTimes(1)

      clickSpy.mockRestore()
    })
  })

  describe('3. Click-to-filter Navigation từ Summary Chips', () => {
    it('3.1 các chip thống kê nguồn là button tương tác và click vào "Ma trận TRIZ" sẽ áp dụng bộ lọc nguồn', async () => {
      renderWithNotes(MOCK_PROVENANCE_NOTES)
      expect(await screen.findByText('Ghi chú 9 Màn hình: Hệ thống hiện tại')).toBeInTheDocument()

      const summaryPanel = screen.getByLabelText('Tổng quan nguồn gốc ghi chú')
      
      // Tìm chip Ma trận TRIZ trong summary panel
      const trizMatrixChip = within(summaryPanel).getByRole('button', { name: /ma trận triz/i })
      expect(trizMatrixChip).toBeInTheDocument()

      // Click chip
      await act(async () => {
        fireEvent.click(trizMatrixChip)
      })

      // Danh sách chỉ còn note Ma trận TRIZ
      expect(screen.getByText('Ghi chú Ma trận TRIZ: Giả thuyết thông số')).toBeInTheDocument()
      expect(screen.queryByText('Ghi chú 9 Màn hình: Hệ thống hiện tại')).not.toBeInTheDocument()
      expect(screen.queryByText('Ghi chú Bằng chứng: Thử nghiệm độ bền')).not.toBeInTheDocument()
    })

    it('3.2 click vào chip "Tất cả" hoặc "Tổng số" sẽ reset bộ lọc về "all"', async () => {
      renderWithNotes(MOCK_PROVENANCE_NOTES)
      expect(await screen.findByText('Ghi chú 9 Màn hình: Hệ thống hiện tại')).toBeInTheDocument()

      const summaryPanel = screen.getByLabelText('Tổng quan nguồn gốc ghi chú')
      const trizMatrixChip = within(summaryPanel).getByRole('button', { name: /ma trận triz/i })

      await act(async () => {
        fireEvent.click(trizMatrixChip)
      })
      expect(screen.queryByText('Ghi chú 9 Màn hình: Hệ thống hiện tại')).not.toBeInTheDocument()

      // Click chip Tất cả / Tổng số trong summary
      const allChip = within(summaryPanel).getByRole('button', { name: /tất cả|tổng số/i })
      await act(async () => {
        fireEvent.click(allChip)
      })

      // Toàn bộ notes hiển thị lại
      expect(screen.getByText('Ghi chú 9 Màn hình: Hệ thống hiện tại')).toBeInTheDocument()
      expect(screen.getByText('Ghi chú Ma trận TRIZ: Giả thuyết thông số')).toBeInTheDocument()
      expect(screen.getByText('Ghi chú Bằng chứng: Thử nghiệm độ bền')).toBeInTheDocument()
    })

    it('3.3 số đếm (counters) trong Summary Panel hoàn toàn độc lập và không đổi khi điều hướng qua chip', async () => {
      renderWithNotes(MOCK_PROVENANCE_NOTES)
      expect(await screen.findByText('Ghi chú 9 Màn hình: Hệ thống hiện tại')).toBeInTheDocument()

      const summaryPanel = screen.getByLabelText('Tổng quan nguồn gốc ghi chú')
      const evidenceChip = within(summaryPanel).getByRole('button', { name: /bằng chứng/i })

      await act(async () => {
        fireEvent.click(evidenceChip)
      })

      // Summary panel vẫn giữ nguyên số đếm của tất cả các nguồn
      expect(within(summaryPanel).getByText(/Tổng số:\s*7|Tất cả:\s*7/)).toBeInTheDocument()
      expect(within(summaryPanel).getByText(/Lưới 9 màn hình:\s*1/)).toBeInTheDocument()
      expect(within(summaryPanel).getByText(/Ma trận TRIZ:\s*1/)).toBeInTheDocument()
      expect(within(summaryPanel).getByText(/Bằng chứng:\s*1/)).toBeInTheDocument()
      expect(within(summaryPanel).getByText(/Thủ công:\s*2/)).toBeInTheDocument()
    })
  })

  describe('4. Fail-safe xử lý lỗi Export không làm crash component', () => {
    it('4.1 hiển thị thông báo lỗi khi URL.createObjectURL ném exception', async () => {
      window.URL.createObjectURL = jest.fn(() => {
        throw new Error('Failed to create object URL')
      })

      renderWithNotes(MOCK_PROVENANCE_NOTES)
      expect(await screen.findByText('Ghi chú 9 Màn hình: Hệ thống hiện tại')).toBeInTheDocument()

      const summaryPanel = screen.getByLabelText('Tổng quan nguồn gốc ghi chú')
      const exportCsvBtn = within(summaryPanel).getByRole('button', { name: /export csv|xuất csv/i })

      await act(async () => {
        fireEvent.click(exportCsvBtn)
      })

      // Không crash, hiển thị lỗi
      const alert = within(summaryPanel).getByRole('alert')
      expect(alert).toBeInTheDocument()
      expect(alert).toHaveTextContent(/không thể xuất|lỗi xuất|failed/i)
    })
  })
})
