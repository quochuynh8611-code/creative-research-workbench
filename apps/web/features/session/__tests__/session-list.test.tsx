/** @jest-environment jsdom */
import React from 'react'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
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
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return {
    ...render(ui, { wrapper: Wrapper }),
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
      domain: 'life',
      tags: ['solar', 'energy'],
    })

    // Form should close after success
    await waitFor(() => {
      expect(screen.queryByLabelText(/tiêu đề/i)).not.toBeInTheDocument()
    })
  })

  it('7b. Form tạo session chỉ hiển thị 4 domain mục tiêu với default là life', async () => {
    renderWithClient(<SessionList />)

    await waitFor(() => {
      expect(screen.getByText('Research Sessions')).toBeInTheDocument()
    })

    // Open form
    fireEvent.click(screen.getByRole('button', { name: /tạo session mới/i }))

    const domainSelect = screen.getByLabelText(/^lĩnh vực$/i) as HTMLSelectElement
    expect(domainSelect).toBeInTheDocument()
    expect(domainSelect.value).toBe('life')

    const options = Array.from(domainSelect.querySelectorAll('option')).map((opt) => ({
      value: opt.value,
      label: opt.textContent?.trim(),
    }))

    expect(options).toEqual([
      { value: 'life', label: 'Đời sống' },
      { value: 'business', label: 'Kinh tế / Kinh doanh' },
      { value: 'culture', label: 'Văn hóa' },
      { value: 'society', label: 'Xã hội' },
    ])
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

  describe('SessionList Domain Filter & Badges', () => {
    it('20. Hiển thị dropdown bộ lọc Lĩnh vực với option "Tất cả lĩnh vực" và 4 domain mục tiêu', async () => {
      renderWithClient(<SessionList />)

      await waitFor(() => {
        expect(screen.getByText('Research Sessions')).toBeInTheDocument()
      })

      const filterSelect = screen.getByLabelText(/lọc theo lĩnh vực/i) as HTMLSelectElement
      expect(filterSelect).toBeInTheDocument()
      expect(filterSelect.value).toBe('all')

      const options = Array.from(filterSelect.querySelectorAll('option')).map((opt) => ({
        value: opt.value,
        label: opt.textContent?.trim(),
      }))

      expect(options).toEqual([
        { value: 'all', label: 'Tất cả lĩnh vực' },
        { value: 'life', label: 'Đời sống' },
        { value: 'business', label: 'Kinh tế / Kinh doanh' },
        { value: 'culture', label: 'Văn hóa' },
        { value: 'society', label: 'Xã hội' },
      ])
    })

    it('21. Chọn "Văn hóa" gọi listSessions với domain="culture", chọn lại "Tất cả lĩnh vực" gọi không có domain', async () => {
      renderWithClient(<SessionList />)

      await waitFor(() => {
        expect(screen.getByText('Research Sessions')).toBeInTheDocument()
      })

      const filterSelect = screen.getByLabelText(/lọc theo lĩnh vực/i)

      // Chọn "Văn hóa"
      fireEvent.change(filterSelect, { target: { value: 'culture' } })

      await waitFor(() => {
        expect(mockedListSessions).toHaveBeenCalledWith({ domain: 'culture' })
      })

      // Chọn lại "Tất cả lĩnh vực"
      fireEvent.change(filterSelect, { target: { value: 'all' } })

      await waitFor(() => {
        expect(mockedListSessions).toHaveBeenLastCalledWith(undefined)
      })
    })

    it('22. Badge session hiển thị đúng nhãn cho domain mới và fallback nguyên văn cho domain chưa định nghĩa', async () => {
      const mockSessionsWithDomains: ResearchSession[] = [
        {
          id: 'ses-culture',
          title: 'Nghiên cứu văn hóa dân gian Nam Bộ',
          description: 'Khảo sát đờn ca tài tử',
          domain: 'culture',
          status: 'active',
          workflow_state: 'idle',
          tags: ['folk'],
          created_at: '2026-03-01T10:00:00Z',
          updated_at: '2026-03-01T12:00:00Z',
        },
        {
          id: 'ses-unknown',
          title: 'Nghiên cứu lĩnh vực tương lai',
          description: 'Lĩnh vực thử nghiệm',
          domain: 'quantum-humanities',
          status: 'active',
          workflow_state: 'idle',
          tags: ['quantum'],
          created_at: '2026-03-02T10:00:00Z',
          updated_at: '2026-03-02T12:00:00Z',
        },
        {
          id: 'ses-research',
          title: 'Nghiên cứu chưa có problem frame',
          description: 'Fallback domain research',
          domain: 'research',
          status: 'active',
          workflow_state: 'idle',
          tags: ['raw'],
          created_at: '2026-03-03T10:00:00Z',
          updated_at: '2026-03-03T12:00:00Z',
        },
      ]

      mockedListSessions.mockResolvedValue({
        data: mockSessionsWithDomains,
        meta: { total: 3 },
      })

      renderWithClient(<SessionList />)

      await waitFor(() => {
        expect(screen.getByText('Nghiên cứu văn hóa dân gian Nam Bộ')).toBeInTheDocument()
      })

      expect(screen.getByText('Văn hóa', { selector: 'span' })).toBeInTheDocument()
      expect(screen.getByText('quantum-humanities', { selector: 'span' })).toBeInTheDocument()
      expect(screen.getByText('Nghiên cứu', { selector: 'span' })).toBeInTheDocument()
    })
  })

  describe('Modal Domain Templates Filter', () => {
    const MOCK_12_DOMAIN_TEMPLATES: SessionTemplate[] = [
      {
        id: 'engineering_composite_arm',
        title: 'Tối ưu hóa Trọng lượng & Độ bền Cơ học',
        domain: 'technical',
        description: 'Mẫu cơ khí TRIZ',
        tags: ['engineering', 'triz'],
        workflow_state: 'structuring',
      },
      {
        id: 'business_delivery_speed_cost',
        title: 'Tối ưu Tốc độ Giao hàng & Chi phí Vận hành',
        domain: 'business',
        description: 'Mẫu logistics',
        tags: ['business', 'logistics'],
        workflow_state: 'structuring',
      },
      {
        id: 'software_latency_security',
        title: 'Tăng cường Bảo mật Đa tầng & Giảm Độ trễ API',
        domain: 'software',
        description: 'Mẫu bảo mật API',
        tags: ['software', 'security'],
        workflow_state: 'structuring',
      },
      {
        id: 'personal_morning_routine_energy',
        title: 'Cân bằng Thói quen Sáng sớm & Năng lượng Làm việc',
        domain: 'personal',
        description: 'Mẫu thói quen',
        tags: ['personal', 'habits'],
        workflow_state: 'structuring',
      },
      {
        id: 'personal_healthy_meal_time_cost',
        title: 'Bữa ăn Gia đình Đủ Dinh dưỡng & Thời gian Tiết kiệm',
        domain: 'personal',
        description: 'Mẫu dinh dưỡng gia đình',
        tags: ['personal', 'family'],
        workflow_state: 'structuring',
      },
      {
        id: 'personal_small_space_organization',
        title: 'Tối ưu Góc Làm việc & Không gian Sống Nhỏ',
        domain: 'personal',
        description: 'Mẫu không gian làm việc',
        tags: ['personal', 'organization'],
        workflow_state: 'structuring',
      },
      {
        id: 'education_child_screen_autonomy',
        title: 'Giúp Trẻ Tự giác Học tập & Giảm Thời gian Màn hình',
        domain: 'education',
        description: 'Mẫu giáo dục tự giác',
        tags: ['education', 'parenting'],
        workflow_state: 'structuring',
      },
      {
        id: 'business_packaging_protection_cost',
        title: 'Đóng gói Sản phẩm Chống sốc, Thẩm mỹ & Tối ưu Chi phí',
        domain: 'business',
        description: 'Mẫu bao bì bảo vệ',
        tags: ['business', 'packaging'],
        workflow_state: 'structuring',
      },
      {
        id: 'research_knowledge_overload',
        title: 'Quản trị Tri thức Cá nhân & Nghiên cứu Chuyên sâu',
        domain: 'research',
        description: 'Mẫu quản trị tri thức',
        tags: ['research', 'pkm'],
        workflow_state: 'structuring',
      },
      {
        id: 'life_daily_habit_energy_management',
        title: 'Cân Bằng Nhịp Sống & Tái Tạo Năng Lượng Mỗi Ngày',
        domain: 'life',
        description: 'Mẫu cân bằng năng lượng',
        tags: ['life', 'wellness'],
        workflow_state: 'structuring',
      },
      {
        id: 'culture_heritage_preservation_tourism',
        title: 'Bảo Tồn Di Sản Văn Hóa & Phát Triển Trải Nghiệm Du Khách',
        domain: 'culture',
        description: 'Mẫu bảo tồn di sản',
        tags: ['culture', 'heritage'],
        workflow_state: 'structuring',
      },
      {
        id: 'society_community_waste_sorting_compliance',
        title: 'Thúc Đẩy Phân Loại Rác Cộng Đồng & Giảm Thời Gian Vận Hành',
        domain: 'society',
        description: 'Mẫu phân loại rác cộng đồng',
        tags: ['society', 'community'],
        workflow_state: 'structuring',
      },
    ]

    it('23. Mở modal template hiển thị dropdown "Lọc mẫu theo lĩnh vực", default "Tất cả lĩnh vực", và 12 templates', async () => {
      mockedListSessions.mockResolvedValue({
        data: MOCK_ACTIVE_SESSIONS,
        meta: { total: 1 },
      })
      mockedGetSessionTemplates.mockResolvedValue(MOCK_12_DOMAIN_TEMPLATES)

      renderWithClient(<SessionList />)

      await waitFor(() => {
        expect(screen.getByText('Session Hoạt Động')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /mẫu nghiên cứu/i }))

      await waitFor(() => {
        expect(screen.getByText('Mẫu Nghiên cứu Định sẵn (Domain Templates)')).toBeInTheDocument()
        expect(screen.getByText('Tối ưu hóa Trọng lượng & Độ bền Cơ học')).toBeInTheDocument()
      })

      const modalFilter = screen.getByLabelText(/lọc mẫu theo lĩnh vực/i) as HTMLSelectElement
      expect(modalFilter).toBeInTheDocument()
      expect(modalFilter.value).toBe('all')

      // Options reflect unique domains: target domains first (life, business, culture, society), then remaining in order of appearance
      const options = Array.from(modalFilter.querySelectorAll('option')).map((opt) => ({
        value: opt.value,
        label: opt.textContent?.trim(),
      }))

      expect(options).toEqual([
        { value: 'all', label: 'Tất cả lĩnh vực' },
        { value: 'life', label: 'Đời sống' },
        { value: 'business', label: 'Kinh tế / Kinh doanh' },
        { value: 'culture', label: 'Văn hóa' },
        { value: 'society', label: 'Xã hội' },
        { value: 'technical', label: 'Kỹ thuật' },
        { value: 'software', label: 'Phần mềm' },
        { value: 'personal', label: 'Cá nhân' },
        { value: 'education', label: 'Giáo dục' },
        { value: 'research', label: 'Nghiên cứu' },
      ])

      // All 12 templates are rendered initially
      expect(screen.getByText('Tối ưu hóa Trọng lượng & Độ bền Cơ học')).toBeInTheDocument()
      expect(screen.getByText('Cân Bằng Nhịp Sống & Tái Tạo Năng Lượng Mỗi Ngày')).toBeInTheDocument()
      expect(screen.getByText('Bảo Tồn Di Sản Văn Hóa & Phát Triển Trải Nghiệm Du Khách')).toBeInTheDocument()
      expect(screen.getByText('Thúc Đẩy Phân Loại Rác Cộng Đồng & Giảm Thời Gian Vận Hành')).toBeInTheDocument()
    })

    it('24. Lọc chính xác theo từng domain mục tiêu: life, business, culture, society giữ nguyên thứ tự', async () => {
      mockedListSessions.mockResolvedValue({
        data: MOCK_ACTIVE_SESSIONS,
        meta: { total: 1 },
      })
      mockedGetSessionTemplates.mockResolvedValue(MOCK_12_DOMAIN_TEMPLATES)

      renderWithClient(<SessionList />)

      await waitFor(() => {
        expect(screen.getByText('Session Hoạt Động')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /mẫu nghiên cứu/i }))

      await waitFor(() => {
        expect(screen.getByText('Mẫu Nghiên cứu Định sẵn (Domain Templates)')).toBeInTheDocument()
        expect(screen.getByText('Tối ưu hóa Trọng lượng & Độ bền Cơ học')).toBeInTheDocument()
      })

      const modalFilter = screen.getByLabelText(/lọc mẫu theo lĩnh vực/i)

      // 1. Lọc 'life'
      fireEvent.change(modalFilter, { target: { value: 'life' } })
      expect(screen.getByText('Cân Bằng Nhịp Sống & Tái Tạo Năng Lượng Mỗi Ngày')).toBeInTheDocument()
      expect(screen.queryByText('Tối ưu hóa Trọng lượng & Độ bền Cơ học')).not.toBeInTheDocument()
      expect(screen.queryByText('Bảo Tồn Di Sản Văn Hóa & Phát Triển Trải Nghiệm Du Khách')).not.toBeInTheDocument()

      // 2. Lọc 'business' -> hiển thị cả 2 templates business theo đúng thứ tự
      fireEvent.change(modalFilter, { target: { value: 'business' } })
      expect(screen.getByText('Tối ưu Tốc độ Giao hàng & Chi phí Vận hành')).toBeInTheDocument()
      expect(screen.getByText('Đóng gói Sản phẩm Chống sốc, Thẩm mỹ & Tối ưu Chi phí')).toBeInTheDocument()
      expect(screen.queryByText('Cân Bằng Nhịp Sống & Tái Tạo Năng Lượng Mỗi Ngày')).not.toBeInTheDocument()

      // 3. Lọc 'culture'
      fireEvent.change(modalFilter, { target: { value: 'culture' } })
      expect(screen.getByText('Bảo Tồn Di Sản Văn Hóa & Phát Triển Trải Nghiệm Du Khách')).toBeInTheDocument()
      expect(screen.queryByText('Tối ưu Tốc độ Giao hàng & Chi phí Vận hành')).not.toBeInTheDocument()

      // 4. Lọc 'society'
      fireEvent.change(modalFilter, { target: { value: 'society' } })
      expect(screen.getByText('Thúc Đẩy Phân Loại Rác Cộng Đồng & Giảm Thời Gian Vận Hành')).toBeInTheDocument()
      expect(screen.queryByText('Bảo Tồn Di Sản Văn Hóa & Phát Triển Trải Nghiệm Du Khách')).not.toBeInTheDocument()
    })

    it('25. Chọn lại "Tất cả lĩnh vực" hiển thị lại đầy đủ 12 template ban đầu', async () => {
      mockedListSessions.mockResolvedValue({
        data: MOCK_ACTIVE_SESSIONS,
        meta: { total: 1 },
      })
      mockedGetSessionTemplates.mockResolvedValue(MOCK_12_DOMAIN_TEMPLATES)

      renderWithClient(<SessionList />)

      await waitFor(() => {
        expect(screen.getByText('Session Hoạt Động')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /mẫu nghiên cứu/i }))

      await waitFor(() => {
        expect(screen.getByText('Mẫu Nghiên cứu Định sẵn (Domain Templates)')).toBeInTheDocument()
        expect(screen.getByText('Tối ưu hóa Trọng lượng & Độ bền Cơ học')).toBeInTheDocument()
      })

      const modalFilter = screen.getByLabelText(/lọc mẫu theo lĩnh vực/i)

      // Lọc life
      fireEvent.change(modalFilter, { target: { value: 'life' } })
      expect(screen.queryByText('Tối ưu hóa Trọng lượng & Độ bền Cơ học')).not.toBeInTheDocument()

      // Reset về 'all'
      fireEvent.change(modalFilter, { target: { value: 'all' } })
      expect(screen.getByText('Tối ưu hóa Trọng lượng & Độ bền Cơ học')).toBeInTheDocument()
      expect(screen.getByText('Cân Bằng Nhịp Sống & Tái Tạo Năng Lượng Mỗi Ngày')).toBeInTheDocument()
      expect(screen.getByText('Thúc Đẩy Phân Loại Rác Cộng Đồng & Giảm Thời Gian Vận Hành')).toBeInTheDocument()
    })

    it('26. Đóng modal và mở lại sẽ tự động reset bộ lọc template về "Tất cả lĩnh vực"', async () => {
      mockedListSessions.mockResolvedValue({
        data: MOCK_ACTIVE_SESSIONS,
        meta: { total: 1 },
      })
      mockedGetSessionTemplates.mockResolvedValue(MOCK_12_DOMAIN_TEMPLATES)

      renderWithClient(<SessionList />)

      await waitFor(() => {
        expect(screen.getByText('Session Hoạt Động')).toBeInTheDocument()
      })

      // Mở modal lần 1
      fireEvent.click(screen.getByRole('button', { name: /mẫu nghiên cứu/i }))
      await waitFor(() => {
        expect(screen.getByText('Mẫu Nghiên cứu Định sẵn (Domain Templates)')).toBeInTheDocument()
        expect(screen.getByText('Tối ưu hóa Trọng lượng & Độ bền Cơ học')).toBeInTheDocument()
      })

      const modalFilter = screen.getByLabelText(/lọc mẫu theo lĩnh vực/i) as HTMLSelectElement
      fireEvent.change(modalFilter, { target: { value: 'culture' } })
      expect(modalFilter.value).toBe('culture')

      // Đóng modal
      const closeBtn = screen.getByRole('button', { name: '' }) // icon close button in modal header
      fireEvent.click(closeBtn)

      await waitFor(() => {
        expect(screen.queryByText('Mẫu Nghiên cứu Định sẵn (Domain Templates)')).not.toBeInTheDocument()
      })

      // Mở lại modal lần 2
      fireEvent.click(screen.getByRole('button', { name: /mẫu nghiên cứu/i }))
      await waitFor(() => {
        expect(screen.getByText('Mẫu Nghiên cứu Định sẵn (Domain Templates)')).toBeInTheDocument()
        expect(screen.getByText('Tối ưu hóa Trọng lượng & Độ bền Cơ học')).toBeInTheDocument()
      })

      const modalFilterReopened = screen.getByLabelText(/lọc mẫu theo lĩnh vực/i) as HTMLSelectElement
      expect(modalFilterReopened.value).toBe('all')
      expect(screen.getByText('Tối ưu hóa Trọng lượng & Độ bền Cơ học')).toBeInTheDocument()
      expect(screen.getByText('Bảo Tồn Di Sản Văn Hóa & Phát Triển Trải Nghiệm Du Khách')).toBeInTheDocument()
    })

    it('27. Bộ lọc template hoàn toàn độc lập với bộ lọc session và không phát sinh API request', async () => {
      mockedListSessions.mockResolvedValue({
        data: MOCK_ACTIVE_SESSIONS,
        meta: { total: 1 },
      })
      mockedGetSessionTemplates.mockResolvedValue(MOCK_12_DOMAIN_TEMPLATES)

      renderWithClient(<SessionList />)

      await waitFor(() => {
        expect(screen.getByText('Research Sessions')).toBeInTheDocument()
      })

      const sessionListFilter = screen.getByLabelText(/^lọc theo lĩnh vực$/i) as HTMLSelectElement
      fireEvent.change(sessionListFilter, { target: { value: 'business' } })

      await waitFor(() => {
        expect(mockedListSessions).toHaveBeenCalledWith({ domain: 'business' })
      })

      const callCountBeforeModal = mockedListSessions.mock.calls.length

      // Khi modal chưa mở, getSessionTemplates chưa được gọi
      expect(mockedGetSessionTemplates).not.toHaveBeenCalled()

      // Mở modal
      fireEvent.click(screen.getByRole('button', { name: /mẫu nghiên cứu/i }))
      await waitFor(() => {
        expect(screen.getByText('Mẫu Nghiên cứu Định sẵn (Domain Templates)')).toBeInTheDocument()
        expect(screen.getByText('Cân Bằng Nhịp Sống & Tái Tạo Năng Lượng Mỗi Ngày')).toBeInTheDocument()
      })

      expect(mockedGetSessionTemplates).toHaveBeenCalledTimes(1)
      const templateCallCount = mockedGetSessionTemplates.mock.calls.length

      // Đổi template filter sang 'life'
      const modalFilter = screen.getByLabelText(/lọc mẫu theo lĩnh vực/i)
      fireEvent.change(modalFilter, { target: { value: 'life' } })

      // Bộ lọc session ngoài trang chính vẫn giữ nguyên 'business'
      expect(sessionListFilter.value).toBe('business')

      // Không phát sinh thêm bất kỳ call nào tới mockedListSessions hay getSessionTemplates, không gọi createSessionFromTemplate
      expect(mockedListSessions.mock.calls.length).toBe(callCountBeforeModal)
      expect(mockedGetSessionTemplates.mock.calls.length).toBe(templateCallCount)
      expect(mockedCreateSessionFromTemplate).not.toHaveBeenCalled()
    })

    it('28. Lọc legacy (personal, software) và unknown domain chính xác, không alias sang life và không gom nhóm Khác', async () => {
      const MOCK_CUSTOM_TEMPLATES: SessionTemplate[] = [
        {
          id: 'personal_tpl_1',
          title: 'Mẫu Thói Quen Cá Nhân',
          domain: 'personal',
          description: 'Mô tả',
          tags: ['personal'],
          workflow_state: 'structuring',
        },
        {
          id: 'software_tpl_1',
          title: 'Mẫu Kiến Trúc Phần Mềm',
          domain: 'software',
          description: 'Mô tả',
          tags: ['software'],
          workflow_state: 'structuring',
        },
        {
          id: 'custom_exp_tpl',
          title: 'Mẫu Lĩnh Vực Thử Nghiệm',
          domain: 'custom_experimental',
          description: 'Mô tả',
          tags: ['custom'],
          workflow_state: 'structuring',
        },
      ]

      mockedListSessions.mockResolvedValue({
        data: MOCK_ACTIVE_SESSIONS,
        meta: { total: 1 },
      })
      mockedGetSessionTemplates.mockResolvedValue(MOCK_CUSTOM_TEMPLATES)

      renderWithClient(<SessionList />)

      await waitFor(() => {
        expect(screen.getByText('Session Hoạt Động')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /mẫu nghiên cứu/i }))
      await waitFor(() => {
        expect(screen.getByText('Mẫu Nghiên cứu Định sẵn (Domain Templates)')).toBeInTheDocument()
        expect(screen.getByText('Mẫu Thói Quen Cá Nhân')).toBeInTheDocument()
      })

      const modalFilter = screen.getByLabelText(/lọc mẫu theo lĩnh vực/i) as HTMLSelectElement
      const options = Array.from(modalFilter.querySelectorAll('option')).map((opt) => ({
        value: opt.value,
        label: opt.textContent?.trim(),
      }))

      // Không có life, business, culture, society vì catalog không có; có personal, software, custom_experimental theo thứ tự xuất hiện lần đầu
      expect(options).toEqual([
        { value: 'all', label: 'Tất cả lĩnh vực' },
        { value: 'personal', label: 'Cá nhân' },
        { value: 'software', label: 'Phần mềm' },
        { value: 'custom_experimental', label: 'custom_experimental' },
      ])

      // Lọc custom_experimental
      fireEvent.change(modalFilter, { target: { value: 'custom_experimental' } })
      expect(screen.getByText('Mẫu Lĩnh Vực Thử Nghiệm')).toBeInTheDocument()
      expect(screen.queryByText('Mẫu Thói Quen Cá Nhân')).not.toBeInTheDocument()
      expect(screen.queryByText('Mẫu Kiến Trúc Phần Mềm')).not.toBeInTheDocument()
    })

    it('29. Khi domain đã chọn không còn kết quả trong catalog, hiển thị thông báo "Không có mẫu nghiên cứu thuộc lĩnh vực đã chọn."', async () => {
      mockedListSessions.mockResolvedValue({
        data: MOCK_ACTIVE_SESSIONS,
        meta: { total: 1 },
      })
      // Catalog chỉ có 1 template technical và 1 template business
      const initialTemplates: SessionTemplate[] = [
        {
          id: 'engineering_composite_arm',
          title: 'Tối ưu hóa Trọng lượng & Độ bền Cơ học',
          domain: 'technical',
          description: 'Mẫu cơ khí TRIZ',
          tags: ['engineering'],
          workflow_state: 'structuring',
        },
      ]
      mockedGetSessionTemplates.mockResolvedValue(initialTemplates)

      const { queryClient } = renderWithClient(<SessionList />)

      await waitFor(() => {
        expect(screen.getByText('Session Hoạt Động')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /mẫu nghiên cứu/i }))
      await waitFor(() => {
        expect(screen.getByText('Mẫu Nghiên cứu Định sẵn (Domain Templates)')).toBeInTheDocument()
        expect(screen.getByText('Tối ưu hóa Trọng lượng & Độ bền Cơ học')).toBeInTheDocument()
      })

      const modalFilter = screen.getByLabelText(/lọc mẫu theo lĩnh vực/i)
      fireEvent.change(modalFilter, { target: { value: 'technical' } })
      expect(screen.getByText('Tối ưu hóa Trọng lượng & Độ bền Cơ học')).toBeInTheDocument()

      // Giả lập catalog cập nhật trong query cache (setQueryData) khiến domain technical không còn template
      act(() => {
        queryClient.setQueryData(['session-templates'], [
          {
            id: 'business_delivery_speed_cost',
            title: 'Tối ưu Tốc độ Giao hàng & Chi phí Vận hành',
            domain: 'business',
            description: 'Mẫu logistics',
            tags: ['business'],
            workflow_state: 'structuring',
          },
        ])
      })

      await waitFor(() => {
        expect(screen.getByText('Không có mẫu nghiên cứu thuộc lĩnh vực đã chọn.')).toBeInTheDocument()
        expect(screen.queryByText('Không tìm thấy mẫu nghiên cứu nào.')).not.toBeInTheDocument()
      })
    })

    it('30. Áp dụng template khi đang trong chế độ lọc gọi đúng template_id và không đổi navigation', async () => {
      mockedListSessions.mockResolvedValue({
        data: MOCK_ACTIVE_SESSIONS,
        meta: { total: 1 },
      })
      mockedGetSessionTemplates.mockResolvedValue(MOCK_12_DOMAIN_TEMPLATES)
      mockedCreateSessionFromTemplate.mockResolvedValue({
        id: 'new-culture-session',
        title: 'Bảo Tồn Di Sản Văn Hóa & Phát Triển Trải Nghiệm Du Khách',
        domain: 'culture',
        status: 'active',
        workflow_state: 'structuring',
        tags: ['culture', 'heritage'],
        created_at: '2026-10-02T12:00:00Z',
        updated_at: '2026-10-02T12:00:00Z',
      })

      renderWithClient(<SessionList />)

      await waitFor(() => {
        expect(screen.getByText('Session Hoạt Động')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /mẫu nghiên cứu/i }))
      await waitFor(() => {
        expect(screen.getByText('Mẫu Nghiên cứu Định sẵn (Domain Templates)')).toBeInTheDocument()
        expect(screen.getByText('Tối ưu hóa Trọng lượng & Độ bền Cơ học')).toBeInTheDocument()
      })

      const modalFilter = screen.getByLabelText(/lọc mẫu theo lĩnh vực/i)
      fireEvent.change(modalFilter, { target: { value: 'culture' } })

      const applyBtn = screen.getByRole('button', { name: /áp dụng mẫu này/i })
      fireEvent.click(applyBtn)

      await waitFor(() => {
        expect(mockedCreateSessionFromTemplate).toHaveBeenCalledWith({
          template_id: 'culture_heritage_preservation_tourism',
        })
        expect(screen.queryByText('Mẫu Nghiên cứu Định sẵn (Domain Templates)')).not.toBeInTheDocument()
      })
    })
  })
})

