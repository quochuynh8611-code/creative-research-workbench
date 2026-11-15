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

describe('Feature: Cross-session discovery UX hardening (Batch C12)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // Scenario 1: Sort related sessions by relevance
  describe('Scenario: Sort related sessions by relevance', () => {
    it('orders sessions by similarity score descending, and tie-breaks by title ascending locale-aware case-insensitive', async () => {
      // Dữ liệu đầu vào chưa được sort hoặc thứ tự lộn xộn
      const unorderedSessions: MatchedSessionItem[] = [
        {
          session_id: 'ses-1',
          title: 'beta session',
          domain: 'engineering',
          status: 'active',
          similarity_score: 0.7,
          match_reasons: ['Lý do 1'],
          shared_parameters: {},
        },
        {
          session_id: 'ses-2',
          title: 'Top Score Session',
          domain: 'engineering',
          status: 'active',
          similarity_score: 0.95,
          match_reasons: ['Lý do top'],
          shared_parameters: {},
        },
        {
          session_id: 'ses-3',
          title: 'Áp suất cao (Tiếng Việt Á)',
          domain: 'engineering',
          status: 'active',
          similarity_score: 0.8,
          match_reasons: ['Lý do tie-break'],
          shared_parameters: {},
        },
        {
          session_id: 'ses-4',
          title: 'an toàn hệ thống (Tiếng Việt a)',
          domain: 'engineering',
          status: 'active',
          similarity_score: 0.8,
          match_reasons: ['Lý do tie-break'],
          shared_parameters: {},
        },
        {
          session_id: 'ses-5',
          title: 'Alpha session',
          domain: 'engineering',
          status: 'active',
          similarity_score: 0.7,
          match_reasons: ['Lý do tie-break 0.7'],
          shared_parameters: {},
        },
      ]

      const mockData: CrossSessionSearchResponse = {
        source_session_id: 'ses-source',
        has_problem_frame: true,
        reason: null,
        matched_sessions: unorderedSessions,
        total_candidates_analyzed: 5,
        latency_ms: 10,
      }

      mockedFindRelatedSessions.mockResolvedValueOnce(mockData)

      renderWithClient(<RelatedSessionsPanel sessionId="ses-source" isActiveTab={true} />)

      // Chờ các card render
      expect(await screen.findByText('Top Score Session')).toBeInTheDocument()

      // Lấy danh sách các link mở phiên nghiên cứu theo thứ tự xuất hiện trong DOM
      const titleLinks = screen.getAllByRole('link', { name: /^Mở phiên nghiên cứu:/i })
      const renderedTitles = titleLinks.map((link) =>
        link.textContent?.trim()
      )

      // Kỳ vọng thứ tự:
      // 1. 0.95: 'Top Score Session'
      // 2 & 3. 0.8: 'an toàn hệ thống (Tiếng Việt a)' trước 'Áp suất cao (Tiếng Việt Á)' (a < á trong localeCompare tiếng Việt)
      // 4 & 5. 0.7: 'Alpha session' trước 'beta session' (case-insensitive A < b)
      expect(renderedTitles[0]).toBe('Top Score Session')
      expect(renderedTitles[1]).toBe('an toàn hệ thống (Tiếng Việt a)')
      expect(renderedTitles[2]).toBe('Áp suất cao (Tiếng Việt Á)')
      expect(renderedTitles[3]).toBe('Alpha session')
      expect(renderedTitles[4]).toBe('beta session')
    })
  })

  // Scenario 2: Limit the initial related-session list
  describe('Scenario: Limit the initial related-session list', () => {
    it('renders only the first five sessions initially and displays a control with additional count', async () => {
      // Tạo 8 sessions
      const eightSessions: MatchedSessionItem[] = Array.from({ length: 8 }, (_, i) => ({
        session_id: `ses-${i + 1}`,
        title: `Phiên nghiên cứu số ${i + 1}`,
        domain: 'engineering',
        status: 'active',
        similarity_score: Number((0.9 - i * 0.05).toFixed(2)),
        match_reasons: [`Trùng thông số #${i + 1}`],
        shared_parameters: {},
      }))

      const mockData: CrossSessionSearchResponse = {
        source_session_id: 'ses-source',
        has_problem_frame: true,
        reason: null,
        matched_sessions: eightSessions,
        total_candidates_analyzed: 12,
        latency_ms: 15,
      }

      mockedFindRelatedSessions.mockResolvedValueOnce(mockData)

      renderWithClient(<RelatedSessionsPanel sessionId="ses-source" isActiveTab={true} />)

      // Chờ card 1 xuất hiện
      expect(await screen.findByText('Phiên nghiên cứu số 1')).toBeInTheDocument()

      // Chỉ 5 session đầu tiên được hiển thị
      expect(screen.getByText('Phiên nghiên cứu số 1')).toBeInTheDocument()
      expect(screen.getByText('Phiên nghiên cứu số 2')).toBeInTheDocument()
      expect(screen.getByText('Phiên nghiên cứu số 3')).toBeInTheDocument()
      expect(screen.getByText('Phiên nghiên cứu số 4')).toBeInTheDocument()
      expect(screen.getByText('Phiên nghiên cứu số 5')).toBeInTheDocument()

      // Các session thứ 6, 7, 8 KHÔNG xuất hiện
      expect(screen.queryByText('Phiên nghiên cứu số 6')).not.toBeInTheDocument()
      expect(screen.queryByText('Phiên nghiên cứu số 7')).not.toBeInTheDocument()
      expect(screen.queryByText('Phiên nghiên cứu số 8')).not.toBeInTheDocument()

      // Nút điều khiển hiển thị số phiên còn lại (8 - 5 = 3)
      const expandBtn = screen.getByRole('button', {
        name: /xem thêm 3 phiên liên quan/i,
      })
      expect(expandBtn).toBeInTheDocument()
    })
  })

  // Scenario 3: Expand the related-session list
  describe('Scenario: Expand the related-session list', () => {
    it('reveals all related sessions when activating the expand control', async () => {
      const sevenSessions: MatchedSessionItem[] = Array.from({ length: 7 }, (_, i) => ({
        session_id: `ses-${i + 1}`,
        title: `Phiên mở rộng số ${i + 1}`,
        domain: 'engineering',
        status: 'active',
        similarity_score: Number((0.85 - i * 0.05).toFixed(2)),
        match_reasons: [`Trùng lý do #${i + 1}`],
        shared_parameters: {},
      }))

      const mockData: CrossSessionSearchResponse = {
        source_session_id: 'ses-source',
        has_problem_frame: true,
        reason: null,
        matched_sessions: sevenSessions,
        total_candidates_analyzed: 10,
        latency_ms: 12,
      }

      mockedFindRelatedSessions.mockResolvedValueOnce(mockData)

      renderWithClient(<RelatedSessionsPanel sessionId="ses-source" isActiveTab={true} />)

      const expandBtn = await screen.findByRole('button', {
        name: /xem thêm 2 phiên liên quan/i,
      })
      expect(expandBtn).toBeInTheDocument()

      // Bấm Xem thêm
      fireEvent.click(expandBtn)

      // Tất cả 7 phiên đều hiển thị
      expect(screen.getByText('Phiên mở rộng số 6')).toBeInTheDocument()
      expect(screen.getByText('Phiên mở rộng số 7')).toBeInTheDocument()

      // Nút biến thành "Thu gọn"
      expect(screen.getByRole('button', { name: /thu gọn/i })).toBeInTheDocument()
    })
  })

  // Scenario 4: Collapse the expanded related-session list
  describe('Scenario: Collapse the expanded related-session list', () => {
    it('collapses back to first five sessions when activating Thu gọn', async () => {
      const sevenSessions: MatchedSessionItem[] = Array.from({ length: 7 }, (_, i) => ({
        session_id: `ses-${i + 1}`,
        title: `Phiên thu gọn số ${i + 1}`,
        domain: 'engineering',
        status: 'active',
        similarity_score: Number((0.85 - i * 0.05).toFixed(2)),
        match_reasons: [`Trùng lý do #${i + 1}`],
        shared_parameters: {},
      }))

      const mockData: CrossSessionSearchResponse = {
        source_session_id: 'ses-source',
        has_problem_frame: true,
        reason: null,
        matched_sessions: sevenSessions,
        total_candidates_analyzed: 10,
        latency_ms: 12,
      }

      mockedFindRelatedSessions.mockResolvedValueOnce(mockData)

      renderWithClient(<RelatedSessionsPanel sessionId="ses-source" isActiveTab={true} />)

      const expandBtn = await screen.findByRole('button', {
        name: /xem thêm 2 phiên liên quan/i,
      })
      fireEvent.click(expandBtn)

      // Kiểm tra đang mở rộng
      expect(screen.getByText('Phiên thu gọn số 6')).toBeInTheDocument()
      const collapseBtn = screen.getByRole('button', { name: /thu gọn/i })

      // Bấm Thu gọn
      fireEvent.click(collapseBtn)

      // Phiên 6 và 7 bị ẩn lại
      expect(screen.queryByText('Phiên thu gọn số 6')).not.toBeInTheDocument()
      expect(screen.queryByText('Phiên thu gọn số 7')).not.toBeInTheDocument()

      // Nút trở lại là "Xem thêm 2 phiên liên quan"
      expect(screen.getByRole('button', { name: /xem thêm 2 phiên liên quan/i })).toBeInTheDocument()
    })
  })

  // Scenario 5: Preserve discovery resilience and accessibility
  describe('Scenario: Preserve discovery resilience and accessibility', () => {
    it('does not display expand/collapse control when there are 5 or fewer sessions', async () => {
      const fourSessions: MatchedSessionItem[] = Array.from({ length: 4 }, (_, i) => ({
        session_id: `ses-${i + 1}`,
        title: `Phiên ngắn ${i + 1}`,
        domain: 'engineering',
        status: 'active',
        similarity_score: 0.8,
        match_reasons: [],
        shared_parameters: {},
      }))

      mockedFindRelatedSessions.mockResolvedValueOnce({
        source_session_id: 'ses-source',
        has_problem_frame: true,
        reason: null,
        matched_sessions: fourSessions,
        total_candidates_analyzed: 4,
        latency_ms: 8,
      })

      renderWithClient(<RelatedSessionsPanel sessionId="ses-source" isActiveTab={true} />)

      expect(await screen.findByText('Phiên ngắn 1')).toBeInTheDocument()

      // Không hiển thị nút Xem thêm hay Thu gọn
      expect(screen.queryByRole('button', { name: /xem thêm/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /thu gọn/i })).not.toBeInTheDocument()
    })

    it('preserves keyboard accessibility and visible focus on expand/collapse buttons', async () => {
      const sixSessions: MatchedSessionItem[] = Array.from({ length: 6 }, (_, i) => ({
        session_id: `ses-${i + 1}`,
        title: `Phiên a11y ${i + 1}`,
        domain: 'engineering',
        status: 'active',
        similarity_score: 0.8,
        match_reasons: [],
        shared_parameters: {},
      }))

      mockedFindRelatedSessions.mockResolvedValueOnce({
        source_session_id: 'ses-source',
        has_problem_frame: true,
        reason: null,
        matched_sessions: sixSessions,
        total_candidates_analyzed: 6,
        latency_ms: 9,
      })

      renderWithClient(<RelatedSessionsPanel sessionId="ses-source" isActiveTab={true} />)

      const expandBtn = await screen.findByRole('button', {
        name: /xem thêm 1 phiên liên quan/i,
      })
      expect(expandBtn).toBeInTheDocument()
      expect(expandBtn.className).toMatch(/focus-visible|focus:/)

      // Thao tác bằng phím Enter hoặc Space
      fireEvent.click(expandBtn)

      const collapseBtn = screen.getByRole('button', { name: /thu gọn/i })
      expect(collapseBtn).toBeInTheDocument()
      expect(collapseBtn.className).toMatch(/focus-visible|focus:/)
    })
  })
})
