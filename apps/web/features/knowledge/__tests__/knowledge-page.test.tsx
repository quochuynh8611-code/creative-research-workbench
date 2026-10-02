/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as apiClient from '@/lib/api-client'
import type { DocumentItem, DocumentDetail } from '@/lib/types'

import { KnowledgeView } from '../knowledge-view'

jest.mock('@/lib/api-client', () => ({
  listDocuments: jest.fn(),
  getDocument: jest.fn(),
  uploadDocument: jest.fn(),
  deleteDocument: jest.fn(),
}))

const mockedListDocuments = apiClient.listDocuments as jest.MockedFunction<any>
const mockedGetDocument = apiClient.getDocument as jest.MockedFunction<any>
const mockedUploadDocument = apiClient.uploadDocument as jest.MockedFunction<any>
const mockedDeleteDocument = apiClient.deleteDocument as jest.MockedFunction<any>

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('Knowledge Page & Documents Management Component (Phase 8)', () => {
  const mockDocs: DocumentItem[] = [
    {
      id: 'doc-golden-01',
      filename: 'ADR-001-architecture.md',
      filepath: 'docs/ADR-001-architecture.md',
      title: 'ADR-001 — Kiến trúc hệ thống',
      topic: 'architecture',
      source_type: 'decision-record',
      language: 'vi',
      tags: ['adr', 'triz'],
      phase: '1',
      status: 'canonical',
      golden: true,
      content_hash: 'hash_golden_01',
      chunks_count: 4,
      created_at: '2026-10-01T10:00:00Z',
      updated_at: '2026-10-01T10:00:00Z',
    },
    {
      id: 'doc-normal-02',
      filename: 'battery-research.md',
      filepath: 'docs/battery-research.md',
      title: 'Nghiên cứu Pin Lithium',
      topic: 'energy',
      source_type: 'paper',
      language: 'vi',
      tags: ['battery'],
      phase: '2',
      status: 'draft',
      golden: false,
      content_hash: 'hash_normal_02',
      chunks_count: 2,
      created_at: '2026-10-02T10:00:00Z',
      updated_at: '2026-10-02T10:00:00Z',
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
  })

  // 1. Loading State
  it('Scenario 1: Hiển thị trạng thái loading khi đang tải danh sách tài liệu', async () => {
    mockedListDocuments.mockReturnValue(new Promise(() => {})) // Pending promise

    renderWithClient(<KnowledgeView />)

    expect(screen.getByText(/Đang tải danh sách tài liệu/i)).toBeInTheDocument()
  })

  // 2. Empty State
  it('Scenario 2: Hiển thị empty state khi chưa có tài liệu nào', async () => {
    mockedListDocuments.mockResolvedValueOnce({
      data: [],
      meta: { total: 0, limit: 50, offset: 0 },
    })

    renderWithClient(<KnowledgeView />)

    await waitFor(() => {
      expect(screen.getByText(/Chưa có tài liệu nào trong cơ sở tri thức/i)).toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: /Nạp tài liệu/i })[0]).toBeInTheDocument()
    })
  })

  // 3. Error State
  it('Scenario 3: Hiển thị thông báo lỗi và nút thử lại khi tải thất bại', async () => {
    mockedListDocuments.mockRejectedValueOnce(new Error('Network connection failed'))

    renderWithClient(<KnowledgeView />)

    await waitFor(() => {
      expect(screen.getByText(/Không thể tải danh sách tài liệu/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Thử lại/i })).toBeInTheDocument()
    })
  })

  // 4. Render Document List with Golden Badge
  it('Scenario 4: Render bảng danh sách tài liệu với Golden badge và metadata đầy đủ', async () => {
    mockedListDocuments.mockResolvedValue({
      data: mockDocs,
      meta: { total: 2, limit: 50, offset: 0 },
    })

    renderWithClient(<KnowledgeView />)

    await waitFor(() => {
      expect(screen.getByText(/ADR-001 — Kiến trúc hệ thống/i)).toBeInTheDocument()
      expect(screen.getByText(/Nghiên cứu Pin Lithium/i)).toBeInTheDocument()
      expect(screen.getByText(/Golden Doc/i)).toBeInTheDocument()
      expect(screen.getByTestId('topic-doc-golden-01')).toHaveTextContent('architecture')
      expect(screen.getByTestId('topic-doc-normal-02')).toHaveTextContent('energy')
    })
  })

  // 5. Filter Interactions (Search query & Topic)
  it('Scenario 5: Lọc danh sách tài liệu theo từ khóa tìm kiếm và topic', async () => {
    mockedListDocuments.mockResolvedValue({
      data: [mockDocs[0]],
      meta: { total: 1, limit: 50, offset: 0 },
    })

    renderWithClient(<KnowledgeView />)

    await waitFor(() => {
      expect(screen.getByText(/ADR-001 — Kiến trúc hệ thống/i)).toBeInTheDocument()
    })

    const filterInput = screen.getByPlaceholderText(/Tìm kiếm tài liệu/i)
    fireEvent.change(filterInput, { target: { value: 'ADR' } })

    await waitFor(() => {
      expect(mockedListDocuments).toHaveBeenCalledWith(
        expect.objectContaining({
          q: 'ADR',
        })
      )
    })
  })

  // 6. Upload Modal Flow
  it('Scenario 6: Upload file markdown hiển thị modal, nạp thành công và reload danh sách', async () => {
    mockedListDocuments.mockResolvedValue({
      data: mockDocs,
      meta: { total: 2, limit: 50, offset: 0 },
    })
    mockedUploadDocument.mockResolvedValueOnce({
      status: 'success',
      document_id: 'new-doc-123',
      filename: 'new-case.md',
      title: 'New Case Study',
      chunks_created: 3,
      embeddings_created: 3,
    })

    renderWithClient(<KnowledgeView />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Nạp tài liệu/i })).toBeInTheDocument()
    })

    const uploadBtn = screen.getByRole('button', { name: /Nạp tài liệu/i })
    fireEvent.click(uploadBtn)

    // Modal upload hiển thị
    expect(screen.getByText(/Tải lên tài liệu Markdown/i)).toBeInTheDocument()

    const fileInput = screen.getByTestId('file-upload-input')
    const fakeFile = new File(['# New Content'], 'new-case.md', { type: 'text/markdown' })
    fireEvent.change(fileInput, { target: { files: [fakeFile] } })

    const submitUploadBtn = screen.getByRole('button', { name: /Bắt đầu nạp/i })
    fireEvent.click(submitUploadBtn)

    await waitFor(() => {
      expect(mockedUploadDocument).toHaveBeenCalledWith(fakeFile)
      expect(screen.getByText(/Nạp tài liệu thành công/i)).toBeInTheDocument()
    })
  })

  // 7. Delete Confirm & Golden Doc Disabled Guard
  it('Scenario 7: Xóa tài liệu thường yêu cầu xác nhận; nút xóa của Golden Doc bị disabled', async () => {
    mockedListDocuments.mockResolvedValue({
      data: mockDocs,
      meta: { total: 2, limit: 50, offset: 0 },
    })
    mockedDeleteDocument.mockResolvedValueOnce({ status: 'deleted', id: 'doc-normal-02' })

    renderWithClient(<KnowledgeView />)

    await waitFor(() => {
      expect(screen.getByText('Nghiên cứu Pin Lithium')).toBeInTheDocument()
    })

    // Golden document delete button is disabled
    const goldenDeleteBtn = screen.getByTestId('delete-doc-doc-golden-01')
    expect(goldenDeleteBtn).toBeDisabled()

    // Normal document delete button is enabled
    const normalDeleteBtn = screen.getByTestId('delete-doc-doc-normal-02')
    expect(normalDeleteBtn).toBeEnabled()

    fireEvent.click(normalDeleteBtn)

    // Dialog xác nhận xóa
    expect(screen.getByText(/Bạn có chắc chắn muốn xóa tài liệu này/i)).toBeInTheDocument()
    const confirmBtn = screen.getByRole('button', { name: /Xác nhận xóa/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(mockedDeleteDocument).toHaveBeenCalledWith('doc-normal-02')
    })
  })

  // 8. View Detail Modal Flow
  it('Scenario 8: Click xem chi tiết mở modal hiển thị metadata và danh sách chunks', async () => {
    mockedListDocuments.mockResolvedValue({
      data: mockDocs,
      meta: { total: 2, limit: 50, offset: 0 },
    })
    const docDetail: DocumentDetail = {
      ...mockDocs[0],
      chunks: [
        { id: 'c1', chunk_index: 0, token_count: 80, content: 'Đoạn 1: Giới thiệu kiến trúc' },
        { id: 'c2', chunk_index: 1, token_count: 120, content: 'Đoạn 2: Workflow engine' },
      ],
    }
    mockedGetDocument.mockResolvedValueOnce(docDetail)

    renderWithClient(<KnowledgeView />)

    await waitFor(() => {
      expect(screen.getByText('ADR-001 — Kiến trúc hệ thống')).toBeInTheDocument()
    })

    const viewDetailBtn = screen.getByTestId('view-doc-doc-golden-01')
    fireEvent.click(viewDetailBtn)

    await waitFor(() => {
      expect(mockedGetDocument).toHaveBeenCalledWith('doc-golden-01')
      expect(screen.getByText(/Chi tiết tài liệu/i)).toBeInTheDocument()
      expect(screen.getByText('Đoạn 1: Giới thiệu kiến trúc')).toBeInTheDocument()
      expect(screen.getByText('Đoạn 2: Workflow engine')).toBeInTheDocument()
    })
  })
})
