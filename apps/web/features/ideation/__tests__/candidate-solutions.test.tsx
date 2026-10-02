/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CandidateSolutions } from '../candidate-solutions'
import * as apiClient from '@/lib/api-client'
import type { CandidateSolutionsResponse, CandidateSolution } from '@/lib/types'

jest.mock('@/lib/api-client', () => ({
  listCandidateSolutions: jest.fn(),
  createCandidateSolution: jest.fn(),
  updateCandidateSolution: jest.fn(),
  deleteCandidateSolution: jest.fn(),
}))

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

const MOCK_SOLUTIONS: CandidateSolution[] = [
  {
    id: 'sol-001',
    session_id: 'ses-123',
    title: 'Màng nano polymer tự phục hồi',
    mechanism: 'Cơ chế tự liên kết ngang khi bề mặt xuất hiện vết nứt vi mô.',
    status: 'candidate',
    novelty_score: 0.85,
    feasibility_score: 0.75,
    risk_notes: 'Cần kiểm chứng độ ổn định nhiệt trên 80 độ C.',
    created_at: '2026-10-01T08:30:00Z',
    updated_at: '2026-10-01T08:30:00Z',
  },
  {
    id: 'sol-002',
    session_id: 'ses-123',
    title: 'Cánh tản nhiệt vi kênh đa tầng',
    mechanism: 'Ứng dụng vi dòng chảy cưỡng bức để giảm gradient nhiệt.',
    status: 'accepted',
    novelty_score: 0.9,
    feasibility_score: 0.8,
    risk_notes: null,
    created_at: '2026-10-01T09:00:00Z',
    updated_at: '2026-10-01T09:30:00Z',
  },
]

