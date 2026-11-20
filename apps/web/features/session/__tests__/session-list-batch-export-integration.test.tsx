/** @jest-environment jsdom */
import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionList } from '../session-list'
import {
  listSessions,
  createSession,
  archiveSession,
  restoreSession,
  importSession,
  getSessionTemplates,
  createSessionFromTemplate,
  batchExportSessions,
} from '@/lib/api-client'
import type { ResearchSession } from '@/lib/types'

// Mock api-client
jest.mock('@/lib/api-client', () => ({
  listSessions: jest.fn(),
  createSession: jest.fn(),
  archiveSession: jest.fn(),
  restoreSession: jest.fn(),
  importSession: jest.fn(),
  getSessionTemplates: jest.fn(),
  createSessionFromTemplate: jest.fn(),
  batchExportSessions: jest.fn(),
}))

const mockedListSessions = listSessions as jest.MockedFunction<typeof listSessions>
const mockedBatchExportSessions = batchExportSessions as jest.MockedFunction<typeof batchExportSessions>

const MOCK_SESSIONS: ResearchSession[] = [
  {
    id: 's-001',
    title: 'Nghiên cứu Pin Lithium Silicon',
    description: 'Tối ưu mật độ năng lượng và chống suy giảm dung lượng.',
    domain: 'business',
    status: 'active',
    created_at: '2026-11-01T10:00:00Z',
    updated_at: '2026-11-05T12:00:00Z',
    tags: ['pin', 'silicon', 'energy'],
  },
  {
    id: 's-002',
    title: 'Vật liệu bán dẫn GaN 2026',
    description: 'Ứng dụng trong trạm sạc xe điện cao tốc.',
    domain: 'sustainability',
    status: 'active',
    created_at: '2026-11-02T10:00:00Z',
    updated_at: '2026-11-06T12:00:00Z',
    tags: ['gan', 'semiconductor'],
  },
  {
    id: 's-003',
    title: 'Thuật toán tối ưu tuyến xe buýt điện',
    description: 'Giảm thiểu thời gian chờ và tiêu hao năng lượng.',
    domain: 'society',
    status: 'active',
    created_at: '2026-11-03T10:00:00Z',
    updated_at: '2026-11-07T12:00:00Z',
    tags: ['bus', 'smart-city'],
  },
]

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })
}

function renderWithClient(ui: React.ReactElement, customQueryClient?: QueryClient) {
  const queryClient = customQueryClient ?? createTestQueryClient()
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return {
    ...render(ui, { wrapper: Wrapper }),
    queryClient,
  }
}

