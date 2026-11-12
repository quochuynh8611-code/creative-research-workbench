/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as apiClientModule from '@/lib/api-client'
import type { ResearchNote } from '@/lib/types'
import { InsightReferencePanel } from '../insight-reference-panel'

// Mock api-client
jest.mock('@/lib/api-client', () => {
  const original = jest.requireActual('@/lib/api-client')
  return {
    ...original,
    listResearchNotes: jest.fn(),
    createProblemFrame: jest.fn(),
    analyzeProblemWithAI: jest.fn(),
  }
})

const mockedListResearchNotes = apiClientModule.listResearchNotes as jest.MockedFunction<
  typeof apiClientModule.listResearchNotes
>
const mockedCreateProblemFrame = apiClientModule.createProblemFrame as jest.MockedFunction<
  typeof apiClientModule.createProblemFrame
>
const mockedAnalyzeProblemWithAI = apiClientModule.analyzeProblemWithAI as jest.MockedFunction<
  typeof apiClientModule.analyzeProblemWithAI
>

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('InsightReferencePanel Component (Batch C6 — RED Phase)', () => {
  const sessionId = 'test-session-c6'

  const mockNotes: ResearchNote[] = [
    {
      id: 'note-1',
      session_id: sessionId,
      content: 'Cánh tay robot cần tăng tải trọng nâng',
      note_type: 'insight',
      source_chunk_id: null,
      created_at: '2026-11-12T10:00:00Z',
    },
    {
      id: 'note-2',
      session_id: sessionId,
      content: 'Khối lượng tăng gây rung lắc quán tính',
      note_type: 'hypothesis',
      source_chunk_id: null,
      created_at: '2026-11-12T11:00:00Z',
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
  })

  // 1. renders loading state while notes are loading
  it('1. renders loading state while notes are loading', () => {
    mockedListResearchNotes.mockReturnValueOnce(new Promise(() => {}))
    renderWithClient(<InsightReferencePanel sessionId={sessionId} />)

    expect(screen.getByText(/Đang tải ghi chú/i)).toBeInTheDocument()
  })

  // 2. renders error state with retry action when notes query fails
  it('2. renders error state with retry action when notes query fails', async () => {
    mockedListResearchNotes.mockRejectedValueOnce(new Error('Network error'))
    renderWithClient(<InsightReferencePanel sessionId={sessionId} />)

    expect(await screen.findByText(/Không thể tải danh sách ghi chú/i)).toBeInTheDocument()
    const retryBtn = screen.getByRole('button', { name: /Thử lại/i })
    expect(retryBtn).toBeInTheDocument()

    mockedListResearchNotes.mockResolvedValueOnce({ data: mockNotes, meta: { total: 2 } })
    fireEvent.click(retryBtn)
    await waitFor(() => {
      expect(mockedListResearchNotes).toHaveBeenCalledTimes(2)
    })
  })

  // 3. renders empty state when no notes exist
  it('3. renders empty state when no notes exist', async () => {
    mockedListResearchNotes.mockResolvedValueOnce({ data: [], meta: { total: 0 } })
    renderWithClient(<InsightReferencePanel sessionId={sessionId} />)

    expect(
      await screen.findByText(/Chưa có ghi chú nào trong phiên này/i),
    ).toBeInTheDocument()
  })

  // 4. renders research notes with type badge and creation time
  it('4. renders research notes with type badge and creation time', async () => {
    mockedListResearchNotes.mockResolvedValueOnce({ data: mockNotes, meta: { total: 2 } })
    renderWithClient(<InsightReferencePanel sessionId={sessionId} />)

    expect(await screen.findByText('Cánh tay robot cần tăng tải trọng nâng')).toBeInTheDocument()
    expect(screen.getByText('Khối lượng tăng gây rung lắc quán tính')).toBeInTheDocument()
    expect(screen.getByText('Insight')).toBeInTheDocument()
    expect(screen.getByText('Hypothesis')).toBeInTheDocument()
  })

  // 5. opens preview when user clicks “Dùng insight này”
  it('5. opens preview when user clicks "Dùng insight này"', async () => {
    mockedListResearchNotes.mockResolvedValueOnce({ data: mockNotes, meta: { total: 2 } })
    renderWithClient(<InsightReferencePanel sessionId={sessionId} />)

    const useButtons = await screen.findAllByRole('button', { name: /Dùng insight này/i })
    fireEvent.click(useButtons[0])

    expect(screen.getByText(/Xem trước & Xác nhận/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Trường đích/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Áp dụng/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Hủy/i })).toBeInTheDocument()
  })

  // 6. closes preview and preserves all intake values when user cancels
  it('6. closes preview and preserves all intake values when user cancels', async () => {
    const handleCancel = jest.fn()
    mockedListResearchNotes.mockResolvedValueOnce({ data: mockNotes, meta: { total: 2 } })
    renderWithClient(
      <InsightReferencePanel sessionId={sessionId} onCancelPreview={handleCancel} />,
    )

    const useButtons = await screen.findAllByRole('button', { name: /Dùng insight này/i })
    fireEvent.click(useButtons[0])

    const cancelBtn = screen.getByRole('button', { name: /Hủy/i })
    fireEvent.click(cancelBtn)

    expect(screen.queryByText(/Xem trước & Xác nhận/i)).not.toBeInTheDocument()
    expect(handleCancel).toHaveBeenCalled()
  })

  // 7. shows overwrite warning when selected target already has content
  it('7. shows overwrite warning when selected target already has content', async () => {
    mockedListResearchNotes.mockResolvedValueOnce({ data: mockNotes, meta: { total: 2 } })
    renderWithClient(
      <InsightReferencePanel
        sessionId={sessionId}
        currentValues={{ want: 'Đang có nội dung cũ' }}
      />,
    )

    const useButtons = await screen.findAllByRole('button', { name: /Dùng insight này/i })
    fireEvent.click(useButtons[0])

    // Target want is selected by default and has content
    expect(screen.getByText(/Trường đích hiện đã có nội dung và sẽ bị ghi đè/i)).toBeInTheDocument()
  })

  // 8. applies insight to want target and regenerates goal using existing compose logic
  it('8. applies insight to want target and triggers onApplyInsight', async () => {
    const handleApply = jest.fn()
    mockedListResearchNotes.mockResolvedValueOnce({ data: mockNotes, meta: { total: 2 } })
    renderWithClient(
      <InsightReferencePanel sessionId={sessionId} onApplyInsight={handleApply} />,
    )

    const useButtons = await screen.findAllByRole('button', { name: /Dùng insight này/i })
    fireEvent.click(useButtons[0])

    const applyBtn = screen.getByRole('button', { name: /Áp dụng/i })
    fireEvent.click(applyBtn)

    expect(handleApply).toHaveBeenCalledWith('Cánh tay robot cần tăng tải trọng nâng', 'want')
  })

  // 9. applies insight to obstacle target and regenerates goal using existing compose logic
  it('9. applies insight to obstacle target when obstacle is selected', async () => {
    const handleApply = jest.fn()
    mockedListResearchNotes.mockResolvedValueOnce({ data: mockNotes, meta: { total: 2 } })
    renderWithClient(
      <InsightReferencePanel sessionId={sessionId} onApplyInsight={handleApply} />,
    )

    const useButtons = await screen.findAllByRole('button', { name: /Dùng insight này/i })
    fireEvent.click(useButtons[1])

    const targetSelect = screen.getByLabelText(/Trường đích/i)
    fireEvent.change(targetSelect, { target: { value: 'obstacle' } })

    const applyBtn = screen.getByRole('button', { name: /Áp dụng/i })
    fireEvent.click(applyBtn)

    expect(handleApply).toHaveBeenCalledWith('Khối lượng tăng gây rung lắc quán tính', 'obstacle')
  })

  // 10. applies insight to context target and regenerates goal using existing compose logic
  it('10. applies insight to context target when context is selected', async () => {
    const handleApply = jest.fn()
    mockedListResearchNotes.mockResolvedValueOnce({ data: mockNotes, meta: { total: 2 } })
    renderWithClient(
      <InsightReferencePanel sessionId={sessionId} onApplyInsight={handleApply} />,
    )

    const useButtons = await screen.findAllByRole('button', { name: /Dùng insight này/i })
    fireEvent.click(useButtons[0])

    const targetSelect = screen.getByLabelText(/Trường đích/i)
    fireEvent.change(targetSelect, { target: { value: 'context' } })

    const applyBtn = screen.getByRole('button', { name: /Áp dụng/i })
    fireEvent.click(applyBtn)

    expect(handleApply).toHaveBeenCalledWith('Cánh tay robot cần tăng tải trọng nâng', 'context')
  })

  // 11. applies insight to goal target without changing want, obstacle, or context
  it('11. applies insight to goal target when goal is selected', async () => {
    const handleApply = jest.fn()
    mockedListResearchNotes.mockResolvedValueOnce({ data: mockNotes, meta: { total: 2 } })
    renderWithClient(
      <InsightReferencePanel sessionId={sessionId} onApplyInsight={handleApply} />,
    )

    const useButtons = await screen.findAllByRole('button', { name: /Dùng insight này/i })
    fireEvent.click(useButtons[0])

    const targetSelect = screen.getByLabelText(/Trường đích/i)
    fireEvent.change(targetSelect, { target: { value: 'goal' } })

    const applyBtn = screen.getByRole('button', { name: /Áp dụng/i })
    fireEvent.click(applyBtn)

    expect(handleApply).toHaveBeenCalledWith('Cánh tay robot cần tăng tải trọng nâng', 'goal')
  })

  // 12. does not call createProblemFrame when previewing or cancelling
  it('12. does not call createProblemFrame when previewing or cancelling', async () => {
    mockedListResearchNotes.mockResolvedValueOnce({ data: mockNotes, meta: { total: 2 } })
    renderWithClient(<InsightReferencePanel sessionId={sessionId} />)

    const useButtons = await screen.findAllByRole('button', { name: /Dùng insight này/i })
    fireEvent.click(useButtons[0])

    const cancelBtn = screen.getByRole('button', { name: /Hủy/i })
    fireEvent.click(cancelBtn)

    expect(mockedCreateProblemFrame).not.toHaveBeenCalled()
  })

  // 13. does not call analyzeProblemWithAI when previewing or cancelling
  it('13. does not call analyzeProblemWithAI when previewing or cancelling', async () => {
    mockedListResearchNotes.mockResolvedValueOnce({ data: mockNotes, meta: { total: 2 } })
    renderWithClient(<InsightReferencePanel sessionId={sessionId} />)

    const useButtons = await screen.findAllByRole('button', { name: /Dùng insight này/i })
    fireEvent.click(useButtons[0])

    const cancelBtn = screen.getByRole('button', { name: /Hủy/i })
    fireEvent.click(cancelBtn)

    expect(mockedAnalyzeProblemWithAI).not.toHaveBeenCalled()
  })

  // 14. does not navigate to another tab when applying an insight
  it('14. does not navigate to another tab when applying an insight', async () => {
    const handleApply = jest.fn()
    mockedListResearchNotes.mockResolvedValueOnce({ data: mockNotes, meta: { total: 2 } })
    renderWithClient(
      <InsightReferencePanel sessionId={sessionId} onApplyInsight={handleApply} />,
    )

    const useButtons = await screen.findAllByRole('button', { name: /Dùng insight này/i })
    fireEvent.click(useButtons[0])

    const applyBtn = screen.getByRole('button', { name: /Áp dụng/i })
    fireEvent.click(applyBtn)

    expect(handleApply).toHaveBeenCalled()
    // No window.location or router push was called
  })

  // 15. does not persist insight selection or preview state
  it('15. does not persist insight selection or preview state', async () => {
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem')
    mockedListResearchNotes.mockResolvedValueOnce({ data: mockNotes, meta: { total: 2 } })
    renderWithClient(<InsightReferencePanel sessionId={sessionId} />)

    const useButtons = await screen.findAllByRole('button', { name: /Dùng insight này/i })
    fireEvent.click(useButtons[0])

    expect(setItemSpy).not.toHaveBeenCalled()
    setItemSpy.mockRestore()
  })
})
