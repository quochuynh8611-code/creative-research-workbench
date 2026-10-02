/** @jest-environment jsdom */
import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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

describe('RelatedSessionsPanel Component Tests (Phase 10.2 Increment 2)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // Scenario 1: Render matched sessions list
  it('Scenario 1: Render danh sách matched sessions kèm score, domain, reasons và link', async () => {
    const mockData: CrossSessionSearchResponse = {
      source_session_id: 'ses-123',
      has_problem_frame: true,
      reason: null,
      matched_sessions: [
        {
          session_id: 'ses-match-1',
          title: 'Tối ưu hóa tản nhiệt động cơ điện',
          domain: 'engineering',
          status: 'active',
          similarity_score: 0.85,
          match_reasons: [
            'Trùng thông số cải thiện: Speed',
            'Trùng thông số xấu đi: Temperature',
            'Trùng 2 nguyên tắc TRIZ đề xuất (#1, #35)',
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
      total_candidates_analyzed: 8,
      latency_ms: 15.2,
    }

    mockedFindRelatedSessions.mockResolvedValueOnce(mockData)

    renderWithClient(<RelatedSessionsPanel sessionId="ses-123" isActiveTab={true} />)

    await waitFor(() => {
      expect(screen.getByText('Tối ưu hóa tản nhiệt động cơ điện')).toBeInTheDocument()
    })

    expect(screen.getByText(/85%/)).toBeInTheDocument()
    expect(screen.getByText('Trùng thông số cải thiện: Speed')).toBeInTheDocument()
    expect(screen.getByText('Trùng thông số xấu đi: Temperature')).toBeInTheDocument()
    expect(screen.getByText(/Trùng 2 nguyên tắc TRIZ/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Xem phiên nghiên cứu/i })).toHaveAttribute(
      'href',
      '/sessions/ses-match-1'
    )
  })

  // Scenario 2: Source session has no problem frame
  it('Scenario 2: Hiển thị hướng dẫn khi source session chưa có problem frame', async () => {
    const mockData: CrossSessionSearchResponse = {
      source_session_id: 'ses-123',
      has_problem_frame: false,
      reason: 'no_problem_frame',
      matched_sessions: [],
      total_candidates_analyzed: 0,
      latency_ms: 2.5,
    }

    mockedFindRelatedSessions.mockResolvedValueOnce(mockData)

    renderWithClient(<RelatedSessionsPanel sessionId="ses-123" isActiveTab={true} />)

    await waitFor(() => {
      expect(screen.getByText(/Chưa có cấu trúc bài toán TRIZ/i)).toBeInTheDocument()
    })

    expect(
      screen.getByText(/Hãy hoàn tất bước "Nhập vấn đề" để hệ thống tự động nhận diện/i)
    ).toBeInTheDocument()
  })

  // Scenario 3: No matching sessions found
  it('Scenario 3: Hiển thị empty state khi không tìm thấy phiên tương đồng', async () => {
    const mockData: CrossSessionSearchResponse = {
      source_session_id: 'ses-123',
      has_problem_frame: true,
      reason: null,
      matched_sessions: [],
      total_candidates_analyzed: 12,
      latency_ms: 10.1,
    }

    mockedFindRelatedSessions.mockResolvedValueOnce(mockData)

    renderWithClient(<RelatedSessionsPanel sessionId="ses-123" isActiveTab={true} />)

    await waitFor(() => {
      expect(
        screen.getByText(/Chưa tìm thấy phiên nghiên cứu nào có mâu thuẫn tương tự/i)
      ).toBeInTheDocument()
    })
  })

  // Scenario 4: Error handling and retry
  it('Scenario 4: Hiển thị error alert cục bộ và cho phép Retry', async () => {
    mockedFindRelatedSessions.mockRejectedValueOnce(new Error('Network error 500'))

    renderWithClient(<RelatedSessionsPanel sessionId="ses-123" isActiveTab={true} />)

    await waitFor(() => {
      expect(screen.getByText(/Không thể truy xuất các phiên liên quan/i)).toBeInTheDocument()
    })

    const retryBtn = screen.getByRole('button', { name: /Thử lại/i })
    expect(retryBtn).toBeInTheDocument()

    // Mock success for retry
    const mockData: CrossSessionSearchResponse = {
      source_session_id: 'ses-123',
      has_problem_frame: true,
      reason: null,
      matched_sessions: [],
      total_candidates_analyzed: 5,
      latency_ms: 8.0,
    }
    mockedFindRelatedSessions.mockResolvedValueOnce(mockData)

    fireEvent.click(retryBtn)

    await waitFor(() => {
      expect(
        screen.getByText(/Chưa tìm thấy phiên nghiên cứu nào có mâu thuẫn tương tự/i)
      ).toBeInTheDocument()
    })
  })

  // Scenario 5: Conditional query activation when isActiveTab is false
  it('Scenario 5: Không trigger API call khi isActiveTab là false', () => {
    renderWithClient(<RelatedSessionsPanel sessionId="ses-123" isActiveTab={false} />)

    expect(mockedFindRelatedSessions).not.toHaveBeenCalled()
  })
})
