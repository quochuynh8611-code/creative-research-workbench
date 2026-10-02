/** @jest-environment jsdom */
import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SemanticSearchExplorer } from '../semantic-search-explorer'
import { searchKnowledge, createResearchNote } from '@/lib/api-client'
import type { SearchResponse, ResearchNote } from '@/lib/types'

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
}))

const mockedSearchKnowledge = searchKnowledge as jest.MockedFunction<typeof searchKnowledge>
const mockedCreateResearchNote = createResearchNote as jest.MockedFunction<typeof createResearchNote>

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

describe('SemanticSearchExplorer Component Tests (Phase 10.3 Increment 1)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
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
  })
})