describe('CandidateSolutions Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // 1. Loading state
  it('1. render loading state khi đang tải dữ liệu', () => {
    ;(apiClient.listCandidateSolutions as jest.Mock).mockReturnValue(new Promise(() => {}))

    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <CandidateSolutions sessionId="ses-123" />
      </QueryClientProvider>
    )

    expect(screen.getByText(/đang tải giải pháp|đang tải/i)).toBeInTheDocument()
  })

  // 2. Empty state
  it('2. render empty state khi chưa có giải pháp ứng viên nào', async () => {
    const mockResponse: CandidateSolutionsResponse = {
      data: [],
      meta: { total: 0, session_id: 'ses-123' },
    }
    ;(apiClient.listCandidateSolutions as jest.Mock).mockResolvedValueOnce(mockResponse)

    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <CandidateSolutions sessionId="ses-123" />
      </QueryClientProvider>
    )

    expect(await screen.findByText(/chưa có giải pháp ứng viên nào/i)).toBeInTheDocument()
  })

  // 3. Error state & Retry
  it('3. render error state và cho phép bấm Thử lại khi API lỗi', async () => {
    ;(apiClient.listCandidateSolutions as jest.Mock).mockRejectedValueOnce(new Error('Lỗi mạng kết nối'))

    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <CandidateSolutions sessionId="ses-123" />
      </QueryClientProvider>
    )

    expect(await screen.findByText(/không thể tải danh sách giải pháp/i)).toBeInTheDocument()

    const mockResponse: CandidateSolutionsResponse = {
      data: MOCK_SOLUTIONS,
      meta: { total: 2, session_id: 'ses-123' },
    }
    ;(apiClient.listCandidateSolutions as jest.Mock).mockResolvedValueOnce(mockResponse)

    const retryBtn = screen.getByRole('button', { name: /thử lại|retry/i })
    fireEvent.click(retryBtn)

    expect(await screen.findByText('Màng nano polymer tự phục hồi')).toBeInTheDocument()
  })

  // 4. Render solutions list with title, mechanism, scores, risk notes
  it('4. render danh sách giải pháp với đầy đủ thông tin, trạng thái, điểm số và rủi ro', async () => {
    const mockResponse: CandidateSolutionsResponse = {
      data: MOCK_SOLUTIONS,
      meta: { total: 2, session_id: 'ses-123' },
    }
    ;(apiClient.listCandidateSolutions as jest.Mock).mockResolvedValueOnce(mockResponse)

    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <CandidateSolutions sessionId="ses-123" />
      </QueryClientProvider>
    )

    expect(await screen.findByText('Màng nano polymer tự phục hồi')).toBeInTheDocument()
    expect(screen.getByText('Cánh tản nhiệt vi kênh đa tầng')).toBeInTheDocument()
    expect(screen.getByText(/Cơ chế tự liên kết ngang/i)).toBeInTheDocument()
    expect(screen.getByText(/Cần kiểm chứng độ ổn định nhiệt/i)).toBeInTheDocument()
    expect(screen.getByText(/85%/i)).toBeInTheDocument()
    expect(screen.getByText(/75%/i)).toBeInTheDocument()
  })

  // 5. Filter solutions by status
  it('5. lọc danh sách giải pháp theo trạng thái (tất cả, đang xem xét, đã chấp nhận)', async () => {
    const mockResponse: CandidateSolutionsResponse = {
      data: MOCK_SOLUTIONS,
      meta: { total: 2, session_id: 'ses-123' },
    }
    ;(apiClient.listCandidateSolutions as jest.Mock).mockResolvedValue(mockResponse)

    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <CandidateSolutions sessionId="ses-123" />
      </QueryClientProvider>
    )

    await screen.findByText('Màng nano polymer tự phục hồi')
    expect(screen.getByText('Cánh tản nhiệt vi kênh đa tầng')).toBeInTheDocument()

    // Click filter "Đã chấp nhận" (accepted)
    const acceptedFilter = screen.getByRole('button', { name: /^đã chấp nhận$/i })
    fireEvent.click(acceptedFilter)

    expect(screen.queryByText('Màng nano polymer tự phục hồi')).not.toBeInTheDocument()
    expect(screen.getByText('Cánh tản nhiệt vi kênh đa tầng')).toBeInTheDocument()

    // Click filter "Tất cả"
    const allFilter = screen.getByRole('button', { name: /^tất cả$/i })
    fireEvent.click(allFilter)

    expect(screen.getByText('Màng nano polymer tự phục hồi')).toBeInTheDocument()
    expect(screen.getByText('Cánh tản nhiệt vi kênh đa tầng')).toBeInTheDocument()
  })

  // 6. Create candidate solution successfully
  it('6. tạo giải pháp mới thành công, gọi API và reset form nhập', async () => {
    const mockResponse: CandidateSolutionsResponse = {
      data: [MOCK_SOLUTIONS[0]],
      meta: { total: 1, session_id: 'ses-123' },
    }
    ;(apiClient.listCandidateSolutions as jest.Mock).mockResolvedValue(mockResponse)

    const newSolution: CandidateSolution = {
      id: 'sol-003',
      session_id: 'ses-123',
      title: 'Hợp kim nhớ hình Nitinol cải tiến',
      mechanism: 'Phục hồi hình dạng ở nhiệt độ 45 độ C.',
      status: 'candidate',
      novelty_score: 0.8,
      feasibility_score: 0.9,
      risk_notes: 'Giá thành vật liệu cao.',
      created_at: '2026-10-01T10:00:00Z',
      updated_at: '2026-10-01T10:00:00Z',
    }
    ;(apiClient.createCandidateSolution as jest.Mock).mockResolvedValueOnce(newSolution)

    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <CandidateSolutions sessionId="ses-123" />
      </QueryClientProvider>
    )

    await screen.findByText('Màng nano polymer tự phục hồi')

    const titleInput = screen.getByPlaceholderText(/tiêu đề giải pháp|tên giải pháp/i)
    const mechanismInput = screen.getByPlaceholderText(/mô tả cơ chế hoạt động|cơ chế giải pháp/i)
    const noveltyInput = screen.getByLabelText(/điểm mới|novelty/i)
    const feasibilityInput = screen.getByLabelText(/tính khả thi|feasibility/i)
    const riskInput = screen.getByPlaceholderText(/rủi ro, thách thức hoặc ghi chú/i)
    const submitBtn = screen.getByRole('button', { name: /lưu giải pháp|thêm giải pháp/i })

    fireEvent.change(titleInput, { target: { value: 'Hợp kim nhớ hình Nitinol cải tiến' } })
    fireEvent.change(mechanismInput, { target: { value: 'Phục hồi hình dạng ở nhiệt độ 45 độ C.' } })
    fireEvent.change(noveltyInput, { target: { value: '0.8' } })
    fireEvent.change(feasibilityInput, { target: { value: '0.9' } })
    fireEvent.change(riskInput, { target: { value: 'Giá thành vật liệu cao.' } })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(apiClient.createCandidateSolution).toHaveBeenCalledWith('ses-123', {
        title: 'Hợp kim nhớ hình Nitinol cải tiến',
        mechanism: 'Phục hồi hình dạng ở nhiệt độ 45 độ C.',
        status: 'candidate',
        novelty_score: 0.8,
        feasibility_score: 0.9,
        risk_notes: 'Giá thành vật liệu cao.',
      })
    })

    expect(titleInput).toHaveValue('')
    expect(mechanismInput).toHaveValue('')
  })

  // 7. Blank validation
  it('7. validate tiêu đề hoặc cơ chế rỗng hiển thị lỗi và không gọi API', async () => {
    const mockResponse: CandidateSolutionsResponse = {
      data: [],
      meta: { total: 0, session_id: 'ses-123' },
    }
    ;(apiClient.listCandidateSolutions as jest.Mock).mockResolvedValueOnce(mockResponse)

    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <CandidateSolutions sessionId="ses-123" />
      </QueryClientProvider>
    )

    await screen.findByText(/chưa có giải pháp ứng viên nào/i)

    const titleInput = screen.getByPlaceholderText(/tiêu đề giải pháp|tên giải pháp/i)
    const submitBtn = screen.getByRole('button', { name: /lưu giải pháp|thêm giải pháp/i })

    fireEvent.change(titleInput, { target: { value: '   ' } })
    fireEvent.click(submitBtn)

    expect(apiClient.createCandidateSolution).not.toHaveBeenCalled()
    expect(screen.getByText(/vui lòng nhập tiêu đề/i)).toBeInTheDocument()
  })

  // 8. Update solution status
  it('8. cập nhật trạng thái giải pháp sang accepted/rejected', async () => {
    const mockResponse: CandidateSolutionsResponse = {
      data: [MOCK_SOLUTIONS[0]],
      meta: { total: 1, session_id: 'ses-123' },
    }
    ;(apiClient.listCandidateSolutions as jest.Mock).mockResolvedValue(mockResponse)
    ;(apiClient.updateCandidateSolution as jest.Mock).mockResolvedValueOnce({
      ...MOCK_SOLUTIONS[0],
      status: 'accepted',
    })

    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <CandidateSolutions sessionId="ses-123" />
      </QueryClientProvider>
    )

    await screen.findByText('Màng nano polymer tự phục hồi')

    const acceptBtn = screen.getByRole('button', { name: /^chấp nhận$/i })
    fireEvent.click(acceptBtn)

    await waitFor(() => {
      expect(apiClient.updateCandidateSolution).toHaveBeenCalledWith('ses-123', 'sol-001', {
        status: 'accepted',
      })
    })
  })

  // 9. Delete solution
  it('9. xóa giải pháp gọi deleteCandidateSolution với đúng session_id và solution_id', async () => {
    const mockResponse: CandidateSolutionsResponse = {
      data: [MOCK_SOLUTIONS[0]],
      meta: { total: 1, session_id: 'ses-123' },
    }
    ;(apiClient.listCandidateSolutions as jest.Mock).mockResolvedValue(mockResponse)
    ;(apiClient.deleteCandidateSolution as jest.Mock).mockResolvedValueOnce({
      status: 'deleted',
      id: 'sol-001',
      session_id: 'ses-123',
    })

    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <CandidateSolutions sessionId="ses-123" />
      </QueryClientProvider>
    )

    await screen.findByText('Màng nano polymer tự phục hồi')

    const deleteBtn = screen.getByRole('button', { name: /xóa giải pháp|xóa/i })
    fireEvent.click(deleteBtn)

    await waitFor(() => {
      expect(apiClient.deleteCandidateSolution).toHaveBeenCalledWith('ses-123', 'sol-001')
    })
  })

  // 10. Session switch isolation
  it('10. gọi API với đúng session_id mới khi sessionId prop thay đổi', async () => {
    const mockRes1: CandidateSolutionsResponse = {
      data: [MOCK_SOLUTIONS[0]],
      meta: { total: 1, session_id: 'ses-123' },
    }
    const mockRes2: CandidateSolutionsResponse = {
      data: [MOCK_SOLUTIONS[1]],
      meta: { total: 1, session_id: 'ses-456' },
    }
    ;(apiClient.listCandidateSolutions as jest.Mock)
      .mockResolvedValueOnce(mockRes1)
      .mockResolvedValueOnce(mockRes2)

    const queryClient = createTestQueryClient()
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <CandidateSolutions sessionId="ses-123" />
      </QueryClientProvider>
    )

    expect(await screen.findByText('Màng nano polymer tự phục hồi')).toBeInTheDocument()
    expect(apiClient.listCandidateSolutions).toHaveBeenCalledWith('ses-123')

    rerender(
      <QueryClientProvider client={queryClient}>
        <CandidateSolutions sessionId="ses-456" />
      </QueryClientProvider>
    )

    expect(await screen.findByText('Cánh tản nhiệt vi kênh đa tầng')).toBeInTheDocument()
    expect(apiClient.listCandidateSolutions).toHaveBeenCalledWith('ses-456')
  })

  // 11. onSaveAsNote bridge callback
  it('11. kích hoạt callback onSaveAsNote khi người dùng bấm Lưu vào sổ tay trên thẻ giải pháp', async () => {
    const mockResponse: CandidateSolutionsResponse = {
      data: MOCK_SOLUTIONS,
      meta: { total: 2, session_id: 'ses-123' },
    }
    ;(apiClient.listCandidateSolutions as jest.Mock).mockResolvedValueOnce(mockResponse)
    const onSaveAsNoteMock = jest.fn()

    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <CandidateSolutions sessionId="ses-123" onSaveAsNote={onSaveAsNoteMock} />
      </QueryClientProvider>
    )

    await screen.findByText('Màng nano polymer tự phục hồi')

    const saveBtns = screen.getAllByRole('button', { name: /lưu vào sổ tay|lưu thành ghi chú/i })
    expect(saveBtns.length).toBeGreaterThan(0)
    fireEvent.click(saveBtns[0])

    expect(onSaveAsNoteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Màng nano polymer tự phục hồi'),
        note_type: 'hypothesis',
      })
    )
  })
})
