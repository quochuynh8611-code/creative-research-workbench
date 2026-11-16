/** @jest-environment jsdom */
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SemanticSearchExplorer } from '../semantic-search-explorer'
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

describe('Feature: Backend facets and explorer aggregate counts (Batch C18)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSearchParams = new URLSearchParams('q=mâu+thuẫn')
  })

  describe('Scenario: Use backend total hits in the explorer', () => {
    it('displays backend total_hits in summary bar and shows "Hiển thị D / N mục" when displayedResults.length !== total_hits', async () => {
      const response: SearchResponse = {
        results: [
          {
            chunk_id: 'chk-1',
            source_ref: 'docs/triz-1.md',
            excerpt: 'Đoạn trích 1 về mâu thuẫn.',
            score: 0.95,
            metadata: { source_type: 'golden_kb', golden: true },
          },
          {
            chunk_id: 'chk-2',
            source_ref: 'docs/triz-2.md',
            excerpt: 'Đoạn trích 2 về mâu thuẫn.',
            score: 0.91,
            metadata: { source_type: 'standard_triz', golden: false },
          },
        ],
        latency_ms: 4.5,
        total_hits: 15,
        facet_counts: {
          topic: { contradiction: 15 },
          source_type: { golden_kb: 8, standard_triz: 7 },
          phase: { '1': 15 },
          golden: { true: 8, false: 7 },
        },
      }
      mockedSearchKnowledge.mockResolvedValueOnce(response)

      renderWithClient(<SemanticSearchExplorer />)
      await screen.findByText(/Đoạn trích 1 về mâu thuẫn/i)

      expect(screen.getByText(/kết quả tìm thấy/i).closest('span')?.textContent).toMatch(
        /15\s*kết quả tìm thấy/i
      )
      expect(screen.getByText('Hiển thị 2 / 15 mục')).toBeInTheDocument()
    })
  })

  describe('Scenario: Use backend facet counts in the explorer', () => {
    it('prioritizes backend facet_counts for source bucket tabs and golden count', async () => {
      const response: SearchResponse = {
        results: [
          {
            chunk_id: 'chk-1',
            source_ref: 'docs/golden-1.md',
            excerpt: 'Nội dung chuẩn vàng 1.',
            score: 0.94,
            metadata: { source_type: 'golden_kb', golden: true },
          },
          {
            chunk_id: 'chk-2',
            source_ref: 'docs/case-1.md',
            excerpt: 'Nội dung case study 1.',
            score: 0.87,
            metadata: { source_type: 'case_study', golden: false },
          },
        ],
        latency_ms: 5.1,
        total_hits: 12,
        facet_counts: {
          topic: { contradiction: 12 },
          source_type: { golden_kb: 7, case_study: 5 },
          phase: { '1': 12 },
          golden: { true: 7, false: 5 },
        },
      }
      mockedSearchKnowledge.mockResolvedValueOnce(response)

      renderWithClient(<SemanticSearchExplorer />)
      await screen.findByText(/Nội dung chuẩn vàng 1/i)

      // Golden chip uses backend facet_counts.golden["true"] (7) instead of loaded item count (1)
      expect(screen.getByText('7 chuẩn vàng')).toBeInTheDocument()

      // Source bucket tabs use backend facet_counts.source_type
      const tablist = screen.getByRole('tablist')
      expect(
        within(tablist).getByRole('tab', { name: /Golden Knowledge Base.*7/i })
      ).toBeInTheDocument()
      expect(within(tablist).getByRole('tab', { name: /Case Study.*5/i })).toBeInTheDocument()
    })
  })

  describe('Scenario: Fall back safely without aggregate metadata', () => {
    it('falls back to client-side derivation when total_hits and facet_counts are omitted', async () => {
      const legacyResponse: SearchResponse = {
        results: [
          {
            chunk_id: 'chk-1',
            source_ref: 'docs/legacy-1.md',
            excerpt: 'Kết quả legacy 1.',
            score: 0.92,
            metadata: { source_type: 'golden_kb', golden: true },
          },
          {
            chunk_id: 'chk-2',
            source_ref: 'docs/legacy-2.md',
            excerpt: 'Kết quả legacy 2.',
            score: 0.84,
            metadata: { source_type: 'case_study', golden: false },
          },
          {
            chunk_id: 'chk-3',
            source_ref: 'docs/legacy-3.md',
            excerpt: 'Kết quả legacy 3.',
            score: 0.79,
            metadata: { source_type: 'case_study', golden: false },
          },
        ],
        latency_ms: 3.2,
      }
      mockedSearchKnowledge.mockResolvedValueOnce(legacyResponse)

      renderWithClient(<SemanticSearchExplorer />)
      await screen.findByText(/Kết quả legacy 1/i)

      expect(screen.getByText(/kết quả tìm thấy/i).closest('span')?.textContent).toMatch(
        /3\s*kết quả tìm thấy/i
      )
      expect(screen.getByText('1 chuẩn vàng')).toBeInTheDocument()
      expect(screen.queryByText(/Hiển thị .* \/ .* mục/i)).not.toBeInTheDocument()
    })

    it('falls back safely when total_hits or facet_counts.golden["true"] is null', async () => {
      const nullableResponse = {
        results: [
          {
            chunk_id: 'chk-1',
            source_ref: 'docs/nullable-1.md',
            excerpt: 'Kết quả nullable 1.',
            score: 0.91,
            metadata: { source_type: 'golden_kb', golden: true },
          },
          {
            chunk_id: 'chk-2',
            source_ref: 'docs/nullable-2.md',
            excerpt: 'Kết quả nullable 2.',
            score: 0.83,
            metadata: { source_type: 'case_study', golden: false },
          },
        ],
        latency_ms: 3.8,
        total_hits: null,
        facet_counts: {
          topic: {},
          source_type: {},
          phase: {},
          golden: { true: null },
        },
      } as unknown as SearchResponse
      mockedSearchKnowledge.mockResolvedValueOnce(nullableResponse)

      renderWithClient(<SemanticSearchExplorer />)
      await screen.findByText(/Kết quả nullable 1/i)

      expect(screen.getByText(/kết quả tìm thấy/i).closest('span')?.textContent).toMatch(
        /2\s*kết quả tìm thấy/i
      )
      expect(screen.getByText('1 chuẩn vàng')).toBeInTheDocument()
      expect(screen.queryByText(/Hiển thị .* \/ .* mục/i)).not.toBeInTheDocument()
    })
  })

  describe('Scenario: Preserve search behavior', () => {
    it('retains excerpt and source_ref for each result when aggregate metadata is present', async () => {
      mockedSearchKnowledge.mockResolvedValueOnce({
        results: [
          {
            chunk_id: 'chk-1',
            source_ref: 'docs/preserve-ref.md',
            excerpt: 'Nội dung trích dẫn được bảo toàn nguyên vẹn.',
            score: 0.93,
            metadata: { source_type: 'golden_kb', golden: true },
          },
        ],
        latency_ms: 2.9,
        total_hits: 4,
        facet_counts: {
          topic: { contradiction: 4 },
          source_type: { golden_kb: 4 },
          phase: { '1': 4 },
          golden: { true: 4, false: 0 },
        },
      })

      renderWithClient(<SemanticSearchExplorer />)
      await screen.findByText('Nội dung trích dẫn được bảo toàn nguyên vẹn.')
      expect(screen.getByText('docs/preserve-ref.md')).toBeInTheDocument()
    })
  })
})
