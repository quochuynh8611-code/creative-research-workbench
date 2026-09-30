/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SearchOverlay } from '../search-overlay'
import * as apiClient from '@/lib/api-client'
import type { SearchResponse } from '@/lib/types'

jest.mock('@/lib/api-client', () => ({
  searchKnowledge: jest.fn(),
}))

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  })
}

describe('Phase 5.7 — SearchOverlay Component Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers()
    })
    jest.useRealTimers()
  })

  const mockSearchResponse: SearchResponse = {
    results: [
      {
        chunk_id: 'chunk-101',
        source_ref: 'docs/ADR-001-architecture.md',
        excerpt: 'Kiến trúc Hybrid Search kết hợp Full-text và Vector Embeddings với Reciprocal Rank Fusion.',
        score: 0.94,
        metadata: { topic: 'architecture' },
      },
      {
        chunk_id: 'chunk-102',
        source_ref: 'docs/DOMAIN_SCHEMA.md',
        excerpt: 'Mô hình ResearchSession và ProblemFrame cho quy trình TRIZ 6 giai đoạn.',
        score: 0.82,
        metadata: { topic: 'domain-model' },
      },
    ],
    latency_ms: 85,
  }

  it('1. Mở overlay khi nhấn tổ hợp phím Cmd+K hoặc Ctrl+K', () => {
    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <SearchOverlay />
      </QueryClientProvider>
    )

    // Ban đầu overlay đóng
    expect(screen.queryByPlaceholderText(/Tìm kiếm trong kho tri thức/i)).not.toBeInTheDocument()

    // Nhấn Cmd+K
    fireEvent.keyDown(window, { key: 'k', metaKey: true })

    expect(screen.getByPlaceholderText(/Tìm kiếm trong kho tri thức/i)).toBeInTheDocument()
  })

  it('2. Đóng overlay khi nhấn phím Escape', () => {
    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <SearchOverlay defaultOpen={true} />
      </QueryClientProvider>
    )

    expect(screen.getByPlaceholderText(/Tìm kiếm trong kho tri thức/i)).toBeInTheDocument()

    // Nhấn Escape
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(screen.queryByPlaceholderText(/Tìm kiếm trong kho tri thức/i)).not.toBeInTheDocument()
  })

  it('3. Debounce input khi gõ và gọi API searchKnowledge sau 300ms', async () => {
    ;(apiClient.searchKnowledge as jest.Mock).mockResolvedValue(mockSearchResponse)
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <SearchOverlay defaultOpen={true} />
      </QueryClientProvider>
    )

    const input = screen.getByPlaceholderText(/Tìm kiếm trong kho tri thức/i)
    fireEvent.change(input, { target: { value: 'mâu thuẫn' } })

    // Chưa gọi ngay khi vừa gõ
    expect(apiClient.searchKnowledge).not.toHaveBeenCalled()

    // Tua nhanh qua 300ms debounce
    act(() => {
      jest.advanceTimersByTime(350)
    })

    await waitFor(() => {
      expect(apiClient.searchKnowledge).toHaveBeenCalledWith({
        query: 'mâu thuẫn',
        top_k: 5,
      })
    })
  })

  it('4. Render đúng danh sách kết quả với source_ref, excerpt và score %', async () => {
    ;(apiClient.searchKnowledge as jest.Mock).mockResolvedValue(mockSearchResponse)
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <SearchOverlay defaultOpen={true} />
      </QueryClientProvider>
    )

    const input = screen.getByPlaceholderText(/Tìm kiếm trong kho tri thức/i)
    fireEvent.change(input, { target: { value: 'kiến trúc hybrid' } })

    act(() => {
      jest.advanceTimersByTime(350)
    })

    await waitFor(() => {
      expect(screen.getByText('docs/ADR-001-architecture.md')).toBeInTheDocument()
      expect(screen.getByText(/Kiến trúc Hybrid Search/i)).toBeInTheDocument()
      expect(screen.getByText('94%')).toBeInTheDocument()
      expect(screen.getByText('docs/DOMAIN_SCHEMA.md')).toBeInTheDocument()
      expect(screen.getByText('82%')).toBeInTheDocument()
    })
  })

  it('5. Hiển thị Empty state khi không có kết quả tìm kiếm nào', async () => {
    ;(apiClient.searchKnowledge as jest.Mock).mockResolvedValue({
      results: [],
      latency_ms: 30,
    })
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <SearchOverlay defaultOpen={true} />
      </QueryClientProvider>
    )

    const input = screen.getByPlaceholderText(/Tìm kiếm trong kho tri thức/i)
    fireEvent.change(input, { target: { value: 'từ khóa lạ' } })

    act(() => {
      jest.advanceTimersByTime(350)
    })

    await waitFor(() => {
      expect(screen.getByText(/Không tìm thấy tài liệu nào/i)).toBeInTheDocument()
    })
  })

  it('6. Hiển thị thông báo lỗi khi API search thất bại', async () => {
    ;(apiClient.searchKnowledge as jest.Mock).mockRejectedValue(
      new Error('Lỗi máy chủ tìm kiếm')
    )
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <SearchOverlay defaultOpen={true} />
      </QueryClientProvider>
    )

    const input = screen.getByPlaceholderText(/Tìm kiếm trong kho tri thức/i)
    fireEvent.change(input, { target: { value: 'lỗi test' } })

    act(() => {
      jest.advanceTimersByTime(350)
    })

    await waitFor(() => {
      expect(screen.getByText(/Không thể thực hiện tìm kiếm/i)).toBeInTheDocument()
      expect(screen.getByText(/Lỗi máy chủ tìm kiếm/i)).toBeInTheDocument()
    })
  })

  it('7. Gọi callback onSelectResult khi click vào một kết quả', async () => {
    ;(apiClient.searchKnowledge as jest.Mock).mockResolvedValue(mockSearchResponse)
    const onSelectMock = jest.fn()
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <SearchOverlay defaultOpen={true} onSelectResult={onSelectMock} />
      </QueryClientProvider>
    )

    const input = screen.getByPlaceholderText(/Tìm kiếm trong kho tri thức/i)
    fireEvent.change(input, { target: { value: 'kiến trúc' } })

    act(() => {
      jest.advanceTimersByTime(350)
    })

    await waitFor(() => {
      expect(screen.getByText('docs/ADR-001-architecture.md')).toBeInTheDocument()
    })

    const firstResult = screen.getByText('docs/ADR-001-architecture.md').closest('button')
    if (firstResult) {
      fireEvent.click(firstResult)
      expect(onSelectMock).toHaveBeenCalledWith(mockSearchResponse.results[0])
    }
  })
})
