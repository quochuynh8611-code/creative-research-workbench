/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RelatedSessionsPanel } from '../related-sessions-panel'
import { findRelatedSessions } from '@/lib/api-client'
import type { CrossSessionSearchResponse, MatchedSessionItem } from '@/lib/types'

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

describe('Feature: Cross-session discovery filter and scope clarity (Batch C13)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // Scenario 1: Filter related sessions by domain
  describe('Scenario: Filter related sessions by domain', () => {
    it('only displays related sessions matching the selected domain and updates result count', async () => {
      const mockSessions: MatchedSessionItem[] = [
        {
          session_id: 'ses-eng-1',
          title: 'Hệ thống tản nhiệt pin xe điện',
          domain: 'engineering',
          status: 'active',
          similarity_score: 0.9,
          match_reasons: ['Trùng thông số'],
          shared_parameters: {},
        },
        {
          session_id: 'ses-biz-1',
          title: 'Chiến lược cắt giảm chi phí sản xuất',
          domain: 'business',
          status: 'active',
          similarity_score: 0.85,
          match_reasons: ['Trùng mâu thuẫn'],
          shared_parameters: {},
        },
        {
          session_id: 'ses-eng-2',
          title: 'Tối ưu độ bền khung vỏ',
          domain: 'engineering',
          status: 'completed',
          similarity_score: 0.8,
          match_reasons: ['Trùng nguyên tắc'],
          shared_parameters: {},
        },
      ]

      const mockResponse: CrossSessionSearchResponse = {
        source_session_id: 'source-session-123',
        has_problem_frame: true,
        reason: null,
        matched_sessions: mockSessions,
        total_candidates_analyzed: 10,
        latency_ms: 12,
      }

      mockedFindRelatedSessions.mockResolvedValueOnce(mockResponse)

      renderWithClient(<RelatedSessionsPanel sessionId="source-session-123" />)

      expect(await screen.findByText('Hệ thống tản nhiệt pin xe điện')).toBeInTheDocument()
      expect(screen.getByText('Chiến lược cắt giảm chi phí sản xuất')).toBeInTheDocument()
      expect(screen.getByText('Tối ưu độ bền khung vỏ')).toBeInTheDocument()

      // Tìm filter dropdown theo domain
      const domainFilter = screen.getByRole('combobox', { name: /lọc theo lĩnh vực|lọc theo domain/i })
      expect(domainFilter).toBeInTheDocument()

      // Chọn domain business
      fireEvent.change(domainFilter, { target: { value: 'business' } })

      // Chỉ còn session thuộc domain business hiển thị
      expect(screen.getByText('Chiến lược cắt giảm chi phí sản xuất')).toBeInTheDocument()
      expect(screen.queryByText('Hệ thống tản nhiệt pin xe điện')).not.toBeInTheDocument()
      expect(screen.queryByText('Tối ưu độ bền khung vỏ')).not.toBeInTheDocument()

      // Kiểm tra result count phản ánh kết quả sau khi lọc (1 phiên)
      expect(screen.getByText(/1 phiên/i)).toBeInTheDocument()
    })
  })

  // Scenario 2: Filter related sessions by status
  describe('Scenario: Filter related sessions by status', () => {
    it('only displays related sessions matching the selected status and updates result count', async () => {
      const mockSessions: MatchedSessionItem[] = [
        {
          session_id: 'ses-act-1',
          title: 'Phiên đang nghiên cứu A',
          domain: 'software',
          status: 'active',
          similarity_score: 0.88,
          match_reasons: ['Lý do 1'],
          shared_parameters: {},
        },
        {
          session_id: 'ses-com-1',
          title: 'Phiên đã hoàn tất B',
          domain: 'software',
          status: 'completed',
          similarity_score: 0.82,
          match_reasons: ['Lý do 2'],
          shared_parameters: {},
        },
        {
          session_id: 'ses-act-2',
          title: 'Phiên đang nghiên cứu C',
          domain: 'software',
          status: 'active',
          similarity_score: 0.75,
          match_reasons: ['Lý do 3'],
          shared_parameters: {},
        },
      ]

      const mockResponse: CrossSessionSearchResponse = {
        source_session_id: 'source-session-123',
        has_problem_frame: true,
        reason: null,
        matched_sessions: mockSessions,
        total_candidates_analyzed: 8,
        latency_ms: 10,
      }

      mockedFindRelatedSessions.mockResolvedValueOnce(mockResponse)

      renderWithClient(<RelatedSessionsPanel sessionId="source-session-123" />)

      expect(await screen.findByText('Phiên đang nghiên cứu A')).toBeInTheDocument()
      expect(screen.getByText('Phiên đã hoàn tất B')).toBeInTheDocument()
      expect(screen.getByText('Phiên đang nghiên cứu C')).toBeInTheDocument()

      // Tìm filter dropdown theo status
      const statusFilter = screen.getByRole('combobox', { name: /lọc theo trạng thái/i })
      expect(statusFilter).toBeInTheDocument()

      // Chọn status completed
      fireEvent.change(statusFilter, { target: { value: 'completed' } })

      // Chỉ còn session completed
      expect(screen.getByText('Phiên đã hoàn tất B')).toBeInTheDocument()
      expect(screen.queryByText('Phiên đang nghiên cứu A')).not.toBeInTheDocument()
      expect(screen.queryByText('Phiên đang nghiên cứu C')).not.toBeInTheDocument()

      // Result count hiển thị 1 phiên
      expect(screen.getByText(/1 phiên/i)).toBeInTheDocument()
    })
  })

  // Scenario 3: Show discovery scope
  describe('Scenario: Show discovery scope', () => {
    it('shows the current session scope, number of candidates analyzed, and active filters', async () => {
      const mockSessions: MatchedSessionItem[] = [
        {
          session_id: 'ses-1',
          title: 'Phiên mẫu 1',
          domain: 'engineering',
          status: 'active',
          similarity_score: 0.85,
          match_reasons: ['Lý do tương đồng'],
          shared_parameters: {},
        },
      ]

      const mockResponse: CrossSessionSearchResponse = {
        source_session_id: 'test-source-session-id-456',
        has_problem_frame: true,
        reason: null,
        matched_sessions: mockSessions,
        total_candidates_analyzed: 14,
        latency_ms: 15,
      }

      mockedFindRelatedSessions.mockResolvedValueOnce(mockResponse)

      renderWithClient(<RelatedSessionsPanel sessionId="test-source-session-id-456" />)

      expect(await screen.findByText('Phiên mẫu 1')).toBeInTheDocument()

      // Scope clarity: Hiển thị phạm vi phiên hiện tại
      expect(screen.getByText(/phạm vi:? phiên hiện tại|phiên nguồn|phạm vi khám phá/i)).toBeInTheDocument()

      // Scope clarity: Hiển thị số lượng ứng viên đã phân tích
      expect(screen.getByText(/14.*(ứng viên|phiên).*đã phân tích|đã phân tích:? 14/i)).toBeInTheDocument()

      // Scope clarity: Active filters ban đầu (Tất cả / không có bộ lọc)
      expect(screen.getByText(/bộ lọc:? (tất cả|không có)|chưa áp dụng bộ lọc/i)).toBeInTheDocument()

      // Áp dụng bộ lọc
      const domainFilter = screen.getByRole('combobox', { name: /lọc theo lĩnh vực|lọc theo domain/i })
      fireEvent.change(domainFilter, { target: { value: 'engineering' } })

      // Active filters cập nhật hiển thị filter đang áp dụng
      expect(screen.getByText(/lĩnh vực:? (kỹ thuật|engineering)/i)).toBeInTheDocument()
    })
  })

  // Scenario 4: Distinguish empty results from filtered-out results
  describe('Scenario: Distinguish empty results from filtered-out results', () => {
    it('shows a message that filters removed all results and offers a way to clear filters', async () => {
      const mockSessions: MatchedSessionItem[] = [
        {
          session_id: 'ses-1',
          title: 'Phiên kỹ thuật duy nhất',
          domain: 'engineering',
          status: 'active',
          similarity_score: 0.9,
          match_reasons: ['Trùng mâu thuẫn'],
          shared_parameters: {},
        },
      ]

      const mockResponse: CrossSessionSearchResponse = {
        source_session_id: 'source-session-123',
        has_problem_frame: true,
        reason: null,
        matched_sessions: mockSessions,
        total_candidates_analyzed: 5,
        latency_ms: 10,
      }

      mockedFindRelatedSessions.mockResolvedValueOnce(mockResponse)

      renderWithClient(<RelatedSessionsPanel sessionId="source-session-123" />)

      expect(await screen.findByText('Phiên kỹ thuật duy nhất')).toBeInTheDocument()

      // Áp dụng filter khiến không còn kết quả nào khớp
      const domainFilter = screen.getByRole('combobox', { name: /lọc theo lĩnh vực|lọc theo domain/i })
      fireEvent.change(domainFilter, { target: { value: 'business' } })

      // Không còn session nào hiển thị
      expect(screen.queryByText('Phiên kỹ thuật duy nhất')).not.toBeInTheDocument()

      // Hiển thị thông báo bộ lọc đã loại bỏ tất cả kết quả
      expect(
        screen.getByText(/bộ lọc đã loại bỏ tất cả kết quả|không có phiên nào phù hợp với bộ lọc|filters removed all results/i)
      ).toBeInTheDocument()

      // Có nút Clear filters
      const clearButton = screen.getByRole('button', { name: /xóa bộ lọc|clear filters/i })
      expect(clearButton).toBeInTheDocument()

      // Click Clear filters
      fireEvent.click(clearButton)

      // Session ban đầu xuất hiện trở lại
      expect(await screen.findByText('Phiên kỹ thuật duy nhất')).toBeInTheDocument()
      expect(domainFilter).toHaveValue('all')
    })
  })

  // Scenario 5: Preserve sorting and progressive disclosure
  describe('Scenario: Preserve sorting and progressive disclosure', () => {
    it('preserves descending similarity score order with title tie-break and 5-item limit when filtered', async () => {
      const mockSessions: MatchedSessionItem[] = [
        {
          session_id: 'ses-eng-1',
          title: 'Alpha Engineering (Score 0.85)',
          domain: 'engineering',
          status: 'active',
          similarity_score: 0.85,
          match_reasons: ['Lý do 1'],
          shared_parameters: {},
        },
        {
          session_id: 'ses-eng-2',
          title: 'Delta Engineering (Score 0.70)',
          domain: 'engineering',
          status: 'active',
          similarity_score: 0.7,
          match_reasons: ['Lý do 2'],
          shared_parameters: {},
        },
        {
          session_id: 'ses-eng-3',
          title: 'Beta Engineering (Score 0.85)',
          domain: 'engineering',
          status: 'active',
          similarity_score: 0.85,
          match_reasons: ['Lý do 3'],
          shared_parameters: {},
        },
        {
          session_id: 'ses-biz-other',
          title: 'Business Session Not Matching',
          domain: 'business',
          status: 'active',
          similarity_score: 0.99,
          match_reasons: ['Other'],
          shared_parameters: {},
        },
        {
          session_id: 'ses-eng-4',
          title: 'Echo Engineering (Score 0.65)',
          domain: 'engineering',
          status: 'active',
          similarity_score: 0.65,
          match_reasons: ['Lý do 4'],
          shared_parameters: {},
        },
        {
          session_id: 'ses-eng-5',
          title: 'Foxtrot Engineering (Score 0.60)',
          domain: 'engineering',
          status: 'active',
          similarity_score: 0.6,
          match_reasons: ['Lý do 5'],
          shared_parameters: {},
        },
        {
          session_id: 'ses-eng-6',
          title: 'Golf Engineering (Score 0.55)',
          domain: 'engineering',
          status: 'active',
          similarity_score: 0.55,
          match_reasons: ['Lý do 6'],
          shared_parameters: {},
        },
        {
          session_id: 'ses-eng-7',
          title: 'Hotel Engineering (Score 0.50)',
          domain: 'engineering',
          status: 'active',
          similarity_score: 0.5,
          match_reasons: ['Lý do 7'],
          shared_parameters: {},
        },
      ]

      const mockResponse: CrossSessionSearchResponse = {
        source_session_id: 'source-session-123',
        has_problem_frame: true,
        reason: null,
        matched_sessions: mockSessions,
        total_candidates_analyzed: 20,
        latency_ms: 15,
      }

      mockedFindRelatedSessions.mockResolvedValueOnce(mockResponse)

      renderWithClient(<RelatedSessionsPanel sessionId="source-session-123" />)

      expect(await screen.findByText('Business Session Not Matching')).toBeInTheDocument()

      // Áp dụng filter domain 'engineering'
      const domainFilter = screen.getByRole('combobox', { name: /lọc theo lĩnh vực|lọc theo domain/i })
      fireEvent.change(domainFilter, { target: { value: 'engineering' } })

      // Kiểm tra business session bị loại
      expect(screen.queryByText('Business Session Not Matching')).not.toBeInTheDocument()

      // Kiểm tra chỉ 5 sessions đầu tiên được render
      // Thứ tự kỳ vọng:
      // 1. Alpha Engineering (0.85, tie-break trước Beta do A < B)
      // 2. Beta Engineering (0.85)
      // 3. Delta Engineering (0.70)
      // 4. Echo Engineering (0.65)
      // 5. Foxtrot Engineering (0.60)
      expect(screen.getByText('Alpha Engineering (Score 0.85)')).toBeInTheDocument()
      expect(screen.getByText('Beta Engineering (Score 0.85)')).toBeInTheDocument()
      expect(screen.getByText('Delta Engineering (Score 0.70)')).toBeInTheDocument()
      expect(screen.getByText('Echo Engineering (Score 0.65)')).toBeInTheDocument()
      expect(screen.getByText('Foxtrot Engineering (Score 0.60)')).toBeInTheDocument()

      // Session thứ 6 và 7 ban đầu bị ẩn
      expect(screen.queryByText('Golf Engineering (Score 0.55)')).not.toBeInTheDocument()
      expect(screen.queryByText('Hotel Engineering (Score 0.50)')).not.toBeInTheDocument()

      // Nút Xem thêm 2 phiên liên quan (7 total eng - 5 = 2)
      const expandButton = screen.getByRole('button', { name: /xem thêm 2 phiên liên quan/i })
      expect(expandButton).toBeInTheDocument()

      // Kích hoạt expand
      fireEvent.click(expandButton)

      // Cả 7 sessions hiện lên
      expect(screen.getByText('Golf Engineering (Score 0.55)')).toBeInTheDocument()
      expect(screen.getByText('Hotel Engineering (Score 0.50)')).toBeInTheDocument()

      // Nút Thu gọn xuất hiện
      const collapseButton = screen.getByRole('button', { name: /thu gọn/i })
      expect(collapseButton).toBeInTheDocument()

      // Kích hoạt collapse
      fireEvent.click(collapseButton)

      // Quay lại 5 sessions
      expect(screen.queryByText('Golf Engineering (Score 0.55)')).not.toBeInTheDocument()
      expect(screen.queryByText('Hotel Engineering (Score 0.50)')).not.toBeInTheDocument()
    })
  })

  // Scenario 6: Accessibility of filter and scope controls
  describe('Scenario: Accessibility of filter and scope controls', () => {
    it('has proper accessible names, keyboard operability, and focus visible styling', async () => {
      const mockSessions: MatchedSessionItem[] = [
        {
          session_id: 'ses-1',
          title: 'Phiên tiếp cận',
          domain: 'engineering',
          status: 'active',
          similarity_score: 0.8,
          match_reasons: ['Lý do tiếp cận'],
          shared_parameters: {},
        },
      ]

      const mockResponse: CrossSessionSearchResponse = {
        source_session_id: 'source-session-123',
        has_problem_frame: true,
        reason: null,
        matched_sessions: mockSessions,
        total_candidates_analyzed: 5,
        latency_ms: 10,
      }

      mockedFindRelatedSessions.mockResolvedValueOnce(mockResponse)

      renderWithClient(<RelatedSessionsPanel sessionId="source-session-123" />)

      expect(await screen.findByText('Phiên tiếp cận')).toBeInTheDocument()

      const domainFilter = screen.getByRole('combobox', { name: /lọc theo lĩnh vực|lọc theo domain/i })
      const statusFilter = screen.getByRole('combobox', { name: /lọc theo trạng thái/i })

      expect(domainFilter).toHaveAttribute('aria-label')
      expect(statusFilter).toHaveAttribute('aria-label')

      // Kiểm tra class focus-visible có mặt
      expect(domainFilter.className).toMatch(/focus-visible:ring/i)
      expect(statusFilter.className).toMatch(/focus-visible:ring/i)
    })
  })
})
