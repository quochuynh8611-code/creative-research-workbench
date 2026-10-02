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
} from '@/lib/api-client'
import type { ResearchSession, SessionListResponse, SessionTemplate } from '@/lib/types'

// Mock api-client to avoid actual network calls
jest.mock('@/lib/api-client', () => ({
  listSessions: jest.fn(),
  createSession: jest.fn(),
  archiveSession: jest.fn(),
  restoreSession: jest.fn(),
  importSession: jest.fn(),
  getSessionTemplates: jest.fn(),
  createSessionFromTemplate: jest.fn(),
}))

const mockedListSessions = listSessions as jest.MockedFunction<typeof listSessions>
const mockedCreateSession = createSession as jest.MockedFunction<typeof createSession>
const mockedArchiveSession = archiveSession as jest.MockedFunction<typeof archiveSession>
const mockedRestoreSession = restoreSession as jest.MockedFunction<typeof restoreSession>
const mockedImportSession = importSession as jest.MockedFunction<typeof importSession>
const mockedGetSessionTemplates = getSessionTemplates as jest.MockedFunction<typeof getSessionTemplates>
const mockedCreateSessionFromTemplate = createSessionFromTemplate as jest.MockedFunction<typeof createSessionFromTemplate>


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

describe('SessionList Lifecycle & Safe Deletion (Phase 5.9)', () => {
  const MOCK_ACTIVE_SESSIONS: ResearchSession[] = [
    {
      id: 'session-active-1',
      title: 'Session Hoạt Động',
      description: 'Đang nghiên cứu TRIZ',
      domain: 'technical',
      status: 'active',
      workflow_state: 'structuring',
      tags: ['triz'],
      created_at: '2026-03-01T10:00:00Z',
      updated_at: '2026-03-01T12:00:00Z',
      problem_frame: null,
    },
  ]

  const MOCK_ARCHIVED_SESSIONS: ResearchSession[] = [
    {
      id: 'session-archived-1',
      title: 'Session Đã Lưu Trữ',
      description: 'Nghiên cứu cũ đã xong',
      domain: 'business',
      status: 'archived',
      workflow_state: 'idle',
      tags: ['archived'],
      created_at: '2026-02-01T10:00:00Z',
      updated_at: '2026-02-15T12:00:00Z',
      problem_frame: null,
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    mockedListSessions.mockImplementation((params) => {
      if (params?.status === 'archived') {
        return Promise.resolve({
          data: MOCK_ARCHIVED_SESSIONS,
          meta: { total: 1 },
        })
      }
      return Promise.resolve({
        data: MOCK_ACTIVE_SESSIONS,
        meta: { total: 1 },
      })
    })
  })

  it('13. Chuyển đổi qua lại giữa tab Đang hoạt động và Đã lưu trữ', async () => {
    renderWithClient(<SessionList />)

    await waitFor(() => {
      expect(screen.getByText('Session Hoạt Động')).toBeInTheDocument()
    })

    // Click tab "Đã lưu trữ"
    const archivedTab = screen.getByRole('button', { name: /đã lưu trữ/i })
    fireEvent.click(archivedTab)

    await waitFor(() => {
      expect(mockedListSessions).toHaveBeenCalledWith({ status: 'archived' })
      expect(screen.getByText('Session Đã Lưu Trữ')).toBeInTheDocument()
    })
    expect(screen.queryByText('Session Hoạt Động')).not.toBeInTheDocument()

    // Click lại tab "Đang hoạt động"
    const activeTab = screen.getByRole('button', { name: /đang hoạt động/i })
    fireEvent.click(activeTab)

    await waitFor(() => {
      expect(screen.getByText('Session Hoạt Động')).toBeInTheDocument()
    })
    expect(screen.queryByText('Session Đã Lưu Trữ')).not.toBeInTheDocument()
  })

  it('14. Mở modal xác nhận và gọi archiveSession khi người dùng xác nhận lưu trữ', async () => {
    mockedArchiveSession.mockResolvedValue({
      ...MOCK_ACTIVE_SESSIONS[0],
      status: 'archived',
    })

    renderWithClient(<SessionList />)

    await waitFor(() => {
      expect(screen.getByText('Session Hoạt Động')).toBeInTheDocument()
    })

    // Click nút "Lưu trữ" trên card bằng accessible name chính xác
    const archiveBtn = screen.getByRole('button', { name: /lưu trữ session/i })
    fireEvent.click(archiveBtn)

    // Modal xác nhận xuất hiện
    expect(screen.getByText(/bạn có chắc chắn muốn chuyển session/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /xác nhận lưu trữ/i })).toBeInTheDocument()

    // Click "Xác nhận lưu trữ"
    const confirmBtn = screen.getByRole('button', { name: /xác nhận lưu trữ/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(mockedArchiveSession).toHaveBeenCalledWith('session-active-1')
    })
  })

  it('15. Gọi restoreSession khi người dùng bấm Khôi phục ở tab Đã lưu trữ', async () => {
    mockedRestoreSession.mockResolvedValue({
      ...MOCK_ARCHIVED_SESSIONS[0],
      status: 'active',
    })

    renderWithClient(<SessionList />)

    // Sang tab Đã lưu trữ
    const archivedTab = screen.getByRole('button', { name: /đã lưu trữ/i })
    fireEvent.click(archivedTab)

    await waitFor(() => {
      expect(screen.getByText('Session Đã Lưu Trữ')).toBeInTheDocument()
    })

    // Click "Khôi phục"
    const restoreBtn = screen.getByRole('button', { name: /khôi phục/i })
    fireEvent.click(restoreBtn)

    await waitFor(() => {
      expect(mockedRestoreSession).toHaveBeenCalledWith('session-archived-1')
    })
  })

  it('16. Mở modal xác nhận và bấm Hủy bỏ thì modal đóng lại mà không gọi archiveSession', async () => {
    renderWithClient(<SessionList />)

    await waitFor(() => {
      expect(screen.getByText('Session Hoạt Động')).toBeInTheDocument()
    })

    // Mở modal
    const archiveBtn = screen.getByRole('button', { name: /lưu trữ session/i })
    fireEvent.click(archiveBtn)

    expect(screen.getByText(/bạn có chắc chắn muốn chuyển session/i)).toBeInTheDocument()

    // Bấm nút "Hủy bỏ"
    const cancelBtn = screen.getByRole('button', { name: /hủy bỏ/i })
    fireEvent.click(cancelBtn)

    // Modal đóng lại và không gọi API
    expect(screen.queryByText(/bạn có chắc chắn muốn chuyển session/i)).not.toBeInTheDocument()
    expect(mockedArchiveSession).not.toHaveBeenCalled()
  })

  it('17. Hiển thị Empty state phù hợp cho tab Đã lưu trữ khi không có dữ liệu', async () => {
    mockedListSessions.mockImplementation((params) => {
      if (params?.status === 'archived') {
        return Promise.resolve({
          data: [],
          meta: { total: 0 },
        })
      }
      return Promise.resolve({
        data: MOCK_ACTIVE_SESSIONS,
        meta: { total: 1 },
      })
    })

    renderWithClient(<SessionList />)

    await waitFor(() => {
      expect(screen.getByText('Session Hoạt Động')).toBeInTheDocument()
    })

    // Sang tab Đã lưu trữ
    const archivedTab = screen.getByRole('button', { name: /đã lưu trữ/i })
    fireEvent.click(archivedTab)

    await waitFor(() => {
      expect(screen.getByText(/không có session nào được lưu trữ/i)).toBeInTheDocument()
      expect(screen.getByText(/các session được lưu trữ an toàn sẽ xuất hiện tại đây/i)).toBeInTheDocument()
    })
  })

  it('18. Mở modal Mẫu nghiên cứu và hiển thị danh sách domain templates', async () => {
    mockedListSessions.mockResolvedValue({
      data: MOCK_ACTIVE_SESSIONS,
      meta: { total: 1 },
    })
    mockedGetSessionTemplates.mockResolvedValue([
      {
        id: 'engineering_composite_arm',
        title: 'Tối ưu hóa Trọng lượng & Độ bền Cơ học',
        domain: 'technical',
        description: 'Mẫu cơ khí TRIZ',
        tags: ['engineering', 'triz'],
        workflow_state: 'structuring',
      },
    ])

    renderWithClient(<SessionList />)

    await waitFor(() => {
      expect(screen.getByText('Session Hoạt Động')).toBeInTheDocument()
    })

    const templatesBtn = screen.getByRole('button', { name: /mẫu nghiên cứu/i })
    fireEvent.click(templatesBtn)

    await waitFor(() => {
      expect(screen.getByText('Mẫu Nghiên cứu Định sẵn (Domain Templates)')).toBeInTheDocument()
      expect(screen.getByText('Tối ưu hóa Trọng lượng & Độ bền Cơ học')).toBeInTheDocument()
      expect(screen.getByText('Mẫu cơ khí TRIZ')).toBeInTheDocument()
    })
  })

  it('19. Bấm Áp dụng mẫu này gọi createSessionFromTemplate và đóng modal', async () => {
    mockedListSessions.mockResolvedValue({
      data: MOCK_ACTIVE_SESSIONS,
      meta: { total: 1 },
    })
    mockedGetSessionTemplates.mockResolvedValue([
      {
        id: 'engineering_composite_arm',
        title: 'Tối ưu hóa Trọng lượng & Độ bền Cơ học',
        domain: 'technical',
        description: 'Mẫu cơ khí TRIZ',
        tags: ['engineering'],
        workflow_state: 'structuring',
      },
    ])
    mockedCreateSessionFromTemplate.mockResolvedValue({
      id: 'new-tpl-ses-1',
      title: 'Tối ưu hóa Trọng lượng & Độ bền Cơ học',
      domain: 'technical',
      status: 'active',
      workflow_state: 'structuring',
      tags: ['engineering'],
      created_at: '2026-10-02T12:00:00Z',
      updated_at: '2026-10-02T12:00:00Z',
    })

    renderWithClient(<SessionList />)

    await waitFor(() => {
      expect(screen.getByText('Session Hoạt Động')).toBeInTheDocument()
    })

    // Mở modal
    fireEvent.click(screen.getByRole('button', { name: /mẫu nghiên cứu/i }))

    await waitFor(() => {
      expect(screen.getByText('Tối ưu hóa Trọng lượng & Độ bền Cơ học')).toBeInTheDocument()
    })

    // Bấm nút "Áp dụng mẫu này"
    const applyBtn = screen.getByRole('button', { name: /áp dụng mẫu này/i })
    fireEvent.click(applyBtn)

    await waitFor(() => {
      expect(mockedCreateSessionFromTemplate).toHaveBeenCalledWith({
        template_id: 'engineering_composite_arm',
      })
      expect(screen.queryByText('Mẫu Nghiên cứu Định sẵn (Domain Templates)')).not.toBeInTheDocument()
    })
  })
})

