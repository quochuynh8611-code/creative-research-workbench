/** @jest-environment jsdom */
import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionList } from '../session-list'
import { listSessions, createSession } from '@/lib/api-client'
import type { ResearchSession, SessionListResponse } from '@/lib/types'

// Mock api-client to avoid actual network calls
jest.mock('@/lib/api-client', () => ({
  listSessions: jest.fn(),
  createSession: jest.fn(),
}))

const mockedListSessions = listSessions as jest.MockedFunction<typeof listSessions>
const mockedCreateSession = createSession as jest.MockedFunction<typeof createSession>

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
  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        {ui}
      </QueryClientProvider>
    ),
    queryClient,
  }
}

const MOCK_API_SESSIONS: ResearchSession[] = [
  {
    id: 'session-101',
    title: 'Nghiên cứu pin thể rắn cho xe điện',
    description: 'Tăng mật độ năng lượng và giảm nguy cơ cháy nổ',
    domain: 'technical',
    status: 'active',
    workflow_state: 'structuring',
    tags: ['battery', 'ev', 'triz'],
    created_at: '2026-03-01T10:00:00Z',
    updated_at: '2026-03-01T12:00:00Z',
    problem_frame: null,
  },
  {
    id: 'session-102',
    title: 'Tối ưu chi phí logistics chuỗi cung ứng lạnh',
    description: 'Giảm hao hụt nhiệt độ trong quá trình vận chuyển',
    domain: 'business',
    status: 'draft',
    workflow_state: 'idle',
    tags: ['supply-chain', 'cold-chain'],
    created_at: '2026-03-02T08:00:00Z',
    updated_at: '2026-03-02T09:30:00Z',
    problem_frame: null,
  },
]

