/** @jest-environment jsdom */
import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SemanticSearchExplorer } from '../semantic-search-explorer'
import { searchKnowledge, createResearchNote, listResearchNotes, getSession } from '@/lib/api-client'
import type { SearchResponse, ResearchNote, ResearchNotesResponse, ResearchSession } from '@/lib/types'

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

// Mock api-client
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

describe('SemanticSearchExplorer Component Tests (Phase 10.3 Increment 1 - 6)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedListResearchNotes.mockResolvedValue({ data: [], meta: { total: 0 } })
    mockedGetSession.mockResolvedValue({
      id: 'default-session',
      title: 'Bài toán kỹ thuật mẫu',
      domain: 'technical',
      status: 'active',
      tags: [],
    } as any)
  })

  it('Scenario 1: Hiển thị initial blank state với banner và các gợi ý từ khóa', () => {
    renderWithClient(<SemanticSearchExplorer />)

    expect(screen.getByText(/Semantic Knowledge Base Explorer/i)).toBeInTheDocument()
    expect(screen.getByText(/Gợi ý truy vấn phổ biến/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /mâu thuẫn kỹ thuật/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /40 nguyên tắc sáng chế/i })).toBeInTheDocument()
  })

  it('Scenario 2: Click vào từ khóa gợi ý tự động điền và kích hoạt tìm kiếm', async () => {
    const mockResponse: SearchResponse = {
      results: [
        {
          chunk_id: 'chk-001',
          source_ref: 'docs/triz_principles.md',
          excerpt: 'Nguyên tắc 1: Phân nhỏ đối tượng thành các phần độc lập.',
          score: 0.92,
          metadata: {
            topic: 'contradiction',
            golden: true,
            source_type: 'golden_kb',
            phase: '1',
          },
        },
      ],
      latency_ms: 14.5,
    }

    mockedSearchKnowledge.mockResolvedValueOnce(mockResponse)

    renderWithClient(<SemanticSearchExplorer />)

    const suggestionBtn = screen.getByRole('button', { name: /40 nguyên tắc sáng chế/i })
    fireEvent.click(suggestionBtn)

    await waitFor(() => {
      expect(mockedSearchKnowledge).toHaveBeenCalledWith(
        expect.objectContaining({
          query: '40 nguyên tắc sáng chế',
          top_k: 10,
        })
      )
    })

    expect(await screen.findByText('Nguyên tắc 1: Phân nhỏ đối tượng thành các phần độc lập.')).toBeInTheDocument()
    expect(screen.getByText(/docs\/triz_principles\.md/)).toBeInTheDocument()
    expect(screen.getAllByText(/Golden/i).length).toBeGreaterThan(0)
  })

  it('Scenario 3: Nhập từ khóa tự do và submit form thực hiện tìm kiếm', async () => {
    const mockResponse: SearchResponse = {
      results: [
        {
          chunk_id: 'chk-002',
          source_ref: 'docs/case_study_robotics.md',
          excerpt: 'Giải pháp giảm trọng lượng cánh tay composite.',
          score: 0.88,
          metadata: {
            topic: 'engineering',
            golden: false,
            source_type: 'case_study',
          },
        },
      ],
      latency_ms: 22.0,
    }

    mockedSearchKnowledge.mockResolvedValueOnce(mockResponse)

    renderWithClient(<SemanticSearchExplorer />)

    const input = screen.getByPlaceholderText(/Nhập câu hỏi hoặc từ khóa nghiên cứu/i)
    fireEvent.change(input, { target: { value: 'cánh tay robot' } })

    const searchBtn = screen.getByRole('button', { name: /^Tìm kiếm$/i })
    fireEvent.click(searchBtn)

    await waitFor(() => {
      expect(mockedSearchKnowledge).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'cánh tay robot',
        })
      )
    })

    expect(await screen.findByText('Giải pháp giảm trọng lượng cánh tay composite.')).toBeInTheDocument()
    expect(screen.getByText(/kết quả tìm thấy/i)).toBeInTheDocument()
  })

  it('Scenario 4: Thay đổi bộ lọc Golden và Topic gửi đúng payload filters', async () => {
    mockedSearchKnowledge.mockResolvedValue({
      results: [],
      latency_ms: 8.0,
    })

    renderWithClient(<SemanticSearchExplorer />)

    const input = screen.getByPlaceholderText(/Nhập câu hỏi hoặc từ khóa nghiên cứu/i)
    fireEvent.change(input, { target: { value: 'triz' } })

    // Toggle Golden Only
    const goldenToggle = screen.getByLabelText(/Chỉ tài liệu chuẩn vàng/i)
    fireEvent.click(goldenToggle)

    // Submit search
    const searchBtn = screen.getByRole('button', { name: /^Tìm kiếm$/i })
    fireEvent.click(searchBtn)

    await waitFor(() => {
      expect(mockedSearchKnowledge).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'triz',
          filters: expect.objectContaining({
            golden: true,
          }),
        })
      )
    })
  })

  it('Scenario 5: Hiển thị empty state khi không có kết quả phù hợp', async () => {
    mockedSearchKnowledge.mockResolvedValueOnce({
      results: [],
      latency_ms: 5.0,
    })

    renderWithClient(<SemanticSearchExplorer />)

    const input = screen.getByPlaceholderText(/Nhập câu hỏi hoặc từ khóa nghiên cứu/i)
    fireEvent.change(input, { target: { value: 'từ khóa không tồn tại' } })

    const searchBtn = screen.getByRole('button', { name: /^Tìm kiếm$/i })
    fireEvent.click(searchBtn)

    await waitFor(() => {
      expect(
        screen.getByText(/Không tìm thấy đoạn tri thức nào phù hợp/i)
      ).toBeInTheDocument()
    })
  })

  it('Scenario 6: Hiển thị error alert và cho phép Thử lại khi API lỗi', async () => {
    mockedSearchKnowledge.mockRejectedValueOnce(new Error('Internal Server Error 500'))

    renderWithClient(<SemanticSearchExplorer />)

    const input = screen.getByPlaceholderText(/Nhập câu hỏi hoặc từ khóa nghiên cứu/i)
    fireEvent.change(input, { target: { value: 'lỗi server' } })

    const searchBtn = screen.getByRole('button', { name: /^Tìm kiếm$/i })
    fireEvent.click(searchBtn)

    await waitFor(() => {
      expect(screen.getByText(/Lỗi khi tìm kiếm tri thức/i)).toBeInTheDocument()
    })

    const retryBtn = screen.getByRole('button', { name: /Thử lại/i })
    expect(retryBtn).toBeInTheDocument()

    // Mock success for retry
    mockedSearchKnowledge.mockResolvedValueOnce({
      results: [],
      latency_ms: 6.0,
    })

    fireEvent.click(retryBtn)

    await waitFor(() => {
      expect(
        screen.getByText(/Không tìm thấy đoạn tri thức nào phù hợp/i)
      ).toBeInTheDocument()
    })
  })

  it('Scenario 7: Hydrate query, topic, golden, top_k từ URL parameters khi tải trang', async () => {
    mockSearchParams = new URLSearchParams('q=pin+lithium&golden=true&top_k=20&topic=contradiction')

    mockedSearchKnowledge.mockResolvedValueOnce({
      results: [
        {
          chunk_id: 'chk-battery-01',
          source_ref: 'docs/case_studies_battery.md',
          excerpt: 'Giải pháp làm mát pin lithium dạng mô đun.',
          score: 0.95,
          metadata: {
            golden: true,
            topic: 'contradiction',
          },
        },
      ],
      latency_ms: 14.2,
    })

    renderWithClient(<SemanticSearchExplorer />)

    // Tự động gọi API với payload hydrate từ URL
    await waitFor(() => {
      expect(mockedSearchKnowledge).toHaveBeenCalledWith({
        query: 'pin lithium',
        top_k: 20,
        filters: {
          golden: true,
          topic: 'contradiction',
        },
      })
    })

    // Input và filter controls phản ánh đúng state từ URL
    const input = screen.getByPlaceholderText(/Nhập câu hỏi hoặc từ khóa nghiên cứu/i) as HTMLInputElement
    expect(input.value).toBe('pin lithium')

    const goldenCheckbox = screen.getByRole('checkbox') as HTMLInputElement
    expect(goldenCheckbox.checked).toBe(true)

    expect(await screen.findByText('Giải pháp làm mát pin lithium dạng mô đun.')).toBeInTheDocument()
  })

  it('Scenario 8: Nhấp "Đặt lại" xóa các filters và cập nhật URL loại bỏ stale parameters', async () => {
    mockSearchParams = new URLSearchParams('q=triz&golden=true&topic=contradiction')

    mockedSearchKnowledge.mockResolvedValue({
      results: [],
      latency_ms: 5.0,
    })

    renderWithClient(<SemanticSearchExplorer />)

    const resetBtn = await screen.findByRole('button', { name: /Đặt lại/i })
    fireEvent.click(resetBtn)

    expect(mockReplace).toHaveBeenCalledWith('/search?q=triz')
  })

  it('Scenario 9: Contextual Mode khi có session_id hiển thị liên kết quay lại session và nút Đính kèm', async () => {
    mockSearchParams = new URLSearchParams('q=triz&session_id=d9b2d20b-0001-0000-0000-000000000001')

    mockedSearchKnowledge.mockResolvedValueOnce({
      results: [
        {
          chunk_id: 'chk-triz-40',
          source_ref: 'docs/triz_matrix.md',
          excerpt: 'Nguyên tắc phân đoạn giúp giải quyết mâu thuẫn.',
          score: 0.96,
          metadata: {
            golden: true,
          },
        },
      ],
      latency_ms: 10.0,
    })

    renderWithClient(<SemanticSearchExplorer />)

    expect(await screen.findByText('Nguyên tắc phân đoạn giúp giải quyết mâu thuẫn.')).toBeInTheDocument()

    // Affordance quay lại session
    const backLink = screen.getByRole('link', { name: /Quay lại Session/i })
    expect(backLink).toHaveAttribute('href', '/sessions/d9b2d20b-0001-0000-0000-000000000001')

    // Nút Đính kèm vào Session trên card
    expect(screen.getByRole('button', { name: /Đính kèm vào Session/i })).toBeInTheDocument()
  })

  it('Scenario 10: Nhấp "Đính kèm vào Session" gọi createResearchNote và chuyển sang trạng thái Đã đính kèm', async () => {
    mockSearchParams = new URLSearchParams('q=triz&session_id=d9b2d20b-0001-0000-0000-000000000001')

    mockedSearchKnowledge.mockResolvedValueOnce({
      results: [
        {
          chunk_id: 'chk-triz-40',
          source_ref: 'docs/triz_matrix.md',
          excerpt: 'Nguyên tắc phân đoạn giúp giải quyết mâu thuẫn.',
          score: 0.96,
          metadata: {
            golden: true,
          },
        },
      ],
      latency_ms: 10.0,
    })

    const mockCreatedNote: ResearchNote = {
      id: 'note-001',
      session_id: 'd9b2d20b-0001-0000-0000-000000000001',
      content: '[docs/triz_matrix.md] (Độ liên quan: 96%)\nNguyên tắc phân đoạn giúp giải quyết mâu thuẫn.',
      note_type: 'insight',
      source_chunk_id: 'chk-triz-40',
      created_at: '2026-10-02T10:00:00Z',
    }

    mockedCreateResearchNote.mockResolvedValueOnce(mockCreatedNote)

    renderWithClient(<SemanticSearchExplorer />)

    const attachBtn = await screen.findByRole('button', { name: /Đính kèm vào Session/i })
    fireEvent.click(attachBtn)

    await waitFor(() => {
      expect(mockedCreateResearchNote).toHaveBeenCalledWith(
        'd9b2d20b-0001-0000-0000-000000000001',
        expect.objectContaining({
          note_type: 'insight',
          source_chunk_id: 'chk-triz-40',
          content: expect.stringContaining('docs/triz_matrix.md'),
        })
      )
    })

    // Trạng thái nút chuyển sang Đã đính kèm
    expect(await screen.findByText(/Đã đính kèm/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Đính kèm vào Session/i })).not.toBeInTheDocument()
  })

  it('Scenario 11: Standalone Mode (không có session_id) không hiển thị action đính kèm hay link quay lại', async () => {
    mockSearchParams = new URLSearchParams('q=triz')

    mockedSearchKnowledge.mockResolvedValueOnce({
      results: [
        {
          chunk_id: 'chk-triz-40',
          source_ref: 'docs/triz_matrix.md',
          excerpt: 'Nguyên tắc phân đoạn.',
          score: 0.9,
          metadata: {},
        },
      ],
      latency_ms: 10.0,
    })

    renderWithClient(<SemanticSearchExplorer />)

    expect(await screen.findByText('Nguyên tắc phân đoạn.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Quay lại Session/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Đính kèm vào Session/i })).not.toBeInTheDocument()
    expect(mockedListResearchNotes).not.toHaveBeenCalled()
  })

  describe('Phase 10.3 Increment 5: Contextual Evidence Pre-hydration & Duplicate Guard', () => {
    it('Scenario 12: Tự động gọi listResearchNotes và hydrate badge "Đã đính kèm" cho các chunk đã có trong session', async () => {
      mockSearchParams = new URLSearchParams('q=mâu+thuẫn&session_id=d9b2d20b-0001-0000-0000-000000000001')

      mockedSearchKnowledge.mockResolvedValueOnce({
        results: [
          {
            chunk_id: 'chk-already-attached',
            source_ref: 'docs/ADR-001.md',
            excerpt: 'Đoạn trích đã được lưu trước đó.',
            score: 0.95,
            metadata: {},
          },
          {
            chunk_id: 'chk-new-item',
            source_ref: 'docs/ADR-002.md',
            excerpt: 'Đoạn trích mới chưa đính kèm.',
            score: 0.88,
            metadata: {},
          },
        ],
        latency_ms: 12.0,
      })

      mockedListResearchNotes.mockResolvedValueOnce({
        data: [
          {
            id: 'note-existing-1',
            session_id: 'd9b2d20b-0001-0000-0000-000000000001',
            content: 'Ghi chú cũ',
            note_type: 'insight',
            source_chunk_id: 'chk-already-attached',
            created_at: '2026-10-02T08:00:00Z',
          },
        ],
        meta: { total: 1 },
      })

      renderWithClient(<SemanticSearchExplorer />)

      // Chờ API listResearchNotes được gọi với đúng sessionId
      await waitFor(() => {
        expect(mockedListResearchNotes).toHaveBeenCalledWith('d9b2d20b-0001-0000-0000-000000000001')
      })

      // Item 1 (đã có trong notes) hiển thị badge Đã đính kèm
      expect(await screen.findByText('Đoạn trích đã được lưu trước đó.')).toBeInTheDocument()
      expect(screen.getByText(/Đã đính kèm/i)).toBeInTheDocument()

      // Item 2 (chưa có trong notes) hiển thị nút Đính kèm vào Session
      expect(screen.getByText('Đoạn trích mới chưa đính kèm.')).toBeInTheDocument()
      const attachButtons = screen.getAllByRole('button', { name: /Đính kèm vào Session/i })
      expect(attachButtons.length).toBe(1)
    })

    it('Scenario 13: Không gọi listResearchNotes khi không có session_id (Standalone Mode)', async () => {
      mockSearchParams = new URLSearchParams('q=nguyên+tắc')

      mockedSearchKnowledge.mockResolvedValueOnce({
        results: [
          {
            chunk_id: 'chk-triz-1',
            source_ref: 'docs/triz.md',
            excerpt: 'Nguyên tắc 1.',
            score: 0.9,
            metadata: {},
          },
        ],
        latency_ms: 5.0,
      })

      renderWithClient(<SemanticSearchExplorer />)

      await screen.findByText('Nguyên tắc 1.')
      expect(mockedListResearchNotes).not.toHaveBeenCalled()
    })

    it('Scenario 14: Người dùng không thể thực hiện đính kèm trùng lặp cho chunk đã nằm trong tập attachedChunkIds', async () => {
      mockSearchParams = new URLSearchParams('q=triz&session_id=d9b2d20b-0001-0000-0000-000000000001')

      mockedSearchKnowledge.mockResolvedValueOnce({
        results: [
          {
            chunk_id: 'chk-duplicate-test',
            source_ref: 'docs/duplicate.md',
            excerpt: 'Nội dung trùng lặp.',
            score: 0.92,
            metadata: {},
          },
        ],
        latency_ms: 5.0,
      })

      mockedListResearchNotes.mockResolvedValueOnce({
        data: [
          {
            id: 'note-01',
            session_id: 'd9b2d20b-0001-0000-0000-000000000001',
            content: 'Ghi chú',
            note_type: 'insight',
            source_chunk_id: 'chk-duplicate-test',
            created_at: '2026-10-02T08:00:00Z',
          },
        ],
        meta: { total: 1 },
      })

      renderWithClient(<SemanticSearchExplorer />)

      // Chờ badge Đã đính kèm hiển thị
      expect(await screen.findByText(/Đã đính kèm/i)).toBeInTheDocument()

      // Nút Đính kèm không tồn tại
      expect(screen.queryByRole('button', { name: /Đính kèm vào Session/i })).not.toBeInTheDocument()

      // API createResearchNote không bao giờ được gọi
      expect(mockedCreateResearchNote).not.toHaveBeenCalled()
    })
  })

  describe('Phase 10.3 Increment 6: Contextual Session Enrichment, Evidence Counter & Tab-Aware Roundtrip', () => {
    it('Scenario 15: Contextual banner hiển thị session title, domain badge và evidence counter', async () => {
      mockSearchParams = new URLSearchParams('q=nhiệt&session_id=sess-pump-999&from_tab=retrieval')

      mockedSearchKnowledge.mockResolvedValueOnce({
        results: [
          {
            chunk_id: 'chk-1',
            source_ref: 'docs/heat_pump.md',
            excerpt: 'Máy bơm nhiệt.',
            score: 0.9,
            metadata: {},
          },
        ],
        latency_ms: 10.0,
      })

      mockedGetSession.mockResolvedValueOnce({
        id: 'sess-pump-999',
        title: 'Hệ thống bơm nhiệt mini tiết kiệm điện',
        domain: 'technical',
        status: 'active',
        tags: ['thermal', 'energy'],
      } as any)

      mockedListResearchNotes.mockResolvedValueOnce({
        data: [
          {
            id: 'n1',
            session_id: 'sess-pump-999',
            content: 'note 1',
            note_type: 'insight',
            source_chunk_id: 'chk-1',
            created_at: '2026-10-02T10:00:00Z',
          },
        ],
        meta: { total: 1 },
      })

      renderWithClient(<SemanticSearchExplorer />)

      // Chờ getSession được gọi
      await waitFor(() => {
        expect(mockedGetSession).toHaveBeenCalledWith('sess-pump-999')
      })

      // Hiển thị session title và domain badge
      expect(await screen.findByText('Hệ thống bơm nhiệt mini tiết kiệm điện')).toBeInTheDocument()
      expect(screen.getByText('technical')).toBeInTheDocument()

      // Hiển thị evidence counter
      const counterEl = screen.getByText(/bằng chứng vào sổ tay/i)
      expect(counterEl).toHaveTextContent('Đã lưu 1 bằng chứng vào sổ tay')

      // Link Quay lại Session có tab=retrieval
      const backLink = screen.getByRole('link', { name: /Quay lại Session/i })
      expect(backLink).toHaveAttribute('href', '/sessions/sess-pump-999?tab=retrieval')
    })

    it('Scenario 16: Quick Copy Citation sao chép format markdown vào clipboard và đổi trạng thái', async () => {
      mockSearchParams = new URLSearchParams('q=nguyên+tắc')

      const mockWriteText = jest.fn().mockResolvedValue(undefined)
      Object.assign(navigator, {
        clipboard: {
          writeText: mockWriteText,
        },
      })

      mockedSearchKnowledge.mockResolvedValueOnce({
        results: [
          {
            chunk_id: 'chk-cite-1',
            source_ref: 'docs/triz_p35.md',
            excerpt: 'Biến đổi trạng thái vật lý.',
            score: 0.95,
            metadata: {},
          },
        ],
        latency_ms: 5.0,
      })

      renderWithClient(<SemanticSearchExplorer />)

      await screen.findByText('Biến đổi trạng thái vật lý.')

      const copyBtn = screen.getByRole('button', { name: /Trích dẫn|Sao chép/i })
      fireEvent.click(copyBtn)

      expect(mockWriteText).toHaveBeenCalledWith('[docs/triz_p35.md]\n"Biến đổi trạng thái vật lý."')
      expect(await screen.findByText(/Đã chép/i)).toBeInTheDocument()
    })

    it('Scenario 17: Standalone Mode không gọi getSession', async () => {
      mockSearchParams = new URLSearchParams('q=độc+lập')

      mockedSearchKnowledge.mockResolvedValueOnce({
        results: [],
        latency_ms: 5.0,
      })

      renderWithClient(<SemanticSearchExplorer />)

      expect(mockedGetSession).not.toHaveBeenCalled()
    })
  })
})