describe('C39 Lô 3: SessionList Multi-Select & Batch Export Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    window.URL.createObjectURL = jest.fn(() => 'blob:mock-url')
    window.URL.revokeObjectURL = jest.fn()
    mockedListSessions.mockResolvedValue({
      data: MOCK_SESSIONS,
      meta: { total: 3 },
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('Gherkin 3.1: Checkbox xuất hiện trên từng thẻ session card kèm aria-label="Chọn phiên: {title}"', async () => {
    renderWithClient(<SessionList />)

    await waitFor(() => {
      expect(screen.getByText('Nghiên cứu Pin Lithium Silicon')).toBeInTheDocument()
    })

    const cb1 = screen.getByRole('checkbox', {
      name: 'Chọn phiên: Nghiên cứu Pin Lithium Silicon',
    })
    const cb2 = screen.getByRole('checkbox', {
      name: 'Chọn phiên: Vật liệu bán dẫn GaN 2026',
    })
    const cb3 = screen.getByRole('checkbox', {
      name: 'Chọn phiên: Thuật toán tối ưu tuyến xe buýt điện',
    })

    expect(cb1).toBeInTheDocument()
    expect(cb1).not.toBeChecked()
    expect(cb2).toBeInTheDocument()
    expect(cb2).not.toBeChecked()
    expect(cb3).toBeInTheDocument()
    expect(cb3).not.toBeChecked()
  })

  it('Gherkin 3.2: Khi tích chọn 1 thẻ, xuất hiện FloatingBatchToolbar hiển thị "Đã chọn 1 phiên" với aria-live="polite"', async () => {
    renderWithClient(<SessionList />)

    await waitFor(() => {
      expect(screen.getByText('Nghiên cứu Pin Lithium Silicon')).toBeInTheDocument()
    })

    // Trước khi chọn, toolbar không có trong DOM
    expect(screen.queryByTestId('floating-batch-toolbar')).not.toBeInTheDocument()

    // Chọn session đầu tiên
    const cb1 = screen.getByRole('checkbox', {
      name: 'Chọn phiên: Nghiên cứu Pin Lithium Silicon',
    })
    fireEvent.click(cb1)
    expect(cb1).toBeChecked()

    // Toolbar xuất hiện
    const toolbar = await screen.findByTestId('floating-batch-toolbar')
    expect(toolbar).toBeInTheDocument()

    // Kiểm tra thông báo số lượng có aria-live="polite"
    const liveCounter = screen.getByTestId('batch-selection-counter')
    expect(liveCounter).toHaveAttribute('aria-live', 'polite')
    expect(liveCounter).toHaveTextContent(/Đã chọn 1 phiên/i)

    // Chọn thêm session thứ 2
    const cb2 = screen.getByRole('checkbox', {
      name: 'Chọn phiên: Vật liệu bán dẫn GaN 2026',
    })
    fireEvent.click(cb2)
    expect(liveCounter).toHaveTextContent(/Đã chọn 2 phiên/i)
  })

  it('Gherkin 3.3: Master checkbox "Chọn tất cả trên trang này" chọn/bỏ chọn đồng loạt mọi session đang hiển thị', async () => {
    renderWithClient(<SessionList />)

    await waitFor(() => {
      expect(screen.getByText('Nghiên cứu Pin Lithium Silicon')).toBeInTheDocument()
    })

    const masterCheckbox = screen.getByRole('checkbox', {
      name: /Chọn tất cả phiên trên trang/i,
    })
    expect(masterCheckbox).not.toBeChecked()

    // Click master -> chọn tất cả 3 phiên
    fireEvent.click(masterCheckbox)
    expect(masterCheckbox).toBeChecked()

    const cb1 = screen.getByRole('checkbox', { name: 'Chọn phiên: Nghiên cứu Pin Lithium Silicon' })
    const cb2 = screen.getByRole('checkbox', { name: 'Chọn phiên: Vật liệu bán dẫn GaN 2026' })
    const cb3 = screen.getByRole('checkbox', { name: 'Chọn phiên: Thuật toán tối ưu tuyến xe buýt điện' })

    expect(cb1).toBeChecked()
    expect(cb2).toBeChecked()
    expect(cb3).toBeChecked()

    const liveCounter = screen.getByTestId('batch-selection-counter')
    expect(liveCounter).toHaveTextContent(/Đã chọn 3 phiên/i)

    // Click master lần nữa -> bỏ chọn tất cả
    fireEvent.click(masterCheckbox)
    expect(masterCheckbox).not.toBeChecked()
    expect(cb1).not.toBeChecked()
    expect(cb2).not.toBeChecked()
    expect(cb3).not.toBeChecked()
    expect(screen.queryByTestId('floating-batch-toolbar')).not.toBeInTheDocument()
  })

  it('Gherkin 3.4: Nút "Bỏ chọn tất cả" đưa danh sách chọn về rỗng và ẩn thanh công cụ nổi', async () => {
    renderWithClient(<SessionList />)

    await waitFor(() => {
      expect(screen.getByText('Nghiên cứu Pin Lithium Silicon')).toBeInTheDocument()
    })

    const cb1 = screen.getByRole('checkbox', { name: 'Chọn phiên: Nghiên cứu Pin Lithium Silicon' })
    fireEvent.click(cb1)

    const clearBtn = await screen.findByRole('button', { name: /Bỏ chọn tất cả/i })
    fireEvent.click(clearBtn)

    expect(cb1).not.toBeChecked()
    expect(screen.queryByTestId('floating-batch-toolbar')).not.toBeInTheDocument()
  })

  it('Gherkin 3.5: Nút "Xuất các phiên đã chọn" trên thanh công cụ mở BatchExportModal với đúng danh sách ID đã chọn', async () => {
    renderWithClient(<SessionList />)

    await waitFor(() => {
      expect(screen.getByText('Nghiên cứu Pin Lithium Silicon')).toBeInTheDocument()
    })

    const cb1 = screen.getByRole('checkbox', { name: 'Chọn phiên: Nghiên cứu Pin Lithium Silicon' })
    const cb2 = screen.getByRole('checkbox', { name: 'Chọn phiên: Vật liệu bán dẫn GaN 2026' })
    fireEvent.click(cb1)
    fireEvent.click(cb2)

    const exportSelectedBtn = await screen.findByRole('button', {
      name: /Xuất các phiên đã chọn/i,
    })
    fireEvent.click(exportSelectedBtn)

    // Modal xuất hiện
    const modalTitle = await screen.findByRole('heading', { name: /Xuất Lưu Trữ Hàng Loạt/i })
    expect(modalTitle).toBeInTheDocument()

    // Hiển thị text "Đang xuất 2 phiên nghiên cứu đã chọn..."
    expect(screen.getByText(/Đang xuất 2 phiên nghiên cứu đã chọn/i)).toBeInTheDocument()
  })

  it('Gherkin 3.6: Nút "Xuất lưu trữ" trên header mở BatchExportModal với chế độ bộ lọc', async () => {
    renderWithClient(<SessionList />)

    await waitFor(() => {
      expect(screen.getByText('Nghiên cứu Pin Lithium Silicon')).toBeInTheDocument()
    })

    const headerExportBtn = screen.getByRole('button', {
      name: /Xuất lưu trữ hàng loạt/i,
    })
    fireEvent.click(headerExportBtn)

    // Modal xuất hiện
    const modalTitle = await screen.findByRole('heading', { name: /Xuất Lưu Trữ Hàng Loạt/i })
    expect(modalTitle).toBeInTheDocument()

    // Chế độ bộ lọc hiển thị thông báo xuất theo bộ lọc tìm kiếm
    expect(screen.getByText(/Xuất theo bộ lọc tìm kiếm ra tệp nén ZIP/i)).toBeInTheDocument()
  })

  it('Gherkin 3.7: Khi xuất thành công với archive_after_export = true, làm mới danh sách và xóa chọn', async () => {
    mockedBatchExportSessions.mockResolvedValueOnce(new Blob(['mock zip content']))
    const { queryClient } = renderWithClient(<SessionList />)
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')

    await waitFor(() => {
      expect(screen.getByText('Nghiên cứu Pin Lithium Silicon')).toBeInTheDocument()
    })

    const cb1 = screen.getByRole('checkbox', { name: 'Chọn phiên: Nghiên cứu Pin Lithium Silicon' })
    fireEvent.click(cb1)

    const exportSelectedBtn = await screen.findByRole('button', {
      name: /Xuất các phiên đã chọn/i,
    })
    fireEvent.click(exportSelectedBtn)

    // Chọn checkbox archive
    const archiveCheckbox = screen.getByRole('checkbox', {
      name: /Đồng thời chuyển sang Đã lưu trữ/i,
    })
    fireEvent.click(archiveCheckbox)
    expect(archiveCheckbox).toBeChecked()

    // Bấm nút Tải xuống tệp ZIP
    const submitBtn = screen.getByRole('button', { name: /Tải xuống tệp ZIP/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockedBatchExportSessions).toHaveBeenCalledWith(
        expect.objectContaining({
          session_ids: ['s-001'],
          archive_after_export: true,
        })
      )
    })

    // Modal đóng
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Xuất Lưu Trữ Hàng Loạt/i })).not.toBeInTheDocument()
    })

    // Invalidate query đã được gọi
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['sessions'] })
    )

    // Selection đã được xóa sạch
    expect(screen.queryByTestId('floating-batch-toolbar')).not.toBeInTheDocument()
  })

  it('Gherkin 3.8: Khi modal đóng mà không xuất, danh sách chọn vẫn được bảo toàn', async () => {
    renderWithClient(<SessionList />)

    await waitFor(() => {
      expect(screen.getByText('Nghiên cứu Pin Lithium Silicon')).toBeInTheDocument()
    })

    const cb1 = screen.getByRole('checkbox', { name: 'Chọn phiên: Nghiên cứu Pin Lithium Silicon' })
    fireEvent.click(cb1)

    const exportSelectedBtn = await screen.findByRole('button', {
      name: /Xuất các phiên đã chọn/i,
    })
    fireEvent.click(exportSelectedBtn)

    // Đóng modal bằng nút Hủy
    const cancelBtn = screen.getByRole('button', { name: /^Hủy$/i })
    fireEvent.click(cancelBtn)

    // Modal đóng
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Xuất Lưu Trữ Hàng Loạt/i })).not.toBeInTheDocument()
    })

    // Selection vẫn còn
    expect(cb1).toBeChecked()
    expect(screen.getByTestId('floating-batch-toolbar')).toBeInTheDocument()
  })
})