describe('SessionList Read Path (Phase 5.3a)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('1. Hiển thị Loading state khi đang fetch dữ liệu session từ API', async () => {
    // Return pending promise
    mockedListSessions.mockImplementation(() => new Promise(() => {}))

    renderWithClient(<SessionList />)

    // Should display a loading indicator or skeleton
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText(/đang tải danh sách sessions/i)).toBeInTheDocument()
  })

  it('2. Hiển thị Error state kèm nút thử lại khi gọi API thất bại', async () => {
    mockedListSessions.mockRejectedValue(new Error('Failed to fetch sessions'))

    renderWithClient(<SessionList />)

    await waitFor(() => {
      expect(screen.getByText(/không thể tải|lỗi/i)).toBeInTheDocument()
    })

    // Should render a retry button
    const retryButton = screen.getByRole('button', { name: /thử lại|retry/i })
    expect(retryButton).toBeInTheDocument()
  })

  it('3. Hiển thị Empty state khi danh sách sessions trả về rỗng', async () => {
    const emptyResponse: SessionListResponse = {
      data: [],
      meta: { total: 0 },
    }
    mockedListSessions.mockResolvedValue(emptyResponse)

    renderWithClient(<SessionList />)

    await waitFor(() => {
      expect(screen.getByText(/chưa có session nào/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/0 sessions/i)).toBeInTheDocument()
  })

  it('4. Hiển thị danh sách Session Cards khi fetch thành công từ backend', async () => {
    const successResponse: SessionListResponse = {
      data: MOCK_API_SESSIONS,
      meta: { total: 2 },
    }
    mockedListSessions.mockResolvedValue(successResponse)

    renderWithClient(<SessionList />)

    await waitFor(() => {
      expect(screen.getByText('Nghiên cứu pin thể rắn cho xe điện')).toBeInTheDocument()
    })

    expect(screen.getByText('Tối ưu chi phí logistics chuỗi cung ứng lạnh')).toBeInTheDocument()
    expect(screen.getByText(/2 sessions/i)).toBeInTheDocument()
    expect(screen.getByText(/#battery/i)).toBeInTheDocument()
    expect(screen.getByText(/#supply-chain/i)).toBeInTheDocument()
  })
})

describe('SessionList Create Path', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedListSessions.mockResolvedValue({
      data: MOCK_API_SESSIONS,
      meta: { total: 2 },
    })
  })

  it('5. Mở và đóng form tạo session mới khi tương tác nút tạo/hủy', async () => {
    renderWithClient(<SessionList />)

    await waitFor(() => {
      expect(screen.getByText('Research Sessions')).toBeInTheDocument()
    })

    // Click 'Tạo session mới'
    const openButton = screen.getByRole('button', { name: /tạo session mới/i })
    fireEvent.click(openButton)

    // Form inputs should be visible
    expect(screen.getByLabelText(/tiêu đề/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /hủy/i })).toBeInTheDocument()

    // Click 'Hủy'
    const cancelButton = screen.getByRole('button', { name: /hủy/i })
    fireEvent.click(cancelButton)

    // Form should be closed
    expect(screen.queryByLabelText(/tiêu đề/i)).not.toBeInTheDocument()
  })

  it('6. Validate bắt buộc nhập tiêu đề trước khi submit form', async () => {
    renderWithClient(<SessionList />)

    await waitFor(() => {
      expect(screen.getByText('Research Sessions')).toBeInTheDocument()
      expect(screen.getByText('Nghiên cứu pin thể rắn cho xe điện')).toBeInTheDocument()
    })

    // Open form
    fireEvent.click(screen.getByRole('button', { name: /tạo session mới/i }))

    // Submit with empty title
    const submitButton = screen.getByRole('button', { name: /^tạo session$/i })
    fireEvent.click(submitButton)

    // Validation error should show, API should NOT be called
    expect(screen.getByText(/tiêu đề không được để trống|vui lòng nhập tiêu đề/i)).toBeInTheDocument()
    expect(mockedCreateSession).not.toHaveBeenCalled()
  })

  it('7. Submit thành công gọi createSession với payload đúng và đóng form', async () => {
    const newSession: ResearchSession = {
      id: 'session-103',
      title: 'Hệ thống pin mặt trời perovskite',
      description: 'Nâng cao hiệu suất chuyển đổi quang năng',
      domain: 'technical',
      status: 'active',
      workflow_state: 'idle',
      tags: ['solar', 'energy'],
      created_at: '2026-03-03T10:00:00Z',
      updated_at: '2026-03-03T10:00:00Z',
      problem_frame: null,
    }
    mockedCreateSession.mockResolvedValue(newSession)

    renderWithClient(<SessionList />)

    await waitFor(() => {
      expect(screen.getByText('Research Sessions')).toBeInTheDocument()
      expect(screen.getByText('Nghiên cứu pin thể rắn cho xe điện')).toBeInTheDocument()
    })

    // Open form
    fireEvent.click(screen.getByRole('button', { name: /tạo session mới/i }))

    // Fill inputs
    fireEvent.change(screen.getByLabelText(/tiêu đề/i), {
      target: { value: 'Hệ thống pin mặt trời perovskite' },
    })
    fireEvent.change(screen.getByLabelText(/mô tả/i), {
      target: { value: 'Nâng cao hiệu suất chuyển đổi quang năng' },
    })
    fireEvent.change(screen.getByLabelText(/tags/i), {
      target: { value: 'solar, energy' },
    })

    // Submit
    const submitButton = screen.getByRole('button', { name: /^tạo session$/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockedCreateSession).toHaveBeenCalled()
    })
    expect(mockedCreateSession.mock.calls[0][0]).toEqual({
      title: 'Hệ thống pin mặt trời perovskite',
      description: 'Nâng cao hiệu suất chuyển đổi quang năng',
      domain: 'technical',
      tags: ['solar', 'energy'],
    })

    // Form should close after success
    await waitFor(() => {
      expect(screen.queryByLabelText(/tiêu đề/i)).not.toBeInTheDocument()
    })
  })

  it('8. Hiển thị thông báo lỗi khi createSession thất bại và giữ form mở', async () => {
    mockedCreateSession.mockRejectedValue(new Error('Lỗi máy chủ khi tạo session'))

    renderWithClient(<SessionList />)

    await waitFor(() => {
      expect(screen.getByText('Research Sessions')).toBeInTheDocument()
      expect(screen.getByText('Nghiên cứu pin thể rắn cho xe điện')).toBeInTheDocument()
    })

    // Open form
    fireEvent.click(screen.getByRole('button', { name: /tạo session mới/i }))

    // Fill title
    fireEvent.change(screen.getByLabelText(/tiêu đề/i), {
      target: { value: 'Thử nghiệm thất bại' },
    })

    // Submit
    const submitButton = screen.getByRole('button', { name: /^tạo session$/i })
    fireEvent.click(submitButton)

    // Should display error message
    await waitFor(() => {
      expect(screen.getByText(/lỗi máy chủ khi tạo session/i)).toBeInTheDocument()
    })

    // Form should STILL be open
    expect(screen.getByLabelText(/tiêu đề/i)).toBeInTheDocument()
  })
})

