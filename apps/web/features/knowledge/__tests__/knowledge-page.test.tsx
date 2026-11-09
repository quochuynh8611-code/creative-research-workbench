/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react'
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

function renderWithClient(ui: React.ReactElement, client?: QueryClient) {
  const queryClient =
    client ??
    new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    })
  const renderResult = render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
  return {
    ...renderResult,
    queryClient,
  }
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
    mockedListDocuments.mockReset()
    mockedGetDocument.mockReset()
    mockedUploadDocument.mockReset()
    mockedDeleteDocument.mockReset()
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

  // 6. Upload Modal Flow (Single File Base Flow)
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

  // ─────────────────────────────────────────────────────────────
  // Multi-File Knowledge Upload Queue & Retry Suites (Scenarios 9-21)
  // ─────────────────────────────────────────────────────────────

  // 9. Multi-file Selection Display
  it('Scenario 9: Chọn 3 tệp hiển thị đủ danh sách hàng đợi kèm kích thước và chưa gọi API upload', async () => {
    mockedListDocuments.mockResolvedValue({ data: mockDocs, meta: { total: 2, limit: 50, offset: 0 } })

    renderWithClient(<KnowledgeView />)
    await waitFor(() => screen.getByRole('button', { name: /Nạp tài liệu/i }))
    fireEvent.click(screen.getByRole('button', { name: /Nạp tài liệu/i }))

    const fileInput = screen.getByTestId('file-upload-input') as HTMLInputElement
    // Verify file input supports multiple selection
    expect(fileInput).toHaveAttribute('multiple')

    const file1 = new File(['# File 1'], 'doc1.md', { type: 'text/markdown' })
    const file2 = new File(['Text 2 content'], 'doc2.txt', { type: 'text/plain' })
    const file3 = new File(['### File 3'], 'doc3.markdown', { type: 'text/markdown' })
    Object.defineProperty(file1, 'size', { value: 1024 })
    Object.defineProperty(file2, 'size', { value: 2048 })
    Object.defineProperty(file3, 'size', { value: 4096 })

    fireEvent.change(fileInput, { target: { files: [file1, file2, file3] } })

    // Verify all 3 queue rows appear in DOM with name and formatted size
    await waitFor(() => {
      const items = screen.getAllByTestId('queue-item')
      expect(items).toHaveLength(3)
      expect(within(items[0]).getByText('doc1.md')).toBeInTheDocument()
      expect(within(items[0]).getByText(/1\.0 KB/i)).toBeInTheDocument()
      expect(within(items[1]).getByText('doc2.txt')).toBeInTheDocument()
      expect(within(items[1]).getByText(/2\.0 KB/i)).toBeInTheDocument()
      expect(within(items[2]).getByText('doc3.markdown')).toBeInTheDocument()
      expect(within(items[2]).getByText(/4\.0 KB/i)).toBeInTheDocument()
    })

    // API must NOT be called upon selection
    expect(mockedUploadDocument).not.toHaveBeenCalled()

    // Start button is ready
    const startBtn = screen.getByRole('button', { name: /Bắt đầu nạp/i })
    expect(startBtn).toBeEnabled()
  })

  // 10. Single File Upload Backwards Compatibility with File Identity
  it('Scenario 10: Nạp 1 tệp tiếp tục hoạt động liền mạch qua cơ chế hàng đợi', async () => {
    mockedListDocuments.mockResolvedValue({ data: mockDocs, meta: { total: 2, limit: 50, offset: 0 } })
    mockedUploadDocument.mockResolvedValueOnce({
      status: 'success',
      document_id: 'doc-single-1',
      filename: 'single.md',
      title: 'Single Document',
      chunks_created: 1,
      embeddings_created: 1,
    })

    renderWithClient(<KnowledgeView />)
    await waitFor(() => screen.getByRole('button', { name: /Nạp tài liệu/i }))
    fireEvent.click(screen.getByRole('button', { name: /Nạp tài liệu/i }))

    const fileInput = screen.getByTestId('file-upload-input')
    const singleFile = new File(['content'], 'single.md', { type: 'text/markdown' })
    fireEvent.change(fileInput, { target: { files: [singleFile] } })

    const startBtn = screen.getByRole('button', { name: /Bắt đầu nạp/i })
    fireEvent.click(startBtn)

    await waitFor(() => {
      expect(mockedUploadDocument).toHaveBeenCalledTimes(1)
      expect(mockedUploadDocument.mock.calls[0][0]).toBe(singleFile)
    })

    // Queue item row reflects success
    await waitFor(() => {
      const queueItem = screen.getByTestId('queue-item')
      expect(within(queueItem).getByText(/^Thành công$/i)).toBeInTheDocument()
    })
  })

  // 11. Strict Sequential Upload Execution with Deferred Promises & File Identity
  it('Scenario 11: Upload tuần tự nghiêm ngặt — request thứ hai không bắt đầu trước khi request thứ nhất giải quyết xong', async () => {
    mockedListDocuments.mockResolvedValue({ data: mockDocs, meta: { total: 2, limit: 50, offset: 0 } })

    let resolveFirst!: (value: any) => void
    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve
    })
    let resolveSecond!: (value: any) => void
    const secondPromise = new Promise((resolve) => {
      resolveSecond = resolve
    })

    mockedUploadDocument
      .mockReturnValueOnce(firstPromise)
      .mockReturnValueOnce(secondPromise)

    renderWithClient(<KnowledgeView />)
    await waitFor(() => screen.getByRole('button', { name: /Nạp tài liệu/i }))
    fireEvent.click(screen.getByRole('button', { name: /Nạp tài liệu/i }))

    const fileInput = screen.getByTestId('file-upload-input')
    const fileA = new File(['AAA'], 'first.md', { type: 'text/markdown' })
    const fileB = new File(['BBB'], 'second.md', { type: 'text/markdown' })
    fireEvent.change(fileInput, { target: { files: [fileA, fileB] } })

    const startBtn = screen.getByRole('button', { name: /Bắt đầu nạp/i })
    fireEvent.click(startBtn)

    // First request is dispatched immediately with fileA identity
    await waitFor(() => {
      expect(mockedUploadDocument).toHaveBeenCalledTimes(1)
      expect(mockedUploadDocument.mock.calls[0][0]).toBe(fileA)
    })

    // Second request MUST NOT be dispatched yet while first request is pending
    expect(mockedUploadDocument).toHaveBeenCalledTimes(1)

    // Resolve first request with act hygiene
    act(() => {
      resolveFirst({ status: 'success', document_id: 'doc-a', filename: 'first.md' })
    })

    // Now second request is dispatched sequentially with fileB identity
    await waitFor(() => {
      expect(mockedUploadDocument).toHaveBeenCalledTimes(2)
      expect(mockedUploadDocument.mock.calls[1][0]).toBe(fileB)
    })

    // Resolve second request with act hygiene
    act(() => {
      resolveSecond({ status: 'success', document_id: 'doc-b', filename: 'second.md' })
    })

    await waitFor(() => {
      const items = screen.getAllByTestId('queue-item')
      expect(within(items[0]).getByText(/^Thành công$/i)).toBeInTheDocument()
      expect(within(items[1]).getByText(/^Thành công$/i)).toBeInTheDocument()
    })
  })

  // 12. Mixed Results Fault Isolation (Success, Error, Already_Exists)
  it('Scenario 12: Kết quả hỗn hợp — lỗi tệp giữa lượt không chặn tệp tiếp theo; phân loại riêng biệt', async () => {
    mockedListDocuments.mockResolvedValue({ data: mockDocs, meta: { total: 2, limit: 50, offset: 0 } })

    const file1 = new File(['1'], 'doc1.md', { type: 'text/markdown' })
    const file2 = new File(['2'], 'doc2.md', { type: 'text/markdown' })
    const file3 = new File(['3'], 'doc3.md', { type: 'text/markdown' })

    mockedUploadDocument
      .mockResolvedValueOnce({ status: 'success', document_id: 'd1', filename: 'doc1.md' })
      .mockRejectedValueOnce(new Error('Connection reset by peer'))
      .mockResolvedValueOnce({ status: 'already_exists', document_id: 'd3', filename: 'doc3.md' })

    renderWithClient(<KnowledgeView />)
    await waitFor(() => screen.getByRole('button', { name: /Nạp tài liệu/i }))
    fireEvent.click(screen.getByRole('button', { name: /Nạp tài liệu/i }))

    const fileInput = screen.getByTestId('file-upload-input')
    fireEvent.change(fileInput, { target: { files: [file1, file2, file3] } })

    const startBtn = screen.getByRole('button', { name: /Bắt đầu nạp/i })
    fireEvent.click(startBtn)

    // All 3 files must be processed despite error on file 2
    await waitFor(() => {
      expect(mockedUploadDocument).toHaveBeenCalledTimes(3)
      expect(mockedUploadDocument.mock.calls[0][0]).toBe(file1)
      expect(mockedUploadDocument.mock.calls[1][0]).toBe(file2)
      expect(mockedUploadDocument.mock.calls[2][0]).toBe(file3)
    })

    // Scoped queue row assertions using exact status badge matching
    await waitFor(() => {
      const rows = screen.getAllByTestId('queue-item')
      expect(rows).toHaveLength(3)
      expect(within(rows[0]).getByText(/^Thành công$/i)).toBeInTheDocument()
      expect(within(rows[1]).getByText(/^Lỗi$/i)).toBeInTheDocument()
      expect(within(rows[2]).getByText(/^Đã tồn tại$/i)).toBeInTheDocument()

      // Whole queue summary reflects all items
      const summary = screen.getByTestId('upload-summary')
      expect(within(summary).getByText(/1 thành công/i)).toBeInTheDocument()
      expect(within(summary).getByText(/1 đã tồn tại/i)).toBeInTheDocument()
      expect(within(summary).getByText(/1 lỗi/i)).toBeInTheDocument()
    })
  })

  // 13. Retry Only Failed Upload Items (Respects Validation Errors, File Identity & Retry-pending Guard)
  it('Scenario 13: Thử lại chỉ gửi lại các tệp lỗi request; không gửi lại tệp thành công, đã tồn tại hay lỗi validation; khóa controls khi retry pending', async () => {
    mockedListDocuments.mockResolvedValue({ data: mockDocs, meta: { total: 2, limit: 50, offset: 0 } })

    const fileSuccess = new File(['ok'], 'ok.md', { type: 'text/markdown' })
    const fileExist = new File(['dup'], 'exist.md', { type: 'text/markdown' })
    const fileOversized = new File(['oversized'], 'too-big.md', { type: 'text/markdown' })
    Object.defineProperty(fileOversized, 'size', { value: 10 * 1024 * 1024 + 1 }) // Validation error
    const fileFailRequest = new File(['err'], 'fail.md', { type: 'text/markdown' })

    mockedUploadDocument
      .mockResolvedValueOnce({ status: 'success', document_id: 'd-ok', filename: 'ok.md' })
      .mockResolvedValueOnce({ status: 'already_exists', document_id: 'd-exist', filename: 'exist.md' })
      .mockRejectedValueOnce(new Error('Server 500'))

    renderWithClient(<KnowledgeView />)
    await waitFor(() => screen.getByRole('button', { name: /Nạp tài liệu/i }))
    fireEvent.click(screen.getByRole('button', { name: /Nạp tài liệu/i }))

    const fileInput = screen.getByTestId('file-upload-input')
    fireEvent.change(fileInput, { target: { files: [fileSuccess, fileExist, fileOversized, fileFailRequest] } })

    fireEvent.click(screen.getByRole('button', { name: /Bắt đầu nạp/i }))

    // Initial batch: only 3 valid files sent; fileOversized rejected client-side
    await waitFor(() => {
      expect(mockedUploadDocument).toHaveBeenCalledTimes(3)
      expect(mockedUploadDocument.mock.calls[0][0]).toBe(fileSuccess)
      expect(mockedUploadDocument.mock.calls[1][0]).toBe(fileExist)
      expect(mockedUploadDocument.mock.calls[2][0]).toBe(fileFailRequest)
      expect(screen.getByRole('button', { name: /Thử lại tệp lỗi/i })).toBeInTheDocument()
      expect(screen.queryByText('Nạp tài liệu thành công!')).not.toBeInTheDocument()
    })

    // Setup deferred promise for retry
    let resolveRetry!: (value: any) => void
    const retryPromise = new Promise((resolve) => {
      resolveRetry = resolve
    })
    mockedUploadDocument.mockReturnValueOnce(retryPromise)

    const retryBtn = screen.getByRole('button', { name: /Thử lại tệp lỗi/i })
    fireEvent.click(retryBtn)

    // Wait for retry call to begin
    await waitFor(() => {
      expect(mockedUploadDocument).toHaveBeenCalledTimes(4)
      expect(mockedUploadDocument.mock.calls[3][0]).toBe(fileFailRequest)
    })

    // Consecutive rapid retry clicks while retry is pending must NOT trigger extra calls
    fireEvent.click(retryBtn)
    fireEvent.click(retryBtn)
    expect(mockedUploadDocument).toHaveBeenCalledTimes(4)

    // Verify all controls locked while retry is pending
    expect(screen.getByTestId('file-upload-input')).toBeDisabled()
    expect(screen.getByTestId('modal-close-icon-btn')).toBeDisabled()
    expect(screen.getByTestId('modal-close-footer-btn')).toBeDisabled()

    // Verify all remove queue item buttons are locked or hidden
    const removeButtons = screen.queryAllByTestId('remove-queue-item')
    expect(removeButtons.length === 0 || removeButtons.every((btn) => btn.hasAttribute('disabled'))).toBe(true)

    // Resolve retry with act hygiene
    act(() => {
      resolveRetry({ status: 'success', document_id: 'd-fail-fixed', filename: 'fail.md' })
    })

    await waitFor(() => {
      // fileSuccess, fileExist, fileOversized were NOT called
      expect(mockedUploadDocument).toHaveBeenCalledTimes(4)
      // Overall summary updated: 2 success, 1 already exists, 1 error (validation)
      const summary = screen.getByTestId('upload-summary')
      expect(within(summary).getByText(/2 thành công/i)).toBeInTheDocument()
      expect(within(summary).getByText(/1 đã tồn tại/i)).toBeInTheDocument()
      expect(within(summary).getByText(/1 lỗi/i)).toBeInTheDocument()
      // Since queue still has validation error, common success banner must NOT appear
      expect(screen.queryByText('Nạp tài liệu thành công!')).not.toBeInTheDocument()
    })
  })

  // 14. Extension and Size Validation Boundaries
  it('Scenario 14: Validation định dạng và kích thước — boundary đúng 10 MiB hợp lệ, quá 10 MiB bị từ chối; không retry lỗi validation', async () => {
    mockedListDocuments.mockResolvedValue({ data: mockDocs, meta: { total: 2, limit: 50, offset: 0 } })

    const validCaseInsensitive = new File(['valid'], 'doc.MD', { type: 'text/markdown' })
    Object.defineProperty(validCaseInsensitive, 'size', { value: 1024 })

    const exactBoundaryFile = new File(['exact'], 'exact.txt', { type: 'text/plain' })
    Object.defineProperty(exactBoundaryFile, 'size', { value: 10 * 1024 * 1024 }) // exactly 10 MiB

    const emptyFile = new File([''], 'empty.md', { type: 'text/markdown' })
    Object.defineProperty(emptyFile, 'size', { value: 0 }) // 0 bytes allowed

    const oversizedFile = new File(['oversized'], 'oversized.md', { type: 'text/markdown' })
    Object.defineProperty(oversizedFile, 'size', { value: 10 * 1024 * 1024 + 1 }) // 10 MiB + 1 byte

    const invalidExtFile = new File(['pdf'], 'report.pdf', { type: 'application/pdf' })
    Object.defineProperty(invalidExtFile, 'size', { value: 1024 })

    mockedUploadDocument
      .mockResolvedValueOnce({ status: 'success', document_id: 'v1', filename: 'doc.MD' })
      .mockResolvedValueOnce({ status: 'success', document_id: 'v2', filename: 'exact.txt' })
      .mockResolvedValueOnce({ status: 'success', document_id: 'v3', filename: 'empty.md' })

    renderWithClient(<KnowledgeView />)
    await waitFor(() => screen.getByRole('button', { name: /Nạp tài liệu/i }))
    fireEvent.click(screen.getByRole('button', { name: /Nạp tài liệu/i }))

    const fileInput = screen.getByTestId('file-upload-input')
    fireEvent.change(fileInput, {
      target: { files: [validCaseInsensitive, exactBoundaryFile, emptyFile, oversizedFile, invalidExtFile] },
    })

    // Check validation error indicators on invalid rows
    await waitFor(() => {
      const rows = screen.getAllByTestId('queue-item')
      expect(rows).toHaveLength(5)
      expect(within(rows[3]).getByText(/vượt quá 10MB/i)).toBeInTheDocument()
      expect(within(rows[4]).getByText(/định dạng không hỗ trợ/i)).toBeInTheDocument()
    })

    const startBtn = screen.getByRole('button', { name: /Bắt đầu nạp/i })
    fireEvent.click(startBtn)

    // Only 3 valid files must be sent to the API with exact File identity
    await waitFor(() => {
      expect(mockedUploadDocument).toHaveBeenCalledTimes(3)
      expect(mockedUploadDocument.mock.calls[0][0]).toBe(validCaseInsensitive)
      expect(mockedUploadDocument.mock.calls[1][0]).toBe(exactBoundaryFile)
      expect(mockedUploadDocument.mock.calls[2][0]).toBe(emptyFile)
    })

    // Wait until upload turn is completely finished and controls are re-enabled
    await waitFor(() => {
      expect(screen.getByTestId('modal-close-icon-btn')).toBeEnabled()
      expect(screen.getByTestId('modal-close-footer-btn')).toBeEnabled()
      expect(screen.getByTestId('file-upload-input')).toBeEnabled()
      // Since queue still contains validation errors, common success banner must NOT appear
      expect(screen.queryByText('Nạp tài liệu thành công!')).not.toBeInTheDocument()
    })

    // Validation errors must NOT trigger retry button
    expect(screen.queryByRole('button', { name: /Thử lại tệp lỗi/i })).not.toBeInTheDocument()
  })

  // 15. Same Filename Treated as Separate Queue Items with File Identity
  it('Scenario 15: Cùng filename nhưng khác File object vẫn là hai queue item riêng biệt', async () => {
    mockedListDocuments.mockResolvedValue({ data: mockDocs, meta: { total: 2, limit: 50, offset: 0 } })
    mockedUploadDocument
      .mockResolvedValueOnce({ status: 'success', document_id: 'doc-x1', filename: 'notes.md' })
      .mockResolvedValueOnce({ status: 'success', document_id: 'doc-x2', filename: 'notes.md' })

    renderWithClient(<KnowledgeView />)
    await waitFor(() => screen.getByRole('button', { name: /Nạp tài liệu/i }))
    fireEvent.click(screen.getByRole('button', { name: /Nạp tài liệu/i }))

    const fileA = new File(['content A'], 'notes.md', { type: 'text/markdown' })
    Object.defineProperty(fileA, 'size', { value: 100 })
    const fileB = new File(['content B different'], 'notes.md', { type: 'text/markdown' })
    Object.defineProperty(fileB, 'size', { value: 200 })

    const fileInput = screen.getByTestId('file-upload-input')
    fireEvent.change(fileInput, { target: { files: [fileA, fileB] } })

    // Both items must be present in DOM as distinct queue items
    await waitFor(() => {
      const items = screen.getAllByTestId('queue-item')
      expect(items).toHaveLength(2)
      expect(within(items[0]).getByText('100 B')).toBeInTheDocument()
      expect(within(items[1]).getByText('200 B')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Bắt đầu nạp/i }))

    await waitFor(() => {
      expect(mockedUploadDocument).toHaveBeenCalledTimes(2)
      expect(mockedUploadDocument.mock.calls[0][0]).toBe(fileA)
      expect(mockedUploadDocument.mock.calls[1][0]).toBe(fileB)
    })
  })

  // 16. Programmatic Guard Against Duplicate Start Clicks
  // Ghi chú: Kịch bản này kiểm tra behavioral coverage chống gửi trùng lặp qua UI khi request đang pending.
  // Cơ chế guard nội bộ (isUploading ref) sẽ được rà soát trong source code implementation.
  it('Scenario 16: Guard chống bấm bắt đầu lặp khi request đang xử lý', async () => {
    mockedListDocuments.mockResolvedValue({ data: mockDocs, meta: { total: 2, limit: 50, offset: 0 } })

    let resolveUpload!: (value: any) => void
    const slowPromise = new Promise((resolve) => {
      resolveUpload = resolve
    })
    mockedUploadDocument.mockReturnValue(slowPromise)

    renderWithClient(<KnowledgeView />)
    await waitFor(() => screen.getByRole('button', { name: /Nạp tài liệu/i }))
    fireEvent.click(screen.getByRole('button', { name: /Nạp tài liệu/i }))

    const file = new File(['data'], 'slow.md', { type: 'text/markdown' })
    fireEvent.change(screen.getByTestId('file-upload-input'), { target: { files: [file] } })

    const startBtn = screen.getByRole('button', { name: /Bắt đầu nạp/i })
    fireEvent.click(startBtn)

    // Wait until uploadDocument is actively in-flight
    await waitFor(() => {
      expect(mockedUploadDocument).toHaveBeenCalledTimes(1)
      expect(mockedUploadDocument.mock.calls[0][0]).toBe(file)
    })

    // Simulate consecutive rapid clicks while upload is pending
    fireEvent.click(startBtn)
    fireEvent.click(startBtn)

    // Guard prevents duplicate invocations
    expect(mockedUploadDocument).toHaveBeenCalledTimes(1)

    act(() => {
      resolveUpload({ status: 'success', document_id: 'doc-slow', filename: 'slow.md' })
    })
    await waitFor(() => {
      expect(mockedUploadDocument).toHaveBeenCalledTimes(1)
    })
  })

  // 17. Lock Modal Close Buttons and Controls During Upload
  it('Scenario 17: Khóa cả hai nút đóng modal và thao tác hàng đợi trong lúc đang nạp', async () => {
    mockedListDocuments.mockResolvedValue({ data: mockDocs, meta: { total: 2, limit: 50, offset: 0 } })

    let resolveUpload!: (value: any) => void
    const pendingPromise = new Promise((resolve) => {
      resolveUpload = resolve
    })
    mockedUploadDocument.mockReturnValue(pendingPromise)

    renderWithClient(<KnowledgeView />)
    await waitFor(() => screen.getByRole('button', { name: /Nạp tài liệu/i }))
    fireEvent.click(screen.getByRole('button', { name: /Nạp tài liệu/i }))

    const file = new File(['locked'], 'locked.md', { type: 'text/markdown' })
    fireEvent.change(screen.getByTestId('file-upload-input'), { target: { files: [file] } })

    const startBtn = screen.getByRole('button', { name: /Bắt đầu nạp/i })
    fireEvent.click(startBtn)

    await waitFor(() => {
      expect(screen.getByTestId('modal-close-icon-btn')).toBeDisabled()
      expect(screen.getByTestId('modal-close-footer-btn')).toBeDisabled()
      expect(screen.getByTestId('file-upload-input')).toBeDisabled()
      expect(screen.queryByTestId('remove-queue-item')).not.toBeInTheDocument()
    })

    act(() => {
      resolveUpload({ status: 'success', document_id: 'doc-locked', filename: 'locked.md' })
    })
    await waitFor(() => {
      expect(screen.getByTestId('modal-close-icon-btn')).toBeEnabled()
      expect(screen.getByTestId('modal-close-footer-btn')).toBeEnabled()
    })
  })

  // 18. File Item Removal, Cancel Picker, Re-selection, Input Reset
  // Ghi chú: jsdom cho phép kiểm tra input.value được reset về rỗng ('');
  // tương tác hộp thoại file picker của hệ điều hành dành cho acceptance test trên trình duyệt thật.
  it('Scenario 18: Bỏ tệp khỏi hàng đợi, cancel file picker giữ nguyên danh sách, chọn lại cùng tệp, reset input', async () => {
    mockedListDocuments.mockResolvedValue({ data: mockDocs, meta: { total: 2, limit: 50, offset: 0 } })

    renderWithClient(<KnowledgeView />)
    await waitFor(() => screen.getByRole('button', { name: /Nạp tài liệu/i }))
    fireEvent.click(screen.getByRole('button', { name: /Nạp tài liệu/i }))

    const fileInput = screen.getByTestId('file-upload-input') as HTMLInputElement
    const file1 = new File(['A'], 'fileA.md', { type: 'text/markdown' })
    const file2 = new File(['B'], 'fileB.md', { type: 'text/markdown' })

    fireEvent.change(fileInput, { target: { files: [file1, file2] } })

    await waitFor(() => {
      const items = screen.getAllByTestId('queue-item')
      expect(items).toHaveLength(2)
      expect(within(items[0]).getByText('fileA.md')).toBeInTheDocument()
      expect(within(items[1]).getByText('fileB.md')).toBeInTheDocument()
    })

    // Remove first item (fileA.md)
    const removeButtons = screen.getAllByTestId('remove-queue-item')
    fireEvent.click(removeButtons[0])

    await waitFor(() => {
      const items = screen.getAllByTestId('queue-item')
      expect(items).toHaveLength(1)
      expect(within(items[0]).getByText('fileB.md')).toBeInTheDocument()
      expect(screen.queryByText('fileA.md')).not.toBeInTheDocument()
    })

    // Cancel file picker: change event with empty files list must KEEP existing list
    fireEvent.change(fileInput, { target: { files: [] } })
    expect(screen.getByText('fileB.md')).toBeInTheDocument()

    // File input value is reset to allow re-selection
    expect(fileInput.value).toBe('')

    // Selecting fileB again replaces list when idle
    fireEvent.change(fileInput, { target: { files: [file2] } })
    await waitFor(() => {
      const items = screen.getAllByTestId('queue-item')
      expect(items).toHaveLength(1)
      expect(within(items[0]).getByText('fileB.md')).toBeInTheDocument()
    })
  })

  // 19. Both Modal Entry Points (Header & Empty State) Without Unmount/Remount
  it('Scenario 19: Cả hai nút mở modal (Header & Empty state) reset hàng đợi nhất quán trong cùng instance', async () => {
    // Render with empty documents list to expose both Header button and Empty State button
    mockedListDocuments.mockResolvedValue({ data: [], meta: { total: 0, limit: 50, offset: 0 } })
    renderWithClient(<KnowledgeView />)

    await waitFor(() => screen.getByText(/Chưa có tài liệu nào trong cơ sở tri thức/i))

    // 1. Test Header entry point
    const headerBtn = screen.getAllByRole('button', { name: /Nạp tài liệu/i })[0]
    fireEvent.click(headerBtn)
    expect(screen.getByText(/Tải lên tài liệu Markdown/i)).toBeInTheDocument()

    const file = new File(['temp'], 'temp.md', { type: 'text/markdown' })
    fireEvent.change(screen.getByTestId('file-upload-input'), { target: { files: [file] } })
    await waitFor(() => expect(screen.getAllByTestId('queue-item')).toHaveLength(1))

    // Close modal
    fireEvent.click(screen.getByRole('button', { name: /Đóng/i }))
    await waitFor(() => expect(screen.queryByText(/Tải lên tài liệu Markdown/i)).not.toBeInTheDocument())

    // Reopen from Header => queue must be cleanly reset
    fireEvent.click(headerBtn)
    expect(screen.getByText(/Tải lên tài liệu Markdown/i)).toBeInTheDocument()
    expect(screen.queryByTestId('queue-item')).not.toBeInTheDocument()

    // 2. Test Empty State entry point
    // Close modal first
    fireEvent.click(screen.getByRole('button', { name: /Đóng/i }))
    await waitFor(() => expect(screen.queryByText(/Tải lên tài liệu Markdown/i)).not.toBeInTheDocument())

    const emptyStateSection = screen.getByText(/Chưa có tài liệu nào trong cơ sở tri thức/i).closest('div')!
    const emptyStateBtn = within(emptyStateSection).getByRole('button', { name: /Nạp tài liệu/i })
    fireEvent.click(emptyStateBtn)
    expect(screen.getByText(/Tải lên tài liệu Markdown/i)).toBeInTheDocument()

    fireEvent.change(screen.getByTestId('file-upload-input'), { target: { files: [file] } })
    await waitFor(() => expect(screen.getAllByTestId('queue-item')).toHaveLength(1))

    // Close and reopen from Empty State => queue must be cleanly reset
    fireEvent.click(screen.getByRole('button', { name: /Đóng/i }))
    await waitFor(() => expect(screen.queryByText(/Tải lên tài liệu Markdown/i)).not.toBeInTheDocument())

    fireEvent.click(emptyStateBtn)
    expect(screen.getByText(/Tải lên tài liệu Markdown/i)).toBeInTheDocument()
    expect(screen.queryByTestId('queue-item')).not.toBeInTheDocument()
  })

  // 20. TanStack Query Cache Invalidation on Batch Completion and on Retry (Full Filter Preservation)
  it('Scenario 20: Invalidate [documents] query đúng 1 lần sau toàn batch và 1 lần sau retry, bảo toàn bộ lọc và refetch params', async () => {
    const testQueryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    })
    const invalidateSpy = jest.spyOn(testQueryClient, 'invalidateQueries')

    mockedListDocuments.mockResolvedValue({ data: mockDocs, meta: { total: 2, limit: 50, offset: 0 } })
    renderWithClient(<KnowledgeView />, testQueryClient)

    await waitFor(() => screen.getByRole('button', { name: /Nạp tài liệu/i }))

    // Set all 4 filters before upload
    const searchInput = screen.getByPlaceholderText(/Tìm kiếm tài liệu/i) as HTMLInputElement
    fireEvent.change(searchInput, { target: { value: 'ADR' } })

    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[]
    const topicSelect = selects[0]
    const statusSelect = selects[1]
    const goldenSelect = selects[2]

    fireEvent.change(topicSelect, { target: { value: 'architecture' } })
    fireEvent.change(statusSelect, { target: { value: 'canonical' } })
    fireEvent.change(goldenSelect, { target: { value: 'true' } })

    // Wait for filter-driven query to settle and record call count
    await waitFor(() => {
      expect(mockedListDocuments).toHaveBeenCalledWith(
        expect.objectContaining({
          q: 'ADR',
          topic: 'architecture',
          status: 'canonical',
          golden: true,
        })
      )
    })
    const callsBeforeUpload = mockedListDocuments.mock.calls.length

    fireEvent.click(screen.getByRole('button', { name: /Nạp tài liệu/i }))

    // Prepare 2 files for sequential batch upload
    const file1 = new File(['1'], 'batch1.md', { type: 'text/markdown' })
    const file2 = new File(['2'], 'batch2.md', { type: 'text/markdown' })
    fireEvent.change(screen.getByTestId('file-upload-input'), { target: { files: [file1, file2] } })

    let resolveInitial1!: (value: any) => void
    const initialPromise1 = new Promise((resolve) => {
      resolveInitial1 = resolve
    })
    let rejectInitial2!: (reason: any) => void
    const initialPromise2 = new Promise((_, reject) => {
      rejectInitial2 = reject
    })

    mockedUploadDocument
      .mockReturnValueOnce(initialPromise1)
      .mockReturnValueOnce(initialPromise2)

    fireEvent.click(screen.getByRole('button', { name: /Bắt đầu nạp/i }))

    // 1. Wait for upload call 1 to start and verify argument identity before checking invalidate
    await waitFor(() => expect(mockedUploadDocument).toHaveBeenCalledTimes(1))
    expect(mockedUploadDocument.mock.calls[0][0]).toBe(file1)
    expect(invalidateSpy).not.toHaveBeenCalled()

    // Resolve request 1 with async act
    await act(async () => {
      resolveInitial1({ status: 'success', document_id: 'd1', filename: 'batch1.md' })
    })

    // 2. Wait for upload call 2 to start and verify argument identity
    await waitFor(() => expect(mockedUploadDocument).toHaveBeenCalledTimes(2))
    expect(mockedUploadDocument.mock.calls[1][0]).toBe(file2)
    // While request 2 has started and is still pending: invalidate must STILL NOT be called
    expect(invalidateSpy).not.toHaveBeenCalled()

    // Reject request 2 with explicit reject function within async act
    await act(async () => {
      rejectInitial2(new Error('Network error on batch2'))
    })

    // 3. Batch is fully complete: exactly 1 invalidate call
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledTimes(1)
      expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['documents'] }))
      // Controls preserved
      expect(searchInput.value).toBe('ADR')
      expect(topicSelect.value).toBe('architecture')
      expect(statusSelect.value).toBe('canonical')
      expect(goldenSelect.value).toBe('true')
    })

    // Verify listDocuments refetch was invoked with exact filter params
    await waitFor(() => {
      expect(mockedListDocuments.mock.calls.length).toBeGreaterThan(callsBeforeUpload)
      const lastCallParams = mockedListDocuments.mock.calls[mockedListDocuments.mock.calls.length - 1][0]
      expect(lastCallParams).toEqual(
        expect.objectContaining({
          q: 'ADR',
          topic: 'architecture',
          status: 'canonical',
          golden: true,
        })
      )
    })

    const callsBeforeRetry = mockedListDocuments.mock.calls.length

    // Setup retry for batch2.md
    let resolveRetry!: (value: any) => void
    const retryPromise = new Promise((resolve) => {
      resolveRetry = resolve
    })
    mockedUploadDocument.mockReturnValueOnce(retryPromise)

    const retryBtn = await screen.findByRole('button', { name: /Thử lại tệp lỗi/i })
    fireEvent.click(retryBtn)

    // Wait for retry upload call (call 3) to start and verify identity
    await waitFor(() => expect(mockedUploadDocument).toHaveBeenCalledTimes(3))
    expect(mockedUploadDocument.mock.calls[2][0]).toBe(file2)
    // While retry is pending: invalidateSpy count has not increased (still exactly 1)
    expect(invalidateSpy).toHaveBeenCalledTimes(1)

    // Resolve retry with async act
    await act(async () => {
      resolveRetry({ status: 'success', document_id: 'd2-fixed', filename: 'batch2.md' })
    })

    // Invalidation after retry finishes: exactly 2 calls total
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledTimes(2)
      expect(searchInput.value).toBe('ADR')
      expect(topicSelect.value).toBe('architecture')
      expect(statusSelect.value).toBe('canonical')
      expect(goldenSelect.value).toBe('true')
    })

    // Verify refetch after retry preserves full filter params
    await waitFor(() => {
      expect(mockedListDocuments.mock.calls.length).toBeGreaterThan(callsBeforeRetry)
      const lastCallParamsAfterRetry = mockedListDocuments.mock.calls[mockedListDocuments.mock.calls.length - 1][0]
      expect(lastCallParamsAfterRetry).toEqual(
        expect.objectContaining({
          q: 'ADR',
          topic: 'architecture',
          status: 'canonical',
          golden: true,
        })
      )
    })
  })

  // 21. Comprehensive Malformed API Response Rejection Matrix
  it('Scenario 21: Phản hồi API vi phạm hợp đồng tối thiểu bị từ chối và tính là lỗi invalid_contract', async () => {
    mockedListDocuments.mockResolvedValue({ data: mockDocs, meta: { total: 2, limit: 50, offset: 0 } })

    // 5 Malformed response cases
    const malformedCases = [
      { name: 'm1.md', payload: null },
      { name: 'm2.md', payload: {} },
      { name: 'm3.md', payload: { status: 'unknown_type', document_id: 'd', filename: 'm3.md' } },
      { name: 'm4.md', payload: { status: 'success', document_id: '', filename: 'm4.md' } },
      { name: 'm5.md', payload: { status: 'success', document_id: 'd5', filename: '' } },
    ]

    for (const testCase of malformedCases) {
      mockedUploadDocument.mockResolvedValueOnce(testCase.payload)
    }

    renderWithClient(<KnowledgeView />)
    await waitFor(() => screen.getByRole('button', { name: /Nạp tài liệu/i }))
    fireEvent.click(screen.getByRole('button', { name: /Nạp tài liệu/i }))

    const files = malformedCases.map((c) => new File(['bad'], c.name, { type: 'text/markdown' }))
    fireEvent.change(screen.getByTestId('file-upload-input'), { target: { files } })
    fireEvent.click(screen.getByRole('button', { name: /Bắt đầu nạp/i }))

    await waitFor(() => {
      expect(mockedUploadDocument).toHaveBeenCalledTimes(5)
      const rows = screen.getAllByTestId('queue-item')
      expect(rows).toHaveLength(5)
      // All 5 rows must display exact error status badge
      for (const row of rows) {
        expect(within(row).getByText(/^Lỗi$/i)).toBeInTheDocument()
      }
      const summary = screen.getByTestId('upload-summary')
      expect(within(summary).getByText(/5 lỗi/i)).toBeInTheDocument()
      expect(within(summary).getByText(/0 thành công/i)).toBeInTheDocument()
      // All contract errors are eligible for retry
      expect(screen.getByRole('button', { name: /Thử lại tệp lỗi/i })).toBeInTheDocument()
    })
  })
})
