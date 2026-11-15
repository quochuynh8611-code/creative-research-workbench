/** @jest-environment jsdom */
import React from 'react'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RelatedSessionsPanel } from '../related-sessions-panel'
import { findRelatedSessions } from '@/lib/api-client'
import type { CrossSessionSearchResponse } from '@/lib/types'

// Mock api-client
jest.mock('@/lib/api-client', () => ({
  findRelatedSessions: jest.fn(),
}))

const mockedFindRelatedSessions = findRelatedSessions as jest.MockedFunction<typeof findRelatedSessions>

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

function renderWithClient(ui: React.ReactElement, queryClient = createTestQueryClient()) {
  return {
    ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>),
    queryClient,
  }
}

describe('Feature: Cross-session discovery frontend (Batch C11)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // Scenario 1: Display related sessions
  describe('Scenario: Display related sessions', () => {
    it('displays each related session with a clear title and relationship context and can be opened', async () => {
      const mockData: CrossSessionSearchResponse = {
        source_session_id: 'ses-source-001',
        has_problem_frame: true,
        reason: null,
        matched_sessions: [
          {
            session_id: 'ses-related-101',
            title: 'Tối ưu hóa hệ thống làm mát pin xe điện',
            domain: 'engineering',
            status: 'active',
            similarity_score: 0.88,
            match_reasons: [
              'Trùng thông số cải thiện: Speed',
              'Trùng thông số xấu đi: Temperature',
            ],
            shared_parameters: {
              improving_parameter: 'Speed',
              worsening_parameter: 'Temperature',
              contradiction_type: 'technical',
              shared_principles: [1, 35],
            },
            created_at: '2026-10-01T10:00:00Z',
          },
        ],
        total_candidates_analyzed: 10,
        latency_ms: 12.4,
      }

      mockedFindRelatedSessions.mockResolvedValueOnce(mockData)

      renderWithClient(<RelatedSessionsPanel sessionId="ses-source-001" isActiveTab={true} />)

      // Chờ panel tải xong và render card
      const titleLink = await screen.findByRole('link', {
        name: /^Mở phiên nghiên cứu: Tối ưu hóa hệ thống làm mát pin xe điện$/i,
      })
      expect(titleLink).toBeInTheDocument()
      expect(titleLink).toHaveAttribute('href', '/sessions/ses-related-101')

      // Relationship context: Score
      expect(screen.getByText(/88%\s*tương đồng/i)).toBeInTheDocument()

      // Relationship context: Match reasons
      expect(screen.getByText('Trùng thông số cải thiện: Speed')).toBeInTheDocument()
      expect(screen.getByText('Trùng thông số xấu đi: Temperature')).toBeInTheDocument()

      // Relationship context: Shared TRIZ principles
      expect(screen.getByText(/nguyên tắc triz trùng khớp/i)).toBeInTheDocument()
      expect(screen.getByText(/#1/)).toBeInTheDocument()
      expect(screen.getByText(/#35/)).toBeInTheDocument()

      // Card action link to open related session
      const actionLink = screen.getByRole('link', {
        name: /^Xem phiên nghiên cứu: Tối ưu hóa hệ thống làm mát pin xe điện$/i,
      })
      expect(actionLink).toHaveAttribute('href', '/sessions/ses-related-101')
    })
  })

  // Scenario 2: Handle no related sessions
  describe('Scenario: Handle no related sessions', () => {
    it('shows a clear empty-state message and no navigation action is available when matched list is empty', async () => {
      const mockData: CrossSessionSearchResponse = {
        source_session_id: 'ses-source-002',
        has_problem_frame: true,
        reason: null,
        matched_sessions: [],
        total_candidates_analyzed: 15,
        latency_ms: 8.5,
      }

      mockedFindRelatedSessions.mockResolvedValueOnce(mockData)

      renderWithClient(<RelatedSessionsPanel sessionId="ses-source-002" isActiveTab={true} />)

      // Hiển thị empty-state rõ ràng
      expect(
        await screen.findByText(/chưa tìm thấy phiên nghiên cứu nào có mâu thuẫn tương tự/i)
      ).toBeInTheDocument()
      expect(screen.getByText(/15 phiên đã phân tích/i)).toBeInTheDocument()

      // Không có navigation action nào tới session khác
      const sessionLinks = screen.queryAllByRole('link')
      const targetSessionLinks = sessionLinks.filter((link) =>
        link.getAttribute('href')?.startsWith('/sessions/')
      )
      expect(targetSessionLinks).toHaveLength(0)
    })

    it('shows informative guidance when the source session has no problem frame', async () => {
      const mockData: CrossSessionSearchResponse = {
        source_session_id: 'ses-source-003',
        has_problem_frame: false,
        reason: 'no_problem_frame',
        matched_sessions: [],
        total_candidates_analyzed: 0,
        latency_ms: 1.2,
      }

      mockedFindRelatedSessions.mockResolvedValueOnce(mockData)

      renderWithClient(<RelatedSessionsPanel sessionId="ses-source-003" isActiveTab={true} />)

      expect(await screen.findByText(/chưa có cấu trúc bài toán triz/i)).toBeInTheDocument()
      expect(
        screen.getByText(/hãy hoàn tất bước "nhập vấn đề" để hệ thống tự động nhận diện/i)
      ).toBeInTheDocument()

      // Không có link điều hướng session nào
      const sessionLinks = screen.queryAllByRole('link')
      const targetSessionLinks = sessionLinks.filter((link) =>
        link.getAttribute('href')?.startsWith('/sessions/')
      )
      expect(targetSessionLinks).toHaveLength(0)
    })
  })

  // Scenario 3: Handle discovery data failure
  describe('Scenario: Handle discovery data failure', () => {
    it('shows a non-blocking error state when network request fails and allows retry', async () => {
      mockedFindRelatedSessions.mockRejectedValueOnce(new Error('Internal Server Error 500'))

      renderWithClient(<RelatedSessionsPanel sessionId="ses-source-004" isActiveTab={true} />)

      // Hiển thị error alert cục bộ
      expect(
        await screen.findByText(/không thể truy xuất các phiên liên quan/i)
      ).toBeInTheDocument()

      // Nút thử lại khả dụng
      const retryBtn = screen.getByRole('button', { name: /thử lại/i })
      expect(retryBtn).toBeInTheDocument()

      // Khi retry thành công
      mockedFindRelatedSessions.mockResolvedValueOnce({
        source_session_id: 'ses-source-004',
        has_problem_frame: true,
        reason: null,
        matched_sessions: [],
        total_candidates_analyzed: 0,
        latency_ms: 5.0,
      })

      fireEvent.click(retryBtn)

      expect(
        await screen.findByText(/chưa tìm thấy phiên nghiên cứu nào có mâu thuẫn tương tự/i)
      ).toBeInTheDocument()
    })

    it('shows a non-blocking error state safely when discovery data is malformed without crashing', async () => {
      // Dữ liệu malformed: matched_sessions không phải mảng mà là invalid object/null
      const malformedResponse = {
        source_session_id: 'ses-source-005',
        has_problem_frame: true,
        matched_sessions: null,
      } as unknown as CrossSessionSearchResponse

      mockedFindRelatedSessions.mockResolvedValueOnce(malformedResponse)

      renderWithClient(<RelatedSessionsPanel sessionId="ses-source-005" isActiveTab={true} />)

      // Phải hiển thị error state non-blocking hoặc xử lý an toàn mà không crash UI
      expect(
        await screen.findByText(/không thể truy xuất các phiên liên quan|dữ liệu phản hồi không hợp lệ/i)
      ).toBeInTheDocument()
    })
  })

  // Scenario 4: Navigate to a related session
  describe('Scenario: Navigate to a related session', () => {
    it('provides valid link targets to navigate to related sessions preserving session parameters', async () => {
      const mockData: CrossSessionSearchResponse = {
        source_session_id: 'ses-source-006',
        has_problem_frame: true,
        reason: null,
        matched_sessions: [
          {
            session_id: 'ses-target-888',
            title: 'Nghiên cứu vật liệu composite siêu nhẹ',
            domain: 'engineering',
            status: 'completed',
            similarity_score: 0.92,
            match_reasons: ['Trùng thông số cải thiện: Trọng lượng'],
            shared_parameters: {
              improving_parameter: 'Trọng lượng',
            },
            created_at: '2026-09-15T08:00:00Z',
          },
        ],
        total_candidates_analyzed: 8,
        latency_ms: 11.0,
      }

      mockedFindRelatedSessions.mockResolvedValueOnce(mockData)

      renderWithClient(<RelatedSessionsPanel sessionId="ses-source-006" isActiveTab={true} />)

      const titleLink = await screen.findByRole('link', {
        name: /^Mở phiên nghiên cứu: Nghiên cứu vật liệu composite siêu nhẹ$/i,
      })
      expect(titleLink).toHaveAttribute('href', '/sessions/ses-target-888')

      const actionLink = screen.getByRole('link', {
        name: /^Xem phiên nghiên cứu: Nghiên cứu vật liệu composite siêu nhẹ$/i,
      })
      expect(actionLink).toHaveAttribute('href', '/sessions/ses-target-888')
    })
  })

  // Scenario 5: Preserve accessibility
  describe('Scenario: Preserve accessibility', () => {
    it('has accessible landmark region, accessible names and visible focus styling on controls', async () => {
      const mockData: CrossSessionSearchResponse = {
        source_session_id: 'ses-source-007',
        has_problem_frame: true,
        reason: null,
        matched_sessions: [
          {
            session_id: 'ses-a11y-1',
            title: 'Thiết kế van áp suất một chiều tự động',
            domain: 'engineering',
            status: 'active',
            similarity_score: 0.75,
            match_reasons: ['Trùng thông số: Áp suất'],
            shared_parameters: {
              improving_parameter: 'Áp suất',
              shared_principles: [10],
            },
            created_at: '2026-10-02T09:00:00Z',
          },
        ],
        total_candidates_analyzed: 6,
        latency_ms: 9.0,
      }

      mockedFindRelatedSessions.mockResolvedValueOnce(mockData)

      renderWithClient(<RelatedSessionsPanel sessionId="ses-source-007" isActiveTab={true} />)

      // Landmark region
      const panelRegion = await screen.findByRole('region', {
        name: /khám phá phiên nghiên cứu liên quan|phiên nghiên cứu liên quan/i,
      })
      expect(panelRegion).toBeInTheDocument()

      // Chờ card tải xong
      expect(await screen.findByText('Thiết kế van áp suất một chiều tự động')).toBeInTheDocument()

      // Nút Làm mới có accessible name
      const refreshBtn = within(panelRegion).getByRole('button', {
        name: /làm mới/i,
      })
      expect(refreshBtn).toBeInTheDocument()
      expect(refreshBtn.className).toMatch(/focus-visible|focus:/)

      // Links có accessible name và focus indicators
      const links = within(panelRegion).getAllByRole('link')
      expect(links.length).toBeGreaterThanOrEqual(1)
      links.forEach((link) => {
        expect(link.className).toMatch(/focus-visible|hover:/)
      })
    })
  })
})