describe('SessionList Search & Filter Enhancement (Phase 5.3c RED)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedListSessions.mockResolvedValue({
      data: MOCK_API_SESSIONS,
      meta: { total: 2 },
    })
  })

  it('9. Tìm kiếm session theo Tag (#tag hoặc tag)', async () => {
    renderWithClient(<SessionList />)

    await waitFor(() => {
      expect(screen.getByText('Research Sessions')).toBeInTheDocument()
      expect(screen.getByText('Nghiên cứu pin thể rắn cho xe điện')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText(/tìm session theo tên/i)

    // Search by tag name 'battery' (which is in tags of session-101 but not in its title)
    fireEvent.change(searchInput, { target: { value: 'battery' } })

    // Should display session-101 and NOT session-102
    expect(screen.getByText('Nghiên cứu pin thể rắn cho xe điện')).toBeInTheDocument()
    expect(screen.queryByText('Tối ưu chi phí logistics chuỗi cung ứng lạnh')).not.toBeInTheDocument()

    // Search by hashtag '#cold-chain'
    fireEvent.change(searchInput, { target: { value: '#cold-chain' } })

    // Should display session-102 and NOT session-101
    expect(screen.getByText('Tối ưu chi phí logistics chuỗi cung ứng lạnh')).toBeInTheDocument()
    expect(screen.queryByText('Nghiên cứu pin thể rắn cho xe điện')).not.toBeInTheDocument()
  })

  it('10. Tìm kiếm session theo nội dung Mô tả (Description)', async () => {
    renderWithClient(<SessionList />)

    await waitFor(() => {
      expect(screen.getByText('Research Sessions')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText(/tìm session theo tên/i)

    // Search keyword in description of session-102: "hao hụt nhiệt độ"
    fireEvent.change(searchInput, { target: { value: 'hao hụt nhiệt độ' } })

    expect(screen.getByText('Tối ưu chi phí logistics chuỗi cung ứng lạnh')).toBeInTheDocument()
    expect(screen.queryByText('Nghiên cứu pin thể rắn cho xe điện')).not.toBeInTheDocument()
  })

  it('11. Cập nhật header counter dạng X / Y sessions khi đang lọc', async () => {
    renderWithClient(<SessionList />)

    await waitFor(() => {
      expect(screen.getByText(/2 sessions/i)).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText(/tìm session theo tên/i)

    // Filter down to 1 session
    fireEvent.change(searchInput, { target: { value: 'logistics' } })

    // Counter should show "1 / 2 sessions"
    expect(screen.getByText(/1 \/ 2 sessions/i)).toBeInTheDocument()
  })

  it('12. Hiển thị nút Xóa tìm kiếm khi không có kết quả và reset input khi bấm', async () => {
    renderWithClient(<SessionList />)

    await waitFor(() => {
      expect(screen.getByText('Nghiên cứu pin thể rắn cho xe điện')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText(/tìm session theo tên/i)

    // Search non-existent term
    fireEvent.change(searchInput, { target: { value: 'tu_khoa_khong_ton_tai_xyz' } })

    // Should show empty message with reset button
    expect(screen.getByText(/không tìm thấy session nào/i)).toBeInTheDocument()
    const clearButton = screen.getByRole('button', { name: /xóa tìm kiếm|xóa bộ lọc/i })
    expect(clearButton).toBeInTheDocument()

    // Click clear button
    fireEvent.click(clearButton)

    // Input should be reset to empty and both sessions restored
    expect(searchInput).toHaveValue('')
    expect(screen.getByText('Nghiên cứu pin thể rắn cho xe điện')).toBeInTheDocument()
    expect(screen.getByText('Tối ưu chi phí logistics chuỗi cung ứng lạnh')).toBeInTheDocument()
    expect(screen.getByText(/2 sessions/i)).toBeInTheDocument()
  })
})
