/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { EvidencePanel } from '../evidence-panel'
import * as apiClient from '@/lib/api-client'
import type { SearchResponse } from '@/lib/types'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

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

describe('Phase 5.6 & Phase 10.3 — EvidencePanel Component Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const mockSearchResponse: SearchResponse = {
    results: [
      {
        chunk_id: 'chunk-001',
        source_ref: 'docs/ADR-001-architecture.md',
        excerpt: 'TRIZ Inventive Principle 35 parameter changes allows modifying physical state.',
        score: 0.89,
        metadata: { topic: 'contradiction', status: 'canonical' },
      },
      {
        chunk_id: 'chunk-002',
        source_ref: 'docs/DOMAIN_SCHEMA.md',
        excerpt: 'Contradiction model stores improving and worsening parameters for resolution.',
        score: 0.76,
        metadata: { topic: 'domain-model', status: 'canonical' },
      },
    ],
    latency_ms: 120,
  }

  it('1. Render danh sách các đoạn trích dẫn tài liệu với source_ref, excerpt và điểm tương đồng', async () => {
    ;(apiClient.searchKnowledge as jest.Mock).mockResolvedValueOnce(mockSearchResponse)
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <EvidencePanel
          sessionId="sess-123"
          initialQuery="mâu thuẫn thông số vật liệu"
        />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('docs/ADR-001-architecture.md')).toBeInTheDocument()
      expect(screen.getByText(/TRIZ Inventive Principle 35/i)).toBeInTheDocument()
      expect(screen.getByText('89%')).toBeInTheDocument()
      expect(screen.getByText('docs/DOMAIN_SCHEMA.md')).toBeInTheDocument()
      expect(screen.getByText('76%')).toBeInTheDocument()
    })
  })

  it('2. Hiển thị trạng thái Loading khi đang tìm kiếm', async () => {
    let resolveSearch: any
    const pendingPromise = new Promise((resolve) => {
      resolveSearch = resolve
    })
    ;(apiClient.searchKnowledge as jest.Mock).mockReturnValueOnce(pendingPromise)
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <EvidencePanel
          sessionId="sess-123"
          initialQuery="mâu thuẫn thông số"
        />
      </QueryClientProvider>
    )

    expect(screen.getByText(/Đang truy xuất bằng chứng/i)).toBeInTheDocument()

    await React.act(async () => {
      resolveSearch(mockSearchResponse)
    })
  })

  it('3. Hiển thị thông báo lỗi và nút Thử lại khi API tìm kiếm thất bại', async () => {
    ;(apiClient.searchKnowledge as jest.Mock).mockRejectedValueOnce(
      new Error('Lỗi kết nối cơ sở tri thức')
    )
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <EvidencePanel
          sessionId="sess-123"
          initialQuery="lỗi truy xuất"
        />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/Không thể truy xuất bằng chứng/i)).toBeInTheDocument()
      expect(screen.getByText(/Lỗi kết nối cơ sở tri thức/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Thử lại/i })).toBeInTheDocument()
    })
  })

  it('4. Hiển thị Empty state khi không có kết quả tìm kiếm nào', async () => {
    ;(apiClient.searchKnowledge as jest.Mock).mockResolvedValueOnce({
      results: [],
      latency_ms: 45,
    })
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <EvidencePanel
          sessionId="sess-123"
          initialQuery="từ khóa không tồn tại"
        />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/Không tìm thấy tài liệu phù hợp/i)).toBeInTheDocument()
    })
  })

  it('5. Cho phép người dùng nhập từ khóa tìm kiếm mới trong panel', async () => {
    ;(apiClient.searchKnowledge as jest.Mock).mockResolvedValue(mockSearchResponse)
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <EvidencePanel
          sessionId="sess-123"
          initialQuery="cánh tay robot"
        />
      </QueryClientProvider>
    )

    const searchInput = screen.getByPlaceholderText(/Tìm kiếm tài liệu & bằng chứng/i)
    fireEvent.change(searchInput, { target: { value: 'nguyên tắc phân đoạn' } })

    const searchBtn = screen.getByRole('button', { name: /Tìm/i })
    fireEvent.click(searchBtn)

    await waitFor(() => {
      expect(apiClient.searchKnowledge).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'nguyên tắc phân đoạn',
        })
      )
    })
  })

  it('6. Kích hoạt callback onSaveAsNote với thông tin trích dẫn khi bấm nút Lưu vào sổ tay', async () => {
    ;(apiClient.searchKnowledge as jest.Mock).mockResolvedValue(mockSearchResponse)
    const onSaveAsNoteMock = jest.fn()
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <EvidencePanel
          sessionId="sess-123"
          initialQuery="mâu thuẫn thông số vật liệu"
          onSaveAsNote={onSaveAsNoteMock}
        />
      </QueryClientProvider>
    )

    await screen.findByText('docs/ADR-001-architecture.md')

    const saveBtns = screen.getAllByRole('button', { name: /lưu vào sổ tay|lưu thành ghi chú/i })
    expect(saveBtns.length).toBeGreaterThan(0)
    fireEvent.click(saveBtns[0])

    expect(onSaveAsNoteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining(mockSearchResponse.results[0].excerpt),
        note_type: 'insight',
        source_chunk_id: 'chunk-001',
      })
    )
  })

  describe('Phase 10.3 Increment 4: Search Explorer Bridge', () => {
    it('7. Render CTA "Mở trong Search Explorer" trên thanh công cụ EvidencePanel', async () => {
      ;(apiClient.searchKnowledge as jest.Mock).mockResolvedValueOnce({ results: [], latency_ms: 10 })
      const queryClient = createTestQueryClient()

      render(
        <QueryClientProvider client={queryClient}>
          <EvidencePanel
            sessionId="sess-123"
            initialQuery="từ khóa thử nghiệm"
          />
        </QueryClientProvider>
      )

      const ctaBtn = screen.getByRole('button', { name: /Mở trong Search Explorer/i })
      expect(ctaBtn).toBeInTheDocument()
    })

    it('8. Click CTA "Mở trong Search Explorer" điều hướng sang /search với query hiện tại và sessionId', async () => {
      ;(apiClient.searchKnowledge as jest.Mock).mockResolvedValueOnce({ results: [], latency_ms: 10 })
      const queryClient = createTestQueryClient()

      render(
        <QueryClientProvider client={queryClient}>
          <EvidencePanel
            sessionId="sess-456"
            initialQuery="máy bơm nhiệt mini"
          />
        </QueryClientProvider>
      )

      const ctaBtn = screen.getByRole('button', { name: /Mở trong Search Explorer/i })
      fireEvent.click(ctaBtn)

      expect(mockPush).toHaveBeenCalledTimes(1)
      expect(mockPush).toHaveBeenCalledWith('/search?q=m%C3%A1y+b%C6%A1m+nhi%E1%BB%87t+mini&session_id=sess-456')
    })

    it('9. Click CTA ưu tiên searchInput nếu người dùng thay đổi từ khóa trong ô tìm kiếm', async () => {
      ;(apiClient.searchKnowledge as jest.Mock).mockResolvedValue({ results: [], latency_ms: 10 })
      const queryClient = createTestQueryClient()

      render(
        <QueryClientProvider client={queryClient}>
          <EvidencePanel
            sessionId="sess-789"
            initialQuery="từ khóa cũ"
          />
        </QueryClientProvider>
      )

      const searchInput = screen.getByPlaceholderText(/Tìm kiếm tài liệu & bằng chứng/i)
      fireEvent.change(searchInput, { target: { value: 'nguyên tắc triz mới' } })

      const ctaBtn = screen.getByRole('button', { name: /Mở trong Search Explorer/i })
      fireEvent.click(ctaBtn)

      expect(mockPush).toHaveBeenCalledTimes(1)
      expect(mockPush).toHaveBeenCalledWith('/search?q=nguy%C3%AAn+t%E1%BA%AFc+triz+m%E1%BB%9Bi&session_id=sess-789')
    })

    it('10. Click CTA fallback an toàn khi không có query nào (chỉ mang theo session_id)', async () => {
      ;(apiClient.searchKnowledge as jest.Mock).mockResolvedValueOnce({ results: [], latency_ms: 10 })
      const queryClient = createTestQueryClient()

      render(
        <QueryClientProvider client={queryClient}>
          <EvidencePanel
            sessionId="sess-blank"
            initialQuery=""
          />
        </QueryClientProvider>
      )

      const ctaBtn = screen.getByRole('button', { name: /Mở trong Search Explorer/i })
      fireEvent.click(ctaBtn)

      expect(mockPush).toHaveBeenCalledTimes(1)
      expect(mockPush).toHaveBeenCalledWith('/search?session_id=sess-blank')
    })
  })
})
