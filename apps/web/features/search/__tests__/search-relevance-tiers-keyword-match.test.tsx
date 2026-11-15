/** @jest-environment jsdom */
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  SemanticSearchExplorer,
  getRelevanceTierInfo,
  checkDirectKeywordMatch,
} from '../semantic-search-explorer'
import { searchKnowledge } from '@/lib/api-client'
import type { SearchResponse } from '@/lib/types'

let mockSearchParams = new URLSearchParams()
const mockReplace = jest.fn()
const mockPush = jest.fn()

jest.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({
    replace: mockReplace,
    push: mockPush,
  }),
}))

jest.mock('@/lib/api-client', () => ({
  searchKnowledge: jest.fn(),
  createResearchNote: jest.fn(),
  listResearchNotes: jest.fn(),
  getSession: jest.fn(),
}))

const mockedSearchKnowledge = searchKnowledge as jest.MockedFunction<typeof searchKnowledge>

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

describe('Feature: Lightweight Relevance Tiers & Keyword Match Indicators (Batch C15)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSearchParams = new URLSearchParams('q=ma+sát')
  })

  describe('Pure helper: getRelevanceTierInfo', () => {
    it('returns high tier with emerald styling for score >= 0.90 (including boundary 0.90)', () => {
      const exactBoundary = getRelevanceTierInfo(0.9)
      expect(exactBoundary.tier).toBe('high')
      expect(exactBoundary.scorePercent).toBe(90)
      expect(exactBoundary.label).toBe('Độ khớp cao (90%)')
      expect(exactBoundary.badgeClass).toContain('emerald')

      const high = getRelevanceTierInfo(0.9412)
      expect(high.tier).toBe('high')
      expect(high.scorePercent).toBe(94)
      expect(high.label).toBe('Độ khớp cao (94%)')
    })

    it('returns good tier with primary styling for 0.75 <= score < 0.90 (including boundary 0.75)', () => {
      const exactBoundary = getRelevanceTierInfo(0.75)
      expect(exactBoundary.tier).toBe('good')
      expect(exactBoundary.scorePercent).toBe(75)
      expect(exactBoundary.label).toBe('Độ khớp tốt (75%)')
      expect(exactBoundary.badgeClass).toContain('primary')

      const good = getRelevanceTierInfo(0.82)
      expect(good.tier).toBe('good')
      expect(good.scorePercent).toBe(82)
      expect(good.label).toBe('Độ khớp tốt (82%)')
    })

    it('returns reference tier with muted styling for score < 0.75', () => {
      const ref = getRelevanceTierInfo(0.71)
      expect(ref.tier).toBe('reference')
      expect(ref.scorePercent).toBe(71)
      expect(ref.label).toBe('Tham khảo (71%)')
      expect(ref.badgeClass).toContain('muted')

      const justBelow = getRelevanceTierInfo(0.74)
      expect(justBelow.tier).toBe('reference')
      expect(justBelow.scorePercent).toBe(74)
      expect(justBelow.label).toBe('Tham khảo (74%)')
    })
  })

  describe('Pure helper: checkDirectKeywordMatch', () => {
    it('matches case-insensitively against excerpt for tokens with length >= 3', () => {
      expect(checkDirectKeywordMatch('NHIỆT ĐỘ', 'Kiểm soát nhiệt độ pin')).toBe(true)
      expect(checkDirectKeywordMatch('ma sát', 'Giảm ma sát bề mặt')).toBe(true)
    })

    it('matches against sourceRef when excerpt does not contain the token', () => {
      expect(
        checkDirectKeywordMatch('friction', 'Giải pháp tối ưu ổ bi.', 'docs/friction-study.md')
      ).toBe(true)
    })

    it('ignores short tokens (< 3 chars) and returns false when no >= 3 char token matches', () => {
      expect(checkDirectKeywordMatch('độ', 'Tăng cường độ cứng')).toBe(false)
      expect(checkDirectKeywordMatch('   ', 'Nội dung bất kỳ')).toBe(false)
      expect(checkDirectKeywordMatch('', 'Nội dung bất kỳ')).toBe(false)
      expect(checkDirectKeywordMatch('ma, ít', 'Bề mặt ít biến dạng')).toBe(false)
    })

    it('matches when a query has both short tokens and >= 3 char tokens', () => {
      expect(checkDirectKeywordMatch('ma sát', 'Tối ưu lực sát bề mặt')).toBe(true)
    })
  })

  describe('Component UI: Relevance Tier & Keyword Match Badges', () => {
    it('renders tier badges on the top row alongside source_ref and preserves excerpt and score', async () => {
      mockSearchParams = new URLSearchParams('q=ma+sát')

      const response: SearchResponse = {
        results: [
          {
            chunk_id: 'chk-high',
            source_ref: 'docs/friction-high.md',
            excerpt: 'Giải pháp giảm ma sát bề mặt trong ổ bi.',
            score: 0.94,
            metadata: { source_type: 'golden_kb' },
          },
          {
            chunk_id: 'chk-good',
            source_ref: 'docs/thermal-good.md',
            excerpt: 'Kiểm soát nhiệt độ ổn định trong buồng đốt.',
            score: 0.82,
            metadata: { source_type: 'standard_triz' },
          },
          {
            chunk_id: 'chk-ref',
            source_ref: 'docs/other-ref.md',
            excerpt: 'Tối ưu cơ cấu cơ học giảm chấn động.',
            score: 0.71,
            metadata: { source_type: 'case_study' },
          },
        ],
        latency_ms: 8.5,
      }
      mockedSearchKnowledge.mockResolvedValueOnce(response)

      renderWithClient(<SemanticSearchExplorer />)

      await screen.findByText(/Giải pháp giảm ma sát bề mặt/i)

      const articles = screen.getAllByRole('article')
      expect(articles).toHaveLength(3)

      // High tier + keyword match
      expect(within(articles[0]).getByText('Độ khớp cao (94%)')).toBeInTheDocument()
      const kwBadge = within(articles[0]).getByText('Khớp từ khóa')
      expect(kwBadge).toBeInTheDocument()
      // Decorative Sparkles icon inside keyword badge should be hidden from screen readers
      const badgeContainer = kwBadge.closest('span.inline-flex')
      expect(badgeContainer?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
      expect(within(articles[0]).getByText('docs/friction-high.md')).toBeInTheDocument()
      expect(within(articles[0]).getByText('Score: 0.9400')).toBeInTheDocument()

      // Good tier + no keyword match
      expect(within(articles[1]).getByText('Độ khớp tốt (82%)')).toBeInTheDocument()
      expect(within(articles[1]).queryByText('Khớp từ khóa')).not.toBeInTheDocument()

      // Reference tier + no keyword match
      expect(within(articles[2]).getByText('Tham khảo (71%)')).toBeInTheDocument()
      expect(within(articles[2]).queryByText('Khớp từ khóa')).not.toBeInTheDocument()
    })

    it('renders Keyword Match badge when query matches source_ref even if excerpt does not contain query', async () => {
      mockSearchParams = new URLSearchParams('q=tribology')

      mockedSearchKnowledge.mockResolvedValueOnce({
        results: [
          {
            chunk_id: 'chk-src-match',
            source_ref: 'docs/tribology-principles.md',
            excerpt: 'Ứng dụng nguyên lý tách biệt không gian trong ổ trục.',
            score: 0.88,
            metadata: { source_type: 'research_paper' },
          },
        ],
        latency_ms: 4.2,
      })

      renderWithClient(<SemanticSearchExplorer />)

      await screen.findByText(/Ứng dụng nguyên lý tách biệt/i)

      expect(screen.getByText('Độ khớp tốt (88%)')).toBeInTheDocument()
      expect(screen.getByText('Khớp từ khóa')).toBeInTheDocument()
    })
  })
})
