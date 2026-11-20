/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ResearchNotebook } from '../research-notebook'
import * as apiClient from '@/lib/api-client'
import type { ResearchNotesResponse, ResearchNote } from '@/lib/types'

jest.mock('@/lib/api-client', () => ({
  listResearchNotes: jest.fn(),
  createResearchNote: jest.fn(),
  deleteResearchNote: jest.fn(),
  removeNoteTag: jest.fn(),
  updateNoteTags: jest.fn(),
}))

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

const MOCK_NOTES_WITH_TAGS: ResearchNote[] = [
  {
    id: 'note-001',
    session_id: 'ses-123',
    content: 'Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong',
    note_type: 'insight',
    tags: ['thermal', 'cooling'],
    source_chunk_id: null,
    created_at: '2026-10-01T08:30:00Z',
  },
  {
    id: 'note-002',
    session_id: 'ses-123',
    content: 'Thử nghiệm phủ lớp graphene đa tầng',
    note_type: 'hypothesis',
    tags: ['material', 'coating'],
    source_chunk_id: null,
    created_at: '2026-10-01T09:00:00Z',
  },
]

describe('C38-GAP-01: Research Notebook Per-Note Tagging Specification (Phương án B: Canonical Tags)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('2.2.1 Form tạo ghi chú cho phép nhập tags và truyền mảng tags vào createResearchNote', async () => {
    const mockResponse: ResearchNotesResponse = {
      data: [],
      meta: { total: 0 },
    }
    ;(apiClient.listResearchNotes as jest.Mock).mockResolvedValue(mockResponse)
    ;(apiClient.createResearchNote as jest.Mock).mockResolvedValue({
      id: 'note-new',
      session_id: 'ses-123',
      content: 'Ghi chú về pin lithium',
      note_type: 'insight',
      tags: ['battery', 'safety'],
      created_at: new Date().toISOString(),
    })

    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <ResearchNotebook
          sessionId="ses-123"
          initialDraft={null}
          content="Ghi chú về pin lithium"
          noteType="insight"
          onContentChange={jest.fn()}
          onNoteTypeChange={jest.fn()}
          onClearDraft={jest.fn()}
          onNoteCreated={jest.fn()}
        />
      </QueryClientProvider>
    )

    // Nhập tags vào input có nhãn
    const tagInput = screen.getByLabelText(/Tags \/ Nhãn/i)
    fireEvent.change(tagInput, { target: { value: 'battery, safety' } })

    const submitBtn = screen.getByRole('button', { name: /lưu ghi chú|thêm ghi chú/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(apiClient.createResearchNote).toHaveBeenCalledWith(
        'ses-123',
        expect.objectContaining({
          content: 'Ghi chú về pin lithium',
          note_type: 'insight',
          tags: ['battery', 'safety'],
        })
      )
    })
  })

  it('2.2.2 Note Card hiển thị danh sách tags dưới dạng badges', async () => {
    const mockResponse: ResearchNotesResponse = {
      data: MOCK_NOTES_WITH_TAGS,
      meta: { total: 2 },
    }
    ;(apiClient.listResearchNotes as jest.Mock).mockResolvedValue(mockResponse)

    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <ResearchNotebook
          sessionId="ses-123"
          initialDraft={null}
          content=""
          noteType="insight"
          onContentChange={jest.fn()}
          onNoteTypeChange={jest.fn()}
          onClearDraft={jest.fn()}
          onNoteCreated={jest.fn()}
        />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong')).toBeInTheDocument()
      expect(screen.getAllByText('#thermal').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('#cooling').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('#material').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('#coating').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('2.2.3 Lọc danh sách note theo tag được chọn từ toolbar', async () => {
    const mockResponse: ResearchNotesResponse = {
      data: MOCK_NOTES_WITH_TAGS,
      meta: { total: 2 },
    }
    ;(apiClient.listResearchNotes as jest.Mock).mockResolvedValue(mockResponse)

    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <ResearchNotebook
          sessionId="ses-123"
          initialDraft={null}
          content=""
          noteType="insight"
          onContentChange={jest.fn()}
          onNoteTypeChange={jest.fn()}
          onClearDraft={jest.fn()}
          onNoteCreated={jest.fn()}
        />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong')).toBeInTheDocument()
      expect(screen.getByText('Thử nghiệm phủ lớp graphene đa tầng')).toBeInTheDocument()
    })

    // Chọn tag #thermal để lọc
    const thermalChip = screen.getByRole('button', { name: /lọc theo tag #thermal/i })
    fireEvent.click(thermalChip)

    await waitFor(() => {
      // Chỉ còn note 1 hiển thị
      expect(screen.getByText('Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong')).toBeInTheDocument()
      expect(screen.queryByText('Thử nghiệm phủ lớp graphene đa tầng')).not.toBeInTheDocument()
    })
  })

  it('2.2.4 Bảo toàn draft tags khi mutation thất bại (draft preservation under network failure / HTTP 500)', async () => {
    const mockResponse: ResearchNotesResponse = {
      data: [],
      meta: { total: 0 },
    }
    ;(apiClient.listResearchNotes as jest.Mock).mockResolvedValue(mockResponse)
    ;(apiClient.createResearchNote as jest.Mock).mockRejectedValue(new Error('Network error'))

    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <ResearchNotebook
          sessionId="ses-123"
          initialDraft={null}
          content="Ghi chú quan trọng"
          noteType="insight"
          onContentChange={jest.fn()}
          onNoteTypeChange={jest.fn()}
          onClearDraft={jest.fn()}
          onNoteCreated={jest.fn()}
        />
      </QueryClientProvider>
    )

    const tagInput = screen.getByLabelText(/Tags \/ Nhãn/i) as HTMLInputElement
    fireEvent.change(tagInput, { target: { value: 'crucial, preserve' } })

    const submitBtn = screen.getByRole('button', { name: /lưu ghi chú|thêm ghi chú/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    // Draft tags và textarea vẫn giữ nguyên giá trị
    expect(tagInput.value).toBe('crucial, preserve')
  })

  it('2.2.5 Nút gỡ tag (remove chip) trên note card gọi removeNoteTag với tham số đúng', async () => {
    const mockResponse: ResearchNotesResponse = {
      data: MOCK_NOTES_WITH_TAGS,
      meta: { total: 2 },
    }
    ;(apiClient.listResearchNotes as jest.Mock).mockResolvedValue(mockResponse)
    ;(apiClient.removeNoteTag as jest.Mock).mockResolvedValue({
      id: 'note-001',
      session_id: 'ses-123',
      content: 'Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong',
      note_type: 'insight',
      tags: ['cooling'],
      created_at: '2026-10-01T08:30:00Z',
    })

    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <ResearchNotebook
          sessionId="ses-123"
          initialDraft={null}
          content=""
          noteType="insight"
          onContentChange={jest.fn()}
          onNoteTypeChange={jest.fn()}
          onClearDraft={jest.fn()}
          onNoteCreated={jest.fn()}
        />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong')).toBeInTheDocument()
    })

    // Tìm nút gỡ tag #thermal
    const removeThermalBtn = screen.getByRole('button', { name: /Xóa tag #thermal/i })
    fireEvent.click(removeThermalBtn)

    await waitFor(() => {
      expect(apiClient.removeNoteTag).toHaveBeenCalledWith('ses-123', 'note-001', 'thermal')
    })
  })

  it('2.2.6 Network failure / HTTP 500 khi gỡ tag hiển thị thông báo lỗi và bảo toàn draft form input', async () => {
    const mockResponse: ResearchNotesResponse = {
      data: MOCK_NOTES_WITH_TAGS,
      meta: { total: 2 },
    }
    ;(apiClient.listResearchNotes as jest.Mock).mockResolvedValue(mockResponse)
    ;(apiClient.removeNoteTag as jest.Mock).mockRejectedValue(new Error('Network error when removing tag'))

    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <ResearchNotebook
          sessionId="ses-123"
          initialDraft={null}
          content="Draft content is safe"
          noteType="insight"
          onContentChange={jest.fn()}
          onNoteTypeChange={jest.fn()}
          onClearDraft={jest.fn()}
          onNoteCreated={jest.fn()}
        />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong')).toBeInTheDocument()
    })

    const tagInput = screen.getByLabelText(/Tags \/ Nhãn/i) as HTMLInputElement
    fireEvent.change(tagInput, { target: { value: 'draft-tag-1' } })

    const removeThermalBtn = screen.getByRole('button', { name: /Xóa tag #thermal/i })
    fireEvent.click(removeThermalBtn)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText(/Network error when removing tag/i)).toBeInTheDocument()
    })

    // Draft form input vẫn bảo toàn
    expect(tagInput.value).toBe('draft-tag-1')
  })
})
