/** @jest-environment jsdom */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
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
  sessionId: 'ses-123',
  initialDraft: null,
  content: '',
  noteType: 'insight' as const,
  onContentChange: jest.fn(),
  onNoteTypeChange: jest.fn(),
  onClearDraft: jest.fn(),
  onNoteCreated: jest.fn(),
}

describe('Batch C7c-3a: ResearchNotebook Source Badges Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

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
    source_ref: 'Báo cáo thử nghiệm độ bền vật liệu 2026',
  }

  const ctxCandidateSolution: CandidateSolutionSourceContext = {
    schema_version: 1,
    source_type: 'candidate_solution',
    solution_id: '550e8400-e29b-41d4-a716-446655440001',
    solution_status: 'accepted',
    principle_used: 35,
  }

  it('1. Render danh sách 5 ghi chú với đầy đủ 5 nhãn Source Badge chuẩn', async () => {
    const mockNotes: ResearchNote[] = [
      {
        id: 'note-001',
        session_id: 'ses-123',
        content: 'Nội dung ghi chú từ 9 Cửa sổ TRIZ',
        note_type: 'insight',
        source_context: ctxTriz9Windows,
        created_at: '2026-10-01T08:00:00Z',
      },
      {
        id: 'note-002',
        session_id: 'ses-123',
        content: 'Nội dung ghi chú từ Ma trận TRIZ',
        note_type: 'hypothesis',
        source_context: ctxTrizMatrix,
        created_at: '2026-10-01T08:30:00Z',
      },
      {
        id: 'note-003',
        session_id: 'ses-123',
        content: 'Nội dung ghi chú từ Gợi ý nguyên tắc',
        note_type: 'decision',
        source_context: ctxPrincipleSuggestion,
        created_at: '2026-10-01T09:00:00Z',
      },
      {
        id: 'note-004',
        session_id: 'ses-123',
        content: 'Nội dung ghi chú từ Bằng chứng tra cứu',
        note_type: 'question',
        source_context: ctxEvidence,
        created_at: '2026-10-01T09:30:00Z',
      },
      {
        id: 'note-005',
        session_id: 'ses-123',
        content: 'Nội dung ghi chú từ Giải pháp ứng viên',
        note_type: 'action',
        source_context: ctxCandidateSolution,
        created_at: '2026-10-01T10:00:00Z',
      },
    ]

    const mockResponse: ResearchNotesResponse = {
      data: mockNotes,
      meta: { total: 5 },
    }
    ;(apiClient.listResearchNotes as jest.Mock).mockResolvedValueOnce(mockResponse)

    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <ResearchNotebook {...defaultProps} />
      </QueryClientProvider>
    )

    // Chờ danh sách ghi chú tải xong
    expect(await screen.findByText('Nội dung ghi chú từ 9 Cửa sổ TRIZ')).toBeInTheDocument()

    // Kiểm tra hiển thị đầy đủ 5 nhãn Source Badge chuẩn
    expect(screen.getByText('Lưới 9 màn hình')).toBeInTheDocument()
    expect(screen.getByText('Ma trận TRIZ')).toBeInTheDocument()
    expect(screen.getByText('Gợi ý nguyên tắc')).toBeInTheDocument()
    expect(screen.getByText('Bằng chứng')).toBeInTheDocument()
    expect(screen.getByText('Giải pháp ứng viên')).toBeInTheDocument()
  })

  it('2. Ghi chú thủ công có source_context null không hiển thị bất kỳ badge nguồn nào', async () => {
    const mockNotes: ResearchNote[] = [
      {
        id: 'note-manual-001',
        session_id: 'ses-123',
        content: 'Ghi chú thủ công do người dùng tự nhập',
        note_type: 'insight',
        source_context: null,
        created_at: '2026-10-01T11:00:00Z',
      },
    ]

    const mockResponse: ResearchNotesResponse = {
      data: mockNotes,
      meta: { total: 1 },
    }
    ;(apiClient.listResearchNotes as jest.Mock).mockResolvedValueOnce(mockResponse)

    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <ResearchNotebook {...defaultProps} />
      </QueryClientProvider>
    )

    expect(await screen.findByText('Ghi chú thủ công do người dùng tự nhập')).toBeInTheDocument()

    // Tuyệt đối không hiển thị bất kỳ nhãn nào trong 5 source badges
    expect(screen.queryByText('Lưới 9 màn hình')).not.toBeInTheDocument()
    expect(screen.queryByText('Ma trận TRIZ')).not.toBeInTheDocument()
    expect(screen.queryByText('Gợi ý nguyên tắc')).not.toBeInTheDocument()
    expect(screen.queryByText('Bằng chứng')).not.toBeInTheDocument()
    expect(screen.queryByText('Giải pháp ứng viên')).not.toBeInTheDocument()
  })

  it('3. Ghi chú có source_context invalid không làm crash và không hiển thị badge nguồn', async () => {
    const mockNotes: ResearchNote[] = [
      {
        id: 'note-corrupted-001',
        session_id: 'ses-123',
        content: 'Ghi chú có context bị hỏng hoặc schema cũ',
        note_type: 'decision',
        source_context: {
          schema_version: 99,
          source_type: 'unknown_source',
          corrupted_field: true,
        },
        created_at: '2026-10-01T11:30:00Z',
      },
    ]

    const mockResponse: ResearchNotesResponse = {
      data: mockNotes,
      meta: { total: 1 },
    }
    ;(apiClient.listResearchNotes as jest.Mock).mockResolvedValueOnce(mockResponse)

    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <ResearchNotebook {...defaultProps} />
      </QueryClientProvider>
    )

    expect(await screen.findByText('Ghi chú có context bị hỏng hoặc schema cũ')).toBeInTheDocument()

    // Không render source badge khi context invalid
    expect(screen.queryByText('Lưới 9 màn hình')).not.toBeInTheDocument()
    expect(screen.queryByText('Ma trận TRIZ')).not.toBeInTheDocument()
    expect(screen.queryByText('Gợi ý nguyên tắc')).not.toBeInTheDocument()
    expect(screen.queryByText('Bằng chứng')).not.toBeInTheDocument()
    expect(screen.queryByText('Giải pháp ứng viên')).not.toBeInTheDocument()
  })

  it('4. Source Badge được render cùng card header với note_type badge', async () => {
    const mockNotes: ResearchNote[] = [
      {
        id: 'note-header-test-001',
        session_id: 'ses-123',
        content: 'Kiểm tra vị trí render của badge trong card header',
        note_type: 'hypothesis',
        source_context: ctxTrizMatrix,
        created_at: '2026-10-01T12:00:00Z',
      },
    ]

    const mockResponse: ResearchNotesResponse = {
      data: mockNotes,
      meta: { total: 1 },
    }
    ;(apiClient.listResearchNotes as jest.Mock).mockResolvedValueOnce(mockResponse)

    const queryClient = createTestQueryClient()
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <ResearchNotebook {...defaultProps} />
      </QueryClientProvider>
    )

    expect(await screen.findByText('Kiểm tra vị trí render của badge trong card header')).toBeInTheDocument()

    // Cả note_type badge và source badge đều hiện diện trong card
    expect(screen.getByText('Hypothesis')).toBeInTheDocument()
    const sourceBadge = screen.getByText('Ma trận TRIZ')
    expect(sourceBadge).toBeInTheDocument()

    // Thẻ header chứa cả hai badges
    const noteCard = container.querySelector('.group')
    expect(noteCard).toBeInTheDocument()
    expect(noteCard).toContainElement(sourceBadge)
  })
})
