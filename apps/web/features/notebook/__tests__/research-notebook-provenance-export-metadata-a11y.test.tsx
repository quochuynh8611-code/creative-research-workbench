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
  sessionId: 'ses-metadata-a11y-test',
  initialDraft: null,
  content: '',
  noteType: 'insight' as const,
  onContentChange: jest.fn(),
  onNoteTypeChange: jest.fn(),
  onClearDraft: jest.fn(),
  onNoteCreated: jest.fn(),
}

describe('Batch C9: ResearchNotebook Provenance Export Metadata & Accessibility Tests (RED Phase)', () => {
  const originalCreateObjectURL = window.URL.createObjectURL
  const originalRevokeObjectURL = window.URL.revokeObjectURL

  let createdUrls: string[] = []
  let blobStore: Map<string, Blob> = new Map()
  let capturedDownloadFilenames: string[] = []

  const FIXED_TEST_TIME = '2026-10-01T08:30:00.000Z'
  const EXPECTED_TIMESTAMP_STR = '20261001-083000'

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    jest.setSystemTime(new Date(FIXED_TEST_TIME))

    createdUrls = []
    blobStore.clear()
    capturedDownloadFilenames = []

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

  // Bộ 7 Notes: 5 nguồn hợp lệ + 1 manual null + 1 invalid
  const MOCK_PROVENANCE_NOTES: ResearchNote[] = [
    {
      id: 'note-01-triz9',
      session_id: 'ses-metadata-a11y-test',
      content: 'Ghi chú 9 Màn hình: Hệ thống hiện tại',
      note_type: 'insight',
      source_context: ctxTriz9Windows,
      created_at: '2026-10-01T08:00:00Z',
    },
    {
      id: 'note-02-matrix',
      session_id: 'ses-metadata-a11y-test',
      content: 'Ghi chú Ma trận TRIZ: Giả thuyết thông số',
      note_type: 'hypothesis',
      source_context: ctxTrizMatrix,
      created_at: '2026-10-01T08:10:00Z',
    },
    {
      id: 'note-03-principle',
      session_id: 'ses-metadata-a11y-test',
      content: 'Ghi chú Gợi ý nguyên tắc: Áp dụng nguyên tắc 10',
      note_type: 'decision',
      source_context: ctxPrincipleSuggestion,
      created_at: '2026-10-01T08:20:00Z',
    },
    {
      id: 'note-04-evidence',
      session_id: 'ses-metadata-a11y-test',
      content: 'Ghi chú Bằng chứng: Thử nghiệm độ bền',
      note_type: 'question',
      source_context: ctxEvidence,
      created_at: '2026-10-01T08:30:00Z',
    },
    {
      id: 'note-05-candidate',
      session_id: 'ses-metadata-a11y-test',
      content: 'Ghi chú Giải pháp ứng viên: Tích hợp module',
      note_type: 'action',
      source_context: ctxCandidateSolution,
      created_at: '2026-10-01T08:40:00Z',
    },
    {
      id: 'note-06-manual-null',
      session_id: 'ses-metadata-a11y-test',
      content: 'Ghi chú Thủ công: Ý tưởng cá nhân không nguồn',
      note_type: 'insight',
      source_context: null,
      created_at: '2026-10-01T08:50:00Z',
    },
    {
      id: 'note-07-invalid-ctx',
      session_id: 'ses-metadata-a11y-test',
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

  describe('Scenario: Export CSV with metadata and deterministic timestamp', () => {
    it('bao gồm generatedAt, activeSourceFilter, totalNotes và tên file có format source-provenance-summary-YYYYMMDD-HHMMSS.csv', async () => {
      const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        if (this.download) {
          capturedDownloadFilenames.push(this.download)
        }
      })

      renderWithNotes(MOCK_PROVENANCE_NOTES)
      expect(await screen.findByText('Ghi chú 9 Màn hình: Hệ thống hiện tại')).toBeInTheDocument()

      const summaryPanel = screen.getByLabelText('Tổng quan nguồn gốc ghi chú')

      // Chọn trước một filter nguồn (vd: Ma trận TRIZ) để activeSourceFilter = 'triz_matrix'
      const matrixChip = within(summaryPanel).getByRole('button', { name: /ma trận triz/i })
      await act(async () => {
        fireEvent.click(matrixChip)
      })

      // Click xuất CSV
      const exportCsvBtn = within(summaryPanel).getByRole('button', { name: /export csv|xuất csv/i })
      await act(async () => {
        fireEvent.click(exportCsvBtn)
      })

      // 1. Kiểm tra filename pattern
      expect(capturedDownloadFilenames.length).toBe(1)
      const downloadedFilename = capturedDownloadFilenames[0]
      expect(downloadedFilename).toBe(`source-provenance-summary-${EXPECTED_TIMESTAMP_STR}.csv`)

      // 2. Kiểm tra nội dung CSV có metadata
      const passedBlob = (window.URL.createObjectURL as jest.Mock).mock.calls[0][0] as Blob
      const reader = new FileReader()
      const textPromise = new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string)
      })
      reader.readAsText(passedBlob)
      const csvText = await textPromise

      expect(csvText).toMatch(/2026-10-01T08:30:00\.\d{3}Z/)
      expect(csvText).toMatch(/activeSourceFilter.*triz_matrix/)
      expect(csvText).toMatch(/totalNotes.*7/)
      expect(csvText).toMatch(/triz_9_windows.*1/)
      expect(csvText).toMatch(/triz_matrix.*1/)
      expect(csvText).toMatch(/manual.*2/)

      clickSpy.mockRestore()
    })
  })

  describe('Scenario: Export JSON with metadata and deterministic timestamp', () => {
    it('bao gồm generatedAt, activeSourceFilter, totalNotes, source groups và tên file source-provenance-summary-YYYYMMDD-HHMMSS.json', async () => {
      const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        if (this.download) {
          capturedDownloadFilenames.push(this.download)
        }
      })

      renderWithNotes(MOCK_PROVENANCE_NOTES)
      expect(await screen.findByText('Ghi chú 9 Màn hình: Hệ thống hiện tại')).toBeInTheDocument()

      const summaryPanel = screen.getByLabelText('Tổng quan nguồn gốc ghi chú')

      // Không chọn filter nào -> activeSourceFilter = 'all'
      const exportJsonBtn = within(summaryPanel).getByRole('button', { name: /export json|xuất json/i })
      await act(async () => {
        fireEvent.click(exportJsonBtn)
      })

      // 1. Kiểm tra filename
      expect(capturedDownloadFilenames.length).toBe(1)
      expect(capturedDownloadFilenames[0]).toBe(`source-provenance-summary-${EXPECTED_TIMESTAMP_STR}.json`)

      // 2. Kiểm tra JSON structure
      const passedBlob = (window.URL.createObjectURL as jest.Mock).mock.calls[0][0] as Blob
      const reader = new FileReader()
      const textPromise = new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string)
      })
      reader.readAsText(passedBlob)
      const jsonText = await textPromise
      const parsed = JSON.parse(jsonText)

      expect(parsed.generatedAt).toMatch(/^2026-10-01T08:30:00\.\d{3}Z$/)
      expect(parsed.activeSourceFilter).toBe('all')
      expect(parsed.totalNotes).toBe(7)

      const sources = parsed.sources || parsed.items || parsed.summary
      expect(Array.isArray(sources)).toBe(true)
      expect(sources.find((s: { key: string }) => s.key === 'triz_9_windows')?.count).toBe(1)
      expect(sources.find((s: { key: string }) => s.key === 'manual')?.count).toBe(2)

      clickSpy.mockRestore()
    })
  })

  describe('Scenario: Announce export result accessibly with aria-live="polite"', () => {
    it('thông báo thành công qua vùng aria-live="polite" và mô tả rõ format tệp', async () => {
      renderWithNotes(MOCK_PROVENANCE_NOTES)
      expect(await screen.findByText('Ghi chú 9 Màn hình: Hệ thống hiện tại')).toBeInTheDocument()

      const summaryPanel = screen.getByLabelText('Tổng quan nguồn gốc ghi chú')
      const exportCsvBtn = within(summaryPanel).getByRole('button', { name: /export csv|xuất csv/i })

      await act(async () => {
        fireEvent.click(exportCsvBtn)
      })

      const statusElement = within(summaryPanel).getByRole('status')
      expect(statusElement).toBeInTheDocument()
      expect(statusElement).toHaveAttribute('aria-live', 'polite')
      expect(statusElement.textContent).toMatch(/csv/i)
      expect(statusElement.textContent).toMatch(/thành công|success/i)
    })

    it('thông báo lỗi qua vùng aria-live="polite" và mô tả format tệp khi gặp sự cố', async () => {
      window.URL.createObjectURL = jest.fn(() => {
        throw new Error('Blob URL creation disabled')
      })

      renderWithNotes(MOCK_PROVENANCE_NOTES)
      expect(await screen.findByText('Ghi chú 9 Màn hình: Hệ thống hiện tại')).toBeInTheDocument()

      const summaryPanel = screen.getByLabelText('Tổng quan nguồn gốc ghi chú')
      const exportJsonBtn = within(summaryPanel).getByRole('button', { name: /export json|xuất json/i })

      await act(async () => {
        fireEvent.click(exportJsonBtn)
      })

      const alertElement = within(summaryPanel).getByRole('alert')
      expect(alertElement).toBeInTheDocument()
      expect(alertElement).toHaveAttribute('aria-live', 'polite')
      expect(alertElement.textContent).toMatch(/json/i)
      expect(alertElement.textContent).toMatch(/lỗi|không thể xuất|failed/i)
    })
  })

  describe('Scenario: Operate export controls by keyboard (Enter / Space & Focus Indicators)', () => {
    it('kích hoạt được nút Export CSV bằng phím Enter và Space', async () => {
      const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

      renderWithNotes(MOCK_PROVENANCE_NOTES)
      expect(await screen.findByText('Ghi chú 9 Màn hình: Hệ thống hiện tại')).toBeInTheDocument()

      const summaryPanel = screen.getByLabelText('Tổng quan nguồn gốc ghi chú')
      const exportCsvBtn = within(summaryPanel).getByRole('button', { name: /export csv|xuất csv/i })

      // Focus nút và kích hoạt bằng Enter
      exportCsvBtn.focus()
      expect(exportCsvBtn).toHaveFocus()
      await act(async () => {
        fireEvent.keyDown(exportCsvBtn, { key: 'Enter', code: 'Enter' })
      })
      expect(clickSpy).toHaveBeenCalledTimes(1)

      // Kích hoạt tiếp bằng Space
      await act(async () => {
        fireEvent.keyDown(exportCsvBtn, { key: ' ', code: 'Space' })
      })
      expect(clickSpy).toHaveBeenCalledTimes(2)

      clickSpy.mockRestore()
    })

    it('kích hoạt chip điều hướng bằng phím Enter và Space để lọc nguồn', async () => {
      renderWithNotes(MOCK_PROVENANCE_NOTES)
      expect(await screen.findByText('Ghi chú 9 Màn hình: Hệ thống hiện tại')).toBeInTheDocument()

      const summaryPanel = screen.getByLabelText('Tổng quan nguồn gốc ghi chú')
      const evidenceChip = within(summaryPanel).getByRole('button', { name: /bằng chứng/i })

      // Focus chip và nhấn Enter
      evidenceChip.focus()
      expect(evidenceChip).toHaveFocus()
      await act(async () => {
        fireEvent.keyDown(evidenceChip, { key: 'Enter', code: 'Enter' })
      })

      // Danh sách chỉ còn note Bằng chứng
      expect(screen.getByText('Ghi chú Bằng chứng: Thử nghiệm độ bền')).toBeInTheDocument()
      expect(screen.queryByText('Ghi chú 9 Màn hình: Hệ thống hiện tại')).not.toBeInTheDocument()

      // Reset bằng phím Space trên chip Tất cả
      const allChip = within(summaryPanel).getByRole('button', { name: /tất cả|tổng số/i })
      allChip.focus()
      await act(async () => {
        fireEvent.keyDown(allChip, { key: ' ', code: 'Space' })
      })

      expect(screen.getByText('Ghi chú 9 Màn hình: Hệ thống hiện tại')).toBeInTheDocument()
      expect(screen.getByText('Ghi chú Bằng chứng: Thử nghiệm độ bền')).toBeInTheDocument()
    })

    it('các nút và chip có accessible name rõ ràng và focus-visible indicators', async () => {
      renderWithNotes(MOCK_PROVENANCE_NOTES)
      expect(await screen.findByText('Ghi chú 9 Màn hình: Hệ thống hiện tại')).toBeInTheDocument()

      const summaryPanel = screen.getByLabelText('Tổng quan nguồn gốc ghi chú')
      const exportCsvBtn = within(summaryPanel).getByRole('button', { name: /export csv|xuất csv/i })
      const exportJsonBtn = within(summaryPanel).getByRole('button', { name: /export json|xuất json/i })
      const chips = within(summaryPanel).getAllByRole('button')

      // Kiểm tra class focus-visible
      expect(exportCsvBtn.className).toMatch(/focus-visible:ring/i)
      expect(exportJsonBtn.className).toMatch(/focus-visible:ring/i)

      chips.forEach((btn) => {
        expect(btn).toHaveAccessibleName()
        expect(btn.className).toMatch(/focus-visible:ring|focus:ring/i)
      })
    })
  })
})
