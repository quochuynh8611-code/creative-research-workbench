/** @jest-environment jsdom */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionList } from '../session-list'
import { listSessions } from '@/lib/api-client'
import type { ResearchSession, SessionListResponse } from '@/lib/types'

// Mock api-client to avoid actual network calls
jest.mock('@/lib/api-client', () => ({
  listSessions: jest.fn(),
}))

const mockedListSessions = listSessions as jest.MockedFunction<typeof listSessions>

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

function renderWithClient(ui: React.ReactElement) {
  const queryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  )
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
