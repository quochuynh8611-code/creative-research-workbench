/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  SemanticSearchExplorer,
  calculateResultMetrics,
  type ResultDistributionMetrics,
} from '../semantic-search-explorer'
import {
  searchKnowledge,
  createResearchNote,
  listResearchNotes,
  getSession,
} from '@/lib/api-client'
import type { SearchResultItem } from '@/lib/types'

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

describe('Feature: Result distribution metrics and quick context summary chips (Batch C17)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSearchParams = new URLSearchParams('q=ma+sát')
    mockedListResearchNotes.mockResolvedValue({ data: [], meta: { total: 0 } })
    mockedGetSession.mockResolvedValue({
      id: 'sess-1',
      title: 'Phiên nghiên cứu ma sát',
      domain: 'engineering',
      tags: [],
      status: 'active',
      created_at: '2026-11-15T00:00:00Z',
      updated_at: '2026-11-15T00:00:00Z',
    })
  })

  describe('Pure helper: calculateResultMetrics', () => {
    it('returns zeros for empty results', () => {
      const metrics: ResultDistributionMetrics = calculateResultMetrics([], 'ma sát')
      expect(metrics).toEqual({
        totalCount: 0,
        keywordMatchCount: 0,
        goldenCount: 0,
      })
    })

    it('counts totalCount, keywordMatchCount (excerpt + source_ref), and strict metadata.golden === true', () => {
      const items: SearchResultItem[] = [
        {
          chunk_id: 'c-1',
          source_ref: 'docs/bearing.md',
          excerpt: 'Giảm ma sát trong ổ bi.',
          score: 0.94,
          metadata: { golden: true },
        },
        {
          chunk_id: 'c-2',
          source_ref: 'docs/giam-sát-be-mat.md',
          excerpt: 'Bề mặt tiếp xúc cơ học.',
          score: 0.85,
          metadata: { golden: false },
        },
        {
          chunk_id: 'c-3',
          source_ref: 'docs/general.md',
          excerpt: 'Tối ưu cấu trúc cơ khí chung.',
          score: 0.72,
          // Truthy non-boolean value must NOT be counted as golden === true
          metadata: { golden: 'true' as unknown as boolean },
        },
      ]

      expect(calculateResultMetrics(items, 'ma sát')).toEqual({
        totalCount: 3,
        keywordMatchCount: 2,
        goldenCount: 1,
      })
    })
  })

  describe('Scenario: Show total result count, keyword match count, and golden count', () => {
    it('renders total count, keyword match chip, and golden chip with aria-hidden decorative icons when counts > 0', async () => {
      mockedSearchKnowledge.mockResolvedValueOnce({
        results: [
          {
            chunk_id: 'chk-1',
            source_ref: 'docs/a.md',
            excerpt: 'Giảm ma sát trong ổ bi.',
            score: 0.94,
            metadata: { golden: true, source_type: 'golden_kb' },
          },
          {
            chunk_id: 'chk-2',
            source_ref: 'docs/b.md',
            excerpt: 'Ma sát bề mặt tiếp xúc.',
            score: 0.88,
            metadata: { golden: false, source_type: 'standard_triz' },
          },
          {
            chunk_id: 'chk-3',
            source_ref: 'docs/c.md',
            excerpt: 'Tối ưu cấu trúc cơ khí chung.',
            score: 0.75,
            metadata: { golden: false, source_type: 'case_study' },
          },
        ],
        latency_ms: 4.2,
      })

      renderWithClient(<SemanticSearchExplorer />)
      await screen.findByText(/Giảm ma sát trong ổ bi/i)
      expect(screen.getByText(/kết quả tìm thấy/i).closest('span')?.textContent).toMatch(/3\s*kết quả tìm thấy/i)

      const kwChipText = screen.getByText('2 khớp từ khóa')
      expect(kwChipText).toBeInTheDocument()
      expect(kwChipText.closest('span.inline-flex')?.querySelector('svg')).toHaveAttribute(
        'aria-hidden',
        'true'
      )

      const goldenChipText = screen.getByText('1 chuẩn vàng')
      expect(goldenChipText).toBeInTheDocument()
      expect(goldenChipText.closest('span.inline-flex')?.querySelector('svg')).toHaveAttribute(
        'aria-hidden',
        'true'
      )
    })
  })

  describe('Scenario: Hide keyword match chip and golden chip when counts are zero', () => {
    it('hides both chips when keywordMatchCount === 0 and goldenCount === 0', async () => {
      mockedSearchKnowledge.mockResolvedValueOnce({
        results: [
          {
            chunk_id: 'chk-1',
            source_ref: 'docs/a.md',
            excerpt: 'Cơ cấu cơ khí tổng quát.',
            score: 0.82,
            metadata: { golden: false },
          },
          {
            chunk_id: 'chk-2',
            source_ref: 'docs/b.md',
            excerpt: 'Nguyên lý tách biệt không gian.',
            score: 0.76,
            metadata: {},
          },
        ],
        latency_ms: 3.1,
      })

      renderWithClient(<SemanticSearchExplorer />)
      await screen.findByText(/Cơ cấu cơ khí tổng quát/i)
      expect(screen.getByText(/kết quả tìm thấy/i).closest('span')?.textContent).toMatch(/2\s*kết quả tìm thấy/i)

      expect(screen.queryByText(/^\d+ khớp từ khóa$/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/^\d+ chuẩn vàng$/i)).not.toBeInTheDocument()
    })
  })

  describe('Scenario: Show filtered result context when activeSourceBucket !== "all"', () => {
    it('shows "Hiển thị D / N mục" when a source bucket is selected and hides it when returning to "all"', async () => {
      mockedSearchKnowledge.mockResolvedValueOnce({
        results: [
          {
            chunk_id: 'chk-1',
            source_ref: 'docs/triz-1.md',
            excerpt: 'TRIZ chuẩn.',
            score: 0.95,
            metadata: { source_type: 'standard_triz' },
          },
          {
            chunk_id: 'chk-2',
            source_ref: 'docs/triz-2.md',
            excerpt: 'TRIZ thứ hai.',
            score: 0.9,
            metadata: { source_type: 'standard_triz' },
          },
          {
            chunk_id: 'chk-3',
            source_ref: 'docs/case-1.md',
            excerpt: 'Case study một.',
            score: 0.85,
            metadata: { source_type: 'case_study' },
          },
          {
            chunk_id: 'chk-4',
            source_ref: 'docs/case-2.md',
            excerpt: 'Case study hai.',
            score: 0.8,
            metadata: { source_type: 'case_study' },
          },
        ],
        latency_ms: 5.0,
      })

      renderWithClient(<SemanticSearchExplorer />)
      await screen.findByText(/TRIZ chuẩn\./i)
      expect(screen.getByText(/kết quả tìm thấy/i).closest('span')?.textContent).toMatch(/4\s*kết quả tìm thấy/i)

      expect(screen.queryByText(/Hiển thị .* \/ .* mục/i)).not.toBeInTheDocument()

      // Switch to case_study bucket
      fireEvent.click(screen.getByRole('tab', { name: /Case Study/i }))
      expect(screen.getByText('Hiển thị 2 / 4 mục')).toBeInTheDocument()

      // Switch back to all
      fireEvent.click(screen.getByRole('tab', { name: /Tất cả/i }))
      expect(screen.queryByText(/Hiển thị .* \/ .* mục/i)).not.toBeInTheDocument()
    })
  })

  describe('Scenario: Preserve search state', () => {
    it('does not mutate submittedQuery, selectedTopic, selectedSourceType, goldenOnly, sortBy, expandedChunkIds, or attachedChunkIds', async () => {
      mockSearchParams = new URLSearchParams(
        'q=ma+sát&topic=contradiction&source_type=case_study&golden=true&session_id=sess-1'
      )
      mockedListResearchNotes.mockResolvedValue({
        data: [
          {
            id: 'note-1',
            session_id: 'sess-1',
            source_chunk_id: 'chk-1',
            note_type: 'insight',
            content: 'Đã đính kèm',
            created_at: '2026-11-15T00:00:00Z',
          },
        ],
        meta: { total: 1 },
      })
      mockedCreateResearchNote.mockResolvedValue({
        id: 'note-2',
        session_id: 'sess-1',
        note_type: 'insight',
        content: 'Mới',
        created_at: '2026-11-15T00:00:00Z',
      })

      const longExcerpt = 'B'.repeat(280) + ' ma sát'
      mockedSearchKnowledge.mockResolvedValueOnce({
        results: [
          {
            chunk_id: 'chk-1',
            source_ref: 'docs/case-gold.md',
            excerpt: longExcerpt,
            score: 0.94,
            metadata: { source_type: 'case_study', golden: true, topic: 'contradiction' },
          },
          {
            chunk_id: 'chk-2',
            source_ref: 'docs/triz-gold.md',
            excerpt: 'Ma sát thấp.',
            score: 0.87,
            metadata: { source_type: 'standard_triz', golden: true, topic: 'contradiction' },
          },
        ],
        latency_ms: 4.0,
      })

      renderWithClient(<SemanticSearchExplorer />)
      await screen.findByText(/Ma sát thấp\./i)
      await screen.findByText(/Đã đính kèm/i)

      // Expand snippet & change sortBy & select bucket
      fireEvent.click(screen.getByRole('button', { name: /Xem đầy đủ/i }))
      const sortSelect = screen.getByLabelText('Sắp xếp kết quả') as HTMLSelectElement
      fireEvent.change(sortSelect, { target: { value: 'golden_first' } })
      fireEvent.click(screen.getByRole('tab', { name: /Case Study/i }))

      // Metrics summary chips rendered
      expect(screen.getByText('2 khớp từ khóa')).toBeInTheDocument()
      expect(screen.getByText('2 chuẩn vàng')).toBeInTheDocument()
      expect(screen.getByText('Hiển thị 1 / 2 mục')).toBeInTheDocument()

      // All state remains preserved
      expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('ma sát')
      expect(
        (screen.getByText('Chủ đề (Topic)').parentElement?.querySelector('select') as HTMLSelectElement)
          .value
      ).toBe('contradiction')
      expect(
        (
          screen
            .getByText('Loại nguồn (Source Type)')
            .parentElement?.querySelector('select') as HTMLSelectElement
        ).value
      ).toBe('case_study')
      expect(
        (screen.getByRole('checkbox', { name: /Chỉ tài liệu chuẩn vàng/i }) as HTMLInputElement)
          .checked
      ).toBe(true)
      expect(sortSelect.value).toBe('golden_first')
      expect(screen.getByRole('button', { name: /Thu gọn/i })).toBeInTheDocument()
      expect(screen.getByText(/Đã đính kèm/i)).toBeInTheDocument()
      expect(mockedSearchKnowledge).toHaveBeenCalledTimes(1)
    })
  })
})
