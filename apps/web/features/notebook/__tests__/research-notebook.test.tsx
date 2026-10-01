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
}))

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

const MOCK_NOTES: ResearchNote[] = [
  {
    id: 'note-001',
    session_id: 'ses-123',
    content: 'Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong',
    note_type: 'insight',
    source_chunk_id: null,
    created_at: '2026-10-01T08:30:00Z',
  },
  {
    id: 'note-002',
    session_id: 'ses-123',
    content: 'Thử nghiệm phủ lớp graphene đa tầng',
    note_type: 'hypothesis',
    source_chunk_id: 'chk-999',
    created_at: '2026-10-01T09:00:00Z',
  },
]

describe('ResearchNotebook Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // 1. Render notes list
  it('1. render danh sách ghi chú với đầy đủ nội dung, phân loại và ngày tạo', async () => {
    const mockResponse: ResearchNotesResponse = {
      data: MOCK_NOTES,
      meta: { total: 2 },
    }
    ;(apiClient.listResearchNotes as jest.Mock).mockResolvedValueOnce(mockResponse)

    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <ResearchNotebook sessionId="ses-123" />
      </QueryClientProvider>
    )

    expect(apiClient.listResearchNotes).toHaveBeenCalledWith('ses-123')

    expect(await screen.findByText('Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong')).toBeInTheDocument()
    expect(screen.getByText('Thử nghiệm phủ lớp graphene đa tầng')).toBeInTheDocument()
    expect(screen.getByText('Insight')).toBeInTheDocument()
    expect(screen.getByText('Hypothesis')).toBeInTheDocument()
  })

  // 2. Create note successfully & form reset
  it('2. tạo ghi chú mới thành công, gọi API và reset form nhập', async () => {
    const mockResponse: ResearchNotesResponse = {
      data: [MOCK_NOTES[0]],
      meta: { total: 1 },
    }
    ;(apiClient.listResearchNotes as jest.Mock).mockResolvedValue(mockResponse)

    const newNote: ResearchNote = {
      id: 'note-003',
      session_id: 'ses-123',
      content: 'Cần xác nhận lại kết quả đo nhiệt lượng',
      note_type: 'action',
      source_chunk_id: null,
      created_at: '2026-10-01T10:00:00Z',
    }
    ;(apiClient.createResearchNote as jest.Mock).mockResolvedValueOnce(newNote)

    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <ResearchNotebook sessionId="ses-123" />
      </QueryClientProvider>
    )

    await screen.findByText('Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong')

    const textarea = screen.getByPlaceholderText(/nhập ghi chú|nội dung ghi chú/i)
    const select = screen.getByLabelText(/loại ghi chú|phân loại/i) || screen.getByRole('combobox')
    const submitBtn = screen.getByRole('button', { name: /lưu ghi chú|thêm ghi chú/i })

    fireEvent.change(textarea, { target: { value: 'Cần xác nhận lại kết quả đo nhiệt lượng' } })
    fireEvent.change(select, { target: { value: 'action' } })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(apiClient.createResearchNote).toHaveBeenCalledWith('ses-123', {
        content: 'Cần xác nhận lại kết quả đo nhiệt lượng',
        note_type: 'action',
      })
    })

    // Form reset
    expect(textarea).toHaveValue('')
  })

  // 3. Delete note
  it('3. xóa ghi chú gọi deleteResearchNote với đúng session_id và note_id', async () => {
    const mockResponse: ResearchNotesResponse = {
      data: MOCK_NOTES,
      meta: { total: 2 },
    }
    ;(apiClient.listResearchNotes as jest.Mock).mockResolvedValue(mockResponse)
    ;(apiClient.deleteResearchNote as jest.Mock).mockResolvedValueOnce({
      status: 'deleted',
      id: 'note-001',
      session_id: 'ses-123',
    })

    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <ResearchNotebook sessionId="ses-123" />
      </QueryClientProvider>
    )

    await screen.findByText('Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong')

    const deleteBtns = screen.getAllByRole('button', { name: /xóa|delete/i })
    fireEvent.click(deleteBtns[0])

    await waitFor(() => {
      expect(apiClient.deleteResearchNote).toHaveBeenCalledWith('ses-123', 'note-001')
    })
  })

  // 4. Blank validation
  it('4. validate nội dung rỗng hiển thị lỗi cục bộ và không gọi API', async () => {
    const mockResponse: ResearchNotesResponse = {
      data: [],
      meta: { total: 0 },
    }
    ;(apiClient.listResearchNotes as jest.Mock).mockResolvedValueOnce(mockResponse)

    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <ResearchNotebook sessionId="ses-123" />
      </QueryClientProvider>
    )

    await screen.findByText(/chưa có ghi chú nào/i)

    const textarea = screen.getByPlaceholderText(/nhập ghi chú|nội dung ghi chú/i)
    const submitBtn = screen.getByRole('button', { name: /lưu ghi chú|thêm ghi chú/i })

    fireEvent.change(textarea, { target: { value: '   ' } })
    fireEvent.click(submitBtn)

    expect(apiClient.createResearchNote).not.toHaveBeenCalled()
    expect(screen.getByText(/vui lòng nhập nội dung/i)).toBeInTheDocument()
  })

  // 5. Empty state
  it('5. hiển thị empty state khi chưa có ghi chú nào', async () => {
    const mockResponse: ResearchNotesResponse = {
      data: [],
      meta: { total: 0 },
    }
    ;(apiClient.listResearchNotes as jest.Mock).mockResolvedValueOnce(mockResponse)

    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <ResearchNotebook sessionId="ses-123" />
      </QueryClientProvider>
    )

    expect(await screen.findByText(/chưa có ghi chú nào/i)).toBeInTheDocument()
  })

  // 6. Local error fallback & retry
  it('6. hiển thị banner lỗi cục bộ và cho phép thử lại khi tải thất bại', async () => {
    ;(apiClient.listResearchNotes as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <ResearchNotebook sessionId="ses-123" />
      </QueryClientProvider>
    )

    expect(await screen.findByText(/không thể tải danh sách ghi chú/i)).toBeInTheDocument()

    // Retry
    const mockResponse: ResearchNotesResponse = {
      data: MOCK_NOTES,
      meta: { total: 2 },
    }
    ;(apiClient.listResearchNotes as jest.Mock).mockResolvedValueOnce(mockResponse)

    const retryBtn = screen.getByRole('button', { name: /thử lại|retry/i })
    fireEvent.click(retryBtn)

    expect(await screen.findByText('Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong')).toBeInTheDocument()
  })
})
