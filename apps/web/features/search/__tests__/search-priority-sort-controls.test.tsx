/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  SemanticSearchExplorer,
  sortSearchResults,
  type SearchSortMode,
} from '../semantic-search-explorer'
import {
  searchKnowledge,
  createResearchNote,
  listResearchNotes,
  getSession,
} from '@/lib/api-client'
import type { SearchResponse, SearchResultItem } from '@/lib/types'

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
const mockedCreateResearchNote = createResearchNote as jest.MockedFunction<typeof createResearchNote>
const mockedListResearchNotes = listResearchNotes as jest.MockedFunction<typeof listResearchNotes>
const mockedGetSession = getSession as jest.MockedFunction<typeof getSession>

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

describe('Feature: In-view result ordering and priority sort controls (Batch C16)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSearchParams = new URLSearchParams('q=ma+sát')
    mockedListResearchNotes.mockResolvedValue({ items: [], total: 0 })
    mockedGetSession.mockResolvedValue({
      id: 'sess-1',
      title: 'Phiên nghiên cứu ma sát',
      domain: 'engineering',
      status: 'active',
      created_at: '2026-11-15T00:00:00Z',
      updated_at: '2026-11-15T00:00:00Z',
    })
  })

  describe('Pure helper: sortSearchResults', () => {
    const sampleItems: SearchResultItem[] = [
      {
        chunk_id: 'c-1',
        source_ref: 'docs/a.md',
        excerpt: 'Tài liệu cơ học tổng quát.',
        score: 0.95,
        metadata: { golden: false, source_type: 'standard_triz' },
      },
      {
        chunk_id: 'c-2',
        source_ref: 'docs/b.md',
        excerpt: 'Giải pháp giảm ma sát bề mặt.',
        score: 0.78,
        metadata: { golden: true, source_type: 'golden_kb' },
      },
      {
        chunk_id: 'c-3',
        source_ref: 'docs/c.md',
        excerpt: 'Ứng dụng giảm ma sát ổ bi.',
        score: 0.85,
        metadata: { golden: false, source_type: 'case_study' },
      },
      {
        chunk_id: 'c-4',
        source_ref: 'docs/d.md',
        excerpt: 'Nguyên lý tách biệt.',
        score: 0.91,
        metadata: { golden: true, source_type: 'golden_kb' },
      },
    ]

    it('returns empty array when input is empty', () => {
      expect(sortSearchResults([], 'relevance', 'ma sát')).toEqual([])
    })

    it('preserves backend order for relevance mode without mutating original array', () => {
      const copy = [...sampleItems]
      const sorted = sortSearchResults(copy, 'relevance', 'ma sát')
      expect(sorted.map((i) => i.chunk_id)).toEqual(['c-1', 'c-2', 'c-3', 'c-4'])
      expect(sorted).not.toBe(copy)
    })

    it('prioritizes keyword-matched items and sorts by score descending within each group', () => {
      const sorted = sortSearchResults(sampleItems, 'keyword_first', 'ma sát')
      // Matched: c-3 (0.85), c-2 (0.78); Unmatched: c-1 (0.95), c-4 (0.91)
      expect(sorted.map((i) => i.chunk_id)).toEqual(['c-3', 'c-2', 'c-1', 'c-4'])
    })

    it('prioritizes metadata.golden === true items and sorts by score descending within each group', () => {
      const itemsWithStrictGoldenCheck: SearchResultItem[] = [
        ...sampleItems,
        {
          chunk_id: 'c-5',
          source_ref: 'docs/e.md',
          excerpt: 'Trường hợp golden truthy nhưng không phải boolean true.',
          score: 0.99,
          metadata: { golden: 'yes' as unknown as boolean },
        },
      ]
      const sorted = sortSearchResults(itemsWithStrictGoldenCheck, 'golden_first', 'ma sát')
      // Golden (=== true): c-4 (0.91), c-2 (0.78); Non-golden: c-5 (0.99), c-1 (0.95), c-3 (0.85)
      expect(sorted.map((i) => i.chunk_id)).toEqual(['c-4', 'c-2', 'c-5', 'c-1', 'c-3'])
    })
  })

  describe('Scenario: Preserve relevance ordering by default', () => {
    it('keeps backend relevance order when no sort mode is selected', async () => {
      mockedSearchKnowledge.mockResolvedValueOnce({
        results: [
          {
            chunk_id: 'chk-1',
            source_ref: 'docs/first.md',
            excerpt: 'Kết quả đầu tiên theo RRF.',
            score: 0.95,
            metadata: { source_type: 'standard_triz' },
          },
          {
            chunk_id: 'chk-2',
            source_ref: 'docs/second.md',
            excerpt: 'Kết quả thứ hai theo RRF.',
            score: 0.88,
            metadata: { source_type: 'case_study' },
          },
          {
            chunk_id: 'chk-3',
            source_ref: 'docs/third.md',
            excerpt: 'Kết quả thứ ba theo RRF.',
            score: 0.72,
            metadata: { source_type: 'golden_kb', golden: true },
          },
        ],
        latency_ms: 5.0,
      })

      renderWithClient(<SemanticSearchExplorer />)
      await screen.findByText(/Kết quả đầu tiên theo RRF/i)

      const sortSelect = screen.getByLabelText('Sắp xếp kết quả') as HTMLSelectElement
      expect(sortSelect.value).toBe('relevance')

      const articles = screen.getAllByRole('article')
      expect(articles.map((a) => within(a).getByText(/docs\/.*\.md/).textContent)).toEqual([
        'docs/first.md',
        'docs/second.md',
        'docs/third.md',
      ])
    })
  })

  describe('Scenario: Prioritize keyword matches', () => {
    it('moves keyword-matched results first and orders each group by score descending', async () => {
      mockedSearchKnowledge.mockResolvedValueOnce({
        results: [
          {
            chunk_id: 'chk-no-match',
            source_ref: 'docs/general.md',
            excerpt: 'Tài liệu cơ học tổng quát.',
            score: 0.95,
            metadata: {},
          },
          {
            chunk_id: 'chk-match-low',
            source_ref: 'docs/bearing.md',
            excerpt: 'Giải pháp giảm ma sát ổ bi.',
            score: 0.78,
            metadata: {},
          },
          {
            chunk_id: 'chk-match-high',
            source_ref: 'docs/surface.md',
            excerpt: 'Giảm ma sát bề mặt tiếp xúc.',
            score: 0.86,
            metadata: {},
          },
        ],
        latency_ms: 6.0,
      })

      renderWithClient(<SemanticSearchExplorer />)
      await screen.findByText(/Tài liệu cơ học tổng quát/i)

      fireEvent.change(screen.getByLabelText('Sắp xếp kết quả'), {
        target: { value: 'keyword_first' satisfies SearchSortMode },
      })

      const articles = screen.getAllByRole('article')
      expect(articles.map((a) => within(a).getByText(/docs\/.*\.md/).textContent)).toEqual([
        'docs/surface.md',
        'docs/bearing.md',
        'docs/general.md',
      ])
    })
  })

  describe('Scenario: Prioritize golden sources', () => {
    it('moves golden results first and orders each group by score descending', async () => {
      mockedSearchKnowledge.mockResolvedValueOnce({
        results: [
          {
            chunk_id: 'chk-reg-high',
            source_ref: 'docs/reg-high.md',
            excerpt: 'Tài liệu thường điểm cao.',
            score: 0.96,
            metadata: { golden: false },
          },
          {
            chunk_id: 'chk-gold-low',
            source_ref: 'docs/gold-low.md',
            excerpt: 'Tài liệu chuẩn vàng điểm thấp hơn.',
            score: 0.82,
            metadata: { golden: true },
          },
          {
            chunk_id: 'chk-gold-high',
            source_ref: 'docs/gold-high.md',
            excerpt: 'Tài liệu chuẩn vàng điểm cao hơn.',
            score: 0.9,
            metadata: { golden: true },
          },
        ],
        latency_ms: 4.5,
      })

      renderWithClient(<SemanticSearchExplorer />)
      await screen.findByText(/Tài liệu thường điểm cao/i)

      fireEvent.change(screen.getByLabelText('Sắp xếp kết quả'), {
        target: { value: 'golden_first' satisfies SearchSortMode },
      })

      const articles = screen.getAllByRole('article')
      expect(articles.map((a) => within(a).getByText(/docs\/.*\.md/).textContent)).toEqual([
        'docs/gold-high.md',
        'docs/gold-low.md',
        'docs/reg-high.md',
      ])
    })
  })

  describe('Scenario: Apply sorting after source bucket filtering', () => {
    it('applies selected sort mode only to results in the active source bucket', async () => {
      const response: SearchResponse = {
        results: [
          {
            chunk_id: 'chk-triz-1',
            source_ref: 'docs/triz-1.md',
            excerpt: 'TRIZ chuẩn vàng.',
            score: 0.98,
            metadata: { source_type: 'standard_triz', golden: true },
          },
          {
            chunk_id: 'chk-case-reg',
            source_ref: 'docs/case-reg.md',
            excerpt: 'Case study thường.',
            score: 0.92,
            metadata: { source_type: 'case_study', golden: false },
          },
          {
            chunk_id: 'chk-case-gold',
            source_ref: 'docs/case-gold.md',
            excerpt: 'Case study chuẩn vàng.',
            score: 0.81,
            metadata: { source_type: 'case_study', golden: true },
          },
        ],
        latency_ms: 5.2,
      }
      mockedSearchKnowledge.mockResolvedValueOnce(response)

      renderWithClient(<SemanticSearchExplorer />)
      await screen.findByText(/TRIZ chuẩn vàng/i)

      // Select source bucket first, then sort mode
      const caseTab = screen.getByRole('tab', { name: /Case Study/i })
      fireEvent.click(caseTab)
      fireEvent.change(screen.getByLabelText('Sắp xếp kết quả'), {
        target: { value: 'golden_first' },
      })

      const articles = screen.getAllByRole('article')
      expect(articles).toHaveLength(2)
      expect(articles.map((a) => within(a).getByText(/docs\/.*\.md/).textContent)).toEqual([
        'docs/case-gold.md',
        'docs/case-reg.md',
      ])
    })
  })

  describe('Scenario: Preserve state when changing sort mode & changing source bucket', () => {
    it('preserves submittedQuery, activeSourceBucket, expandedChunkIds, attachedChunkIds on sort change, and preserves sortBy on bucket change', async () => {
      mockSearchParams = new URLSearchParams('q=ma+sát&session_id=sess-1')
      mockedListResearchNotes.mockResolvedValue({
        data: [
          {
            id: 'note-1',
            session_id: 'sess-1',
            source_chunk_id: 'chk-attached',
            note_type: 'evidence',
            content: 'Đã gắn sẵn',
            created_at: '2026-11-15T00:00:00Z',
          },
        ],
      } as any)
      mockedCreateResearchNote.mockResolvedValue({
        id: 'note-2',
        session_id: 'sess-1',
        note_type: 'evidence',
        content: 'Mới gắn',
        context_json: {},
        created_at: '2026-11-15T00:00:00Z',
      })

      const longExcerpt = 'A'.repeat(280) + ' ma sát'
      mockedSearchKnowledge.mockResolvedValueOnce({
        results: [
          {
            chunk_id: 'chk-attached',
            source_ref: 'docs/attached.md',
            excerpt: longExcerpt,
            score: 0.93,
            metadata: { source_type: 'case_study', golden: false },
          },
          {
            chunk_id: 'chk-other-case',
            source_ref: 'docs/other-case.md',
            excerpt: 'Case study chuẩn vàng.',
            score: 0.8,
            metadata: { source_type: 'case_study', golden: true },
          },
          {
            chunk_id: 'chk-triz',
            source_ref: 'docs/triz.md',
            excerpt: 'Nguyên lý TRIZ.',
            score: 0.88,
            metadata: { source_type: 'standard_triz', golden: false },
          },
        ],
        latency_ms: 6.0,
      })

      renderWithClient(<SemanticSearchExplorer />)
      await screen.findByText('docs/attached.md')

      // Select Case Study bucket
      const caseTab = screen.getByRole('tab', { name: /Case Study/i })
      fireEvent.click(caseTab)
      expect(caseTab).toHaveAttribute('aria-selected', 'true')

      // Expand snippet on chk-attached
      const expandBtn = screen.getByRole('button', { name: /Xem đầy đủ/i })
      fireEvent.click(expandBtn)
      expect(screen.getByRole('button', { name: /Thu gọn/i })).toBeInTheDocument()

      // Verify attached badge is present (wait for listResearchNotes hydration)
      await screen.findByText(/Đã đính kèm/i)

      // Change sort mode to golden_first
      const sortSelect = screen.getByLabelText('Sắp xếp kết quả') as HTMLSelectElement
      fireEvent.change(sortSelect, { target: { value: 'golden_first' } })

      // Verify submittedQuery, activeSourceBucket, expandedChunkIds, attachedChunkIds preserved
      const searchInput = screen.getByRole('textbox') as HTMLInputElement
      expect(searchInput.value).toBe('ma sát')
      expect(screen.getByRole('tab', { name: /Case Study/i })).toHaveAttribute(
        'aria-selected',
        'true'
      )
      expect(screen.getByRole('button', { name: /Thu gọn/i })).toBeInTheDocument()
      expect(screen.getByText(/Đã đính kèm/i)).toBeInTheDocument()
      expect(mockedSearchKnowledge).toHaveBeenCalledTimes(1)

      // Change source bucket to Tất cả and verify sortBy remains golden_first
      fireEvent.click(screen.getByRole('tab', { name: /Tất cả/i }))
      expect(sortSelect.value).toBe('golden_first')
    })
  })

  describe('Scenario: Provide accessible sort control', () => {
    it('renders select with aria-label="Sắp xếp kết quả", all 3 options, and aria-hidden decorative icon', async () => {
      mockedSearchKnowledge.mockResolvedValueOnce({
        results: [
          {
            chunk_id: 'chk-1',
            source_ref: 'docs/one.md',
            excerpt: 'Đoạn trích một.',
            score: 0.91,
            metadata: {},
          },
        ],
        latency_ms: 3.0,
      })

      renderWithClient(<SemanticSearchExplorer />)
      await screen.findByText('docs/one.md')

      const sortSelect = screen.getByRole('combobox', { name: 'Sắp xếp kết quả' })
      expect(sortSelect).toBeInTheDocument()

      const options = within(sortSelect).getAllByRole('option') as HTMLOptionElement[]
      expect(options.map((o) => ({ value: o.value, label: o.textContent }))).toEqual([
        { value: 'relevance', label: 'Độ liên quan (RRF)' },
        { value: 'keyword_first', label: 'Ưu tiên khớp từ khóa' },
        { value: 'golden_first', label: 'Ưu tiên chuẩn vàng' },
      ])

      const controlWrapper = sortSelect.parentElement
      expect(controlWrapper?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    })
  })
})
