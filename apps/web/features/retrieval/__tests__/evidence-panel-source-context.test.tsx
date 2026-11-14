/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { EvidencePanel } from '../evidence-panel'
import * as apiClient from '@/lib/api-client'
import type { SearchResponse, NoteDraft } from '@/lib/types'

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

describe('Batch C7c-2e: EvidencePanel source_context UI Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const validItem = {
    chunk_id: 'chunk-001',
    source_ref: 'docs/ADR-001-architecture.md',
    excerpt: 'TRIZ Inventive Principle 35 parameter changes allows modifying physical state.',
    score: 0.89,
    metadata: { topic: 'contradiction', status: 'canonical' },
  }

  it('1. Happy path: khi item hợp lệ, bấm Lưu vào sổ tay truyền source_context đúng chuẩn kèm source_chunk_id', async () => {
    const mockResponse: SearchResponse = {
      results: [validItem],
      latency_ms: 50,
    }
    ;(apiClient.searchKnowledge as jest.Mock).mockResolvedValueOnce(mockResponse)
    const onSaveAsNoteMock = jest.fn()
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <EvidencePanel sessionId="sess-123" onSaveAsNote={onSaveAsNoteMock} />
      </QueryClientProvider>
    )

    await screen.findByText('docs/ADR-001-architecture.md')

    const saveBtn = screen.getByRole('button', { name: /lưu vào sổ tay/i })
    fireEvent.click(saveBtn)

    expect(onSaveAsNoteMock).toHaveBeenCalledTimes(1)
    const draft: NoteDraft = onSaveAsNoteMock.mock.calls[0][0]
    expect(draft.source_context).toEqual({
      schema_version: 1,
      source_type: 'evidence',
      source_ref: 'docs/ADR-001-architecture.md',
    })
    expect(draft.source_chunk_id).toBe('chunk-001')
    expect(draft.note_type).toBe('insight')
  })

  it('2. Fail-closed: khi source_ref là chuỗi rỗng "", chặn gọi onSaveAsNote và hiển thị alert', async () => {
    const invalidItem = {
      ...validItem,
      source_ref: '',
    }
    const mockResponse: SearchResponse = {
      results: [invalidItem],
      latency_ms: 50,
    }
    ;(apiClient.searchKnowledge as jest.Mock).mockResolvedValueOnce(mockResponse)
    const onSaveAsNoteMock = jest.fn()
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <EvidencePanel sessionId="sess-123" onSaveAsNote={onSaveAsNoteMock} />
      </QueryClientProvider>
    )

    await screen.findByRole('button', { name: /lưu vào sổ tay/i })

    const saveBtn = screen.getByRole('button', { name: /lưu vào sổ tay/i })
    fireEvent.click(saveBtn)

    expect(onSaveAsNoteMock).not.toHaveBeenCalled()
    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveTextContent(/không hợp lệ|source_ref/i)
  })

  it('3. Fail-closed: khi source_ref chứa ký tự ngắt dòng \\n, chặn gọi onSaveAsNote và hiển thị alert', async () => {
    const invalidItem = {
      ...validItem,
      source_ref: 'docs/ADR-001\narchitecture.md',
    }
    const mockResponse: SearchResponse = {
      results: [invalidItem],
      latency_ms: 50,
    }
    ;(apiClient.searchKnowledge as jest.Mock).mockResolvedValueOnce(mockResponse)
    const onSaveAsNoteMock = jest.fn()
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <EvidencePanel sessionId="sess-123" onSaveAsNote={onSaveAsNoteMock} />
      </QueryClientProvider>
    )

    await screen.findByRole('button', { name: /lưu vào sổ tay/i })

    const saveBtn = screen.getByRole('button', { name: /lưu vào sổ tay/i })
    fireEvent.click(saveBtn)

    expect(onSaveAsNoteMock).not.toHaveBeenCalled()
    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveTextContent(/không hợp lệ|source_ref/i)
  })

  it('4. Fail-closed: khi source_ref vượt quá 255 ký tự, chặn gọi onSaveAsNote và hiển thị alert', async () => {
    const invalidItem = {
      ...validItem,
      source_ref: 'a'.repeat(256),
    }
    const mockResponse: SearchResponse = {
      results: [invalidItem],
      latency_ms: 50,
    }
    ;(apiClient.searchKnowledge as jest.Mock).mockResolvedValueOnce(mockResponse)
    const onSaveAsNoteMock = jest.fn()
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <EvidencePanel sessionId="sess-123" onSaveAsNote={onSaveAsNoteMock} />
      </QueryClientProvider>
    )

    await screen.findByRole('button', { name: /lưu vào sổ tay/i })

    const saveBtn = screen.getByRole('button', { name: /lưu vào sổ tay/i })
    fireEvent.click(saveBtn)

    expect(onSaveAsNoteMock).not.toHaveBeenCalled()
    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveTextContent(/không hợp lệ|source_ref/i)
  })

  it('5. Fail-closed: khi source_ref chỉ toàn khoảng trắng, chặn gọi onSaveAsNote và hiển thị alert', async () => {
    const invalidItem = {
      ...validItem,
      source_ref: '   ',
    }
    const mockResponse: SearchResponse = {
      results: [invalidItem],
      latency_ms: 50,
    }
    ;(apiClient.searchKnowledge as jest.Mock).mockResolvedValueOnce(mockResponse)
    const onSaveAsNoteMock = jest.fn()
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <EvidencePanel sessionId="sess-123" onSaveAsNote={onSaveAsNoteMock} />
      </QueryClientProvider>
    )

    await screen.findByRole('button', { name: /lưu vào sổ tay/i })

    const saveBtn = screen.getByRole('button', { name: /lưu vào sổ tay/i })
    fireEvent.click(saveBtn)

    expect(onSaveAsNoteMock).not.toHaveBeenCalled()
    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveTextContent(/không hợp lệ|source_ref/i)
  })

  it('6. Xóa thông báo lỗi khi bấm Lưu vào sổ tay cho một item hợp lệ', async () => {
    const invalidItem = {
      ...validItem,
      chunk_id: 'chunk-invalid',
      source_ref: '',
    }
    const validItem2 = {
      ...validItem,
      chunk_id: 'chunk-valid-2',
      source_ref: 'docs/VALID.md',
    }
    const mockResponse: SearchResponse = {
      results: [invalidItem, validItem2],
      latency_ms: 50,
    }
    ;(apiClient.searchKnowledge as jest.Mock).mockResolvedValueOnce(mockResponse)
    const onSaveAsNoteMock = jest.fn()
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <EvidencePanel sessionId="sess-123" onSaveAsNote={onSaveAsNoteMock} />
      </QueryClientProvider>
    )

    await screen.findByText('docs/VALID.md')

    const saveBtns = screen.getAllByRole('button', { name: /lưu vào sổ tay/i })
    expect(saveBtns).toHaveLength(2)

    // Bấm lưu item 1 (invalid) -> phải hiện alert lỗi
    fireEvent.click(saveBtns[0])
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(onSaveAsNoteMock).not.toHaveBeenCalled()

    // Bấm lưu item 2 (valid) -> alert lỗi phải biến mất và gọi onSaveAsNote
    fireEvent.click(saveBtns[1])
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(onSaveAsNoteMock).toHaveBeenCalledTimes(1)
    expect(onSaveAsNoteMock.mock.calls[0][0].source_context).toEqual({
      schema_version: 1,
      source_type: 'evidence',
      source_ref: 'docs/VALID.md',
    })
  })
})
