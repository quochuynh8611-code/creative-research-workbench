/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
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

describe('Feature: Search source bucket accessibility and zero-result empty state (Batch C14)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSearchParams = new URLSearchParams('q=triz+sources')
  })

  // Scenario 1: Preserve single-source behavior
  describe('Scenario: Preserve single-source behavior', () => {
    it('does not render source bucket tabs when all results share one source type and all results remain visible', async () => {
      const response: SearchResponse = {
        results: [
          {
            chunk_id: 'chk-1',
            source_ref: 'docs/golden-1.md',
            excerpt: 'Đoạn trích Golden 1.',
            score: 0.95,
            metadata: { source_type: 'golden_kb' },
          },
          {
            chunk_id: 'chk-2',
            source_ref: 'docs/golden-2.md',
            excerpt: 'Đoạn trích Golden 2.',
            score: 0.9,
            metadata: { source_type: 'golden_kb' },
          },
        ],
        latency_ms: 8,
      }

      mockedSearchKnowledge.mockResolvedValueOnce(response)

      renderWithClient(<SemanticSearchExplorer />)

      expect(await screen.findByText('Đoạn trích Golden 1.')).toBeInTheDocument()
      expect(screen.getByText('Đoạn trích Golden 2.')).toBeInTheDocument()

      expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
      expect(screen.queryAllByRole('tab')).toHaveLength(0)
    })
  })

  // Scenario 2: Render accessible source bucket controls
  describe('Scenario: Render accessible source bucket controls', () => {
    it('uses tablist with tab semantics, marks selected bucket with aria-selected, and gives accessible names', async () => {
      const response: SearchResponse = {
        results: [
          {
            chunk_id: 'chk-1',
            source_ref: 'docs/golden-1.md',
            excerpt: 'Đoạn trích Golden 1.',
            score: 0.95,
            metadata: { source_type: 'golden_kb' },
          },
          {
            chunk_id: 'chk-2',
            source_ref: 'docs/case-1.md',
            excerpt: 'Đoạn trích Case Study 1.',
            score: 0.88,
            metadata: { source_type: 'case_study' },
          },
        ],
        latency_ms: 10,
      }

      mockedSearchKnowledge.mockResolvedValueOnce(response)

      renderWithClient(<SemanticSearchExplorer />)

      expect(await screen.findByText('Đoạn trích Golden 1.')).toBeInTheDocument()

      const tablist = screen.getByRole('tablist')
      expect(tablist).toBeInTheDocument()
      expect(tablist).toHaveAttribute('aria-label')

      const allTab = screen.getByRole('tab', { name: /tất cả/i })
      const goldenTab = screen.getByRole('tab', { name: /golden knowledge base/i })
      const caseStudyTab = screen.getByRole('tab', { name: /case study/i })

      expect(allTab).toHaveAttribute('aria-selected', 'true')
      expect(goldenTab).toHaveAttribute('aria-selected', 'false')
      expect(caseStudyTab).toHaveAttribute('aria-selected', 'false')

      // Click chọn Case Study
      fireEvent.click(caseStudyTab)

      expect(allTab).toHaveAttribute('aria-selected', 'false')
      expect(caseStudyTab).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByText('Đoạn trích Case Study 1.')).toBeInTheDocument()
      expect(screen.queryByText('Đoạn trích Golden 1.')).not.toBeInTheDocument()
    })
  })

  // Scenario 3: Navigate source buckets with keyboard
  describe('Scenario: Navigate source buckets with keyboard', () => {
    it('moves focus between tabs using ArrowRight/ArrowLeft/Home/End and activates selection', async () => {
      const response: SearchResponse = {
        results: [
          {
            chunk_id: 'chk-1',
            source_ref: 'docs/golden-1.md',
            excerpt: 'Đoạn trích Golden 1.',
            score: 0.95,
            metadata: { source_type: 'golden_kb' },
          },
          {
            chunk_id: 'chk-2',
            source_ref: 'docs/case-1.md',
            excerpt: 'Đoạn trích Case Study 1.',
            score: 0.88,
            metadata: { source_type: 'case_study' },
          },
        ],
        latency_ms: 10,
      }

      mockedSearchKnowledge.mockResolvedValueOnce(response)

      renderWithClient(<SemanticSearchExplorer />)

      expect(await screen.findByText('Đoạn trích Golden 1.')).toBeInTheDocument()

      const allTab = screen.getByRole('tab', { name: /tất cả/i })
      const goldenTab = screen.getByRole('tab', { name: /golden knowledge base/i })
      const caseStudyTab = screen.getByRole('tab', { name: /case study/i })

      allTab.focus()
      expect(document.activeElement).toBe(allTab)

      // ArrowRight -> Golden Knowledge Base
      fireEvent.keyDown(allTab, { key: 'ArrowRight' })
      expect(document.activeElement).toBe(goldenTab)

      // ArrowRight -> Case Study
      fireEvent.keyDown(goldenTab, { key: 'ArrowRight' })
      expect(document.activeElement).toBe(caseStudyTab)

      // ArrowLeft -> Golden Knowledge Base
      fireEvent.keyDown(caseStudyTab, { key: 'ArrowLeft' })
      expect(document.activeElement).toBe(goldenTab)

      // End -> Case Study
      fireEvent.keyDown(goldenTab, { key: 'End' })
      expect(document.activeElement).toBe(caseStudyTab)

      // Home -> Tất cả
      fireEvent.keyDown(caseStudyTab, { key: 'Home' })
      expect(document.activeElement).toBe(allTab)

      // Di chuyển sang Case Study và kích hoạt
      fireEvent.keyDown(allTab, { key: 'ArrowLeft' }) // wrap về cuối
      expect(document.activeElement).toBe(caseStudyTab)
      fireEvent.click(caseStudyTab)

      expect(caseStudyTab).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByText('Đoạn trích Case Study 1.')).toBeInTheDocument()
      expect(screen.queryByText('Đoạn trích Golden 1.')).not.toBeInTheDocument()
    })
  })

  // Scenario 4: Show visible focus indication
  describe('Scenario: Show visible focus indication', () => {
    it('renders visible focus styling on every source bucket tab', async () => {
      const response: SearchResponse = {
        results: [
          {
            chunk_id: 'chk-1',
            source_ref: 'docs/golden-1.md',
            excerpt: 'Đoạn trích Golden 1.',
            score: 0.95,
            metadata: { source_type: 'golden_kb' },
          },
          {
            chunk_id: 'chk-2',
            source_ref: 'docs/case-1.md',
            excerpt: 'Đoạn trích Case Study 1.',
            score: 0.88,
            metadata: { source_type: 'case_study' },
          },
        ],
        latency_ms: 10,
      }

      mockedSearchKnowledge.mockResolvedValueOnce(response)

      renderWithClient(<SemanticSearchExplorer />)

      expect(await screen.findByText('Đoạn trích Golden 1.')).toBeInTheDocument()

      const tabs = screen.getAllByRole('tab')
      expect(tabs.length).toBeGreaterThanOrEqual(3)

      tabs.forEach((tab) => {
        expect(tab.className).toMatch(/focus-visible:ring/i)
      })
    })
  })

  // Scenario 5: Show zero-result empty state for a selectable bucket
  describe('Scenario: Show zero-result empty state for a selectable bucket', () => {
    it('shows a dedicated empty state when selected bucket has no matching results in loaded items', async () => {
      // Trường hợp facet_counts có 2 loại nguồn (golden_kb và case_study),
      // nhưng danh sách kết quả hiện có chỉ chứa golden_kb (chưa có case_study nào khớp trong page hiện tại)
      const response: SearchResponse = {
        results: [
          {
            chunk_id: 'chk-1',
            source_ref: 'docs/golden-1.md',
            excerpt: 'Đoạn trích Golden 1.',
            score: 0.95,
            metadata: { source_type: 'golden_kb' },
          },
          {
            chunk_id: 'chk-2',
            source_ref: 'docs/golden-2.md',
            excerpt: 'Đoạn trích Golden 2.',
            score: 0.9,
            metadata: { source_type: 'golden_kb' },
          },
        ],
        total_hits: 3,
        facet_counts: {
          source_type: {
            golden_kb: 2,
            case_study: 1,
          },
        },
        latency_ms: 12,
      }

      mockedSearchKnowledge.mockResolvedValueOnce(response)

      renderWithClient(<SemanticSearchExplorer />)

      expect(await screen.findByText('Đoạn trích Golden 1.')).toBeInTheDocument()

      const caseStudyTab = screen.getByRole('tab', { name: /case study/i })
      expect(caseStudyTab).toBeInTheDocument()

      // Click chọn Case Study (hiện không có item nào trong results)
      fireEvent.click(caseStudyTab)

      expect(screen.queryByText('Đoạn trích Golden 1.')).not.toBeInTheDocument()
      expect(
        screen.getByRole('heading', { name: /không có kết quả nào thuộc nguồn case study/i })
      ).toBeInTheDocument()
      expect(
        screen.getByText(/không có kết quả nào khớp với loại nguồn đã chọn/i)
      ).toBeInTheDocument()

      // Nút quay lại Tất cả
      const showAllButton = screen.getByRole('button', { name: /xem tất cả kết quả|quay lại tất cả/i })
      expect(showAllButton).toBeInTheDocument()

      fireEvent.click(showAllButton)
      expect(screen.getByText('Đoạn trích Golden 1.')).toBeInTheDocument()
    })
  })

  // Scenario 6: Preserve result provenance
  describe('Scenario: Preserve result provenance', () => {
    it('retains excerpt and source_ref for each result across source bucket switches', async () => {
      const response: SearchResponse = {
        results: [
          {
            chunk_id: 'chk-1',
            source_ref: 'docs/golden-ref.md',
            excerpt: 'Nội dung trích dẫn Golden.',
            score: 0.95,
            metadata: { source_type: 'golden_kb' },
          },
          {
            chunk_id: 'chk-2',
            source_ref: 'docs/manual-ref.md',
            excerpt: 'Nội dung trích dẫn Manual.',
            score: 0.85,
            metadata: { source_type: 'manual' },
          },
        ],
        latency_ms: 9,
      }

      mockedSearchKnowledge.mockResolvedValueOnce(response)

      renderWithClient(<SemanticSearchExplorer />)

      expect(await screen.findByText('Nội dung trích dẫn Golden.')).toBeInTheDocument()
      expect(screen.getByText('docs/golden-ref.md')).toBeInTheDocument()
      expect(screen.getByText('Nội dung trích dẫn Manual.')).toBeInTheDocument()
      expect(screen.getByText('docs/manual-ref.md')).toBeInTheDocument()

      const manualTab = screen.getByRole('tab', { name: /manual/i })
      fireEvent.click(manualTab)

      expect(screen.getByText('Nội dung trích dẫn Manual.')).toBeInTheDocument()
      expect(screen.getByText('docs/manual-ref.md')).toBeInTheDocument()
      expect(screen.queryByText('docs/golden-ref.md')).not.toBeInTheDocument()
    })
  })
})
