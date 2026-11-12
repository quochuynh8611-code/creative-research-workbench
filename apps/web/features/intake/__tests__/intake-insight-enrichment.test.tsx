/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntakeForm } from '../intake-form'
import * as apiClientModule from '@/lib/api-client'
import type { ResearchNote } from '@/lib/types'

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

describe('IntakeForm — Insight Enrichment Integration (Batch C6 — RED Phase)', () => {
  const sessionId = 'test-session-intake-c6'

  const mockNotes: ResearchNote[] = [
    {
      id: 'note-1',
      session_id: sessionId,
      content: 'Tăng tốc độ xử lý dữ liệu lên 10 lần',
      note_type: 'insight',
      source_chunk_id: null,
      created_at: '2026-11-12T10:00:00Z',
    },
    {
      id: 'note-2',
      session_id: sessionId,
      content: 'Bị giới hạn bởi băng thông mạng cục bộ',
      note_type: 'hypothesis',
      source_chunk_id: null,
      created_at: '2026-11-12T11:00:00Z',
    },
    {
      id: 'note-3',
      session_id: sessionId,
      content: 'Môi trường máy chủ phân tán đa vùng',
      note_type: 'decision',
      source_chunk_id: null,
      created_at: '2026-11-12T12:00:00Z',
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    mockedListResearchNotes.mockResolvedValue({ data: mockNotes, meta: { total: 3 } })
  })

  it('1. hiển thị nút/mục "Dùng insight từ Sổ tay" trong giao diện IntakeForm', async () => {
    renderWithClient(<IntakeForm sessionId={sessionId} />)

    const trigger = await screen.findByRole('button', { name: /Dùng insight từ Sổ tay/i })
    expect(trigger).toBeInTheDocument()
  })

  it('2. áp dụng insight vào trường "want" và tự động tái tính toán câu phát biểu theo composeConflictStatement', async () => {
    renderWithClient(<IntakeForm sessionId={sessionId} />)

    const trigger = await screen.findByRole('button', { name: /Dùng insight từ Sổ tay/i })
    fireEvent.click(trigger)

    const useButtons = await screen.findAllByRole('button', { name: /Dùng insight này/i })
    fireEvent.click(useButtons[0]) // Note 1: Tăng tốc độ xử lý dữ liệu lên 10 lần

    const applyBtn = screen.getByRole('button', { name: /Áp dụng/i })
    fireEvent.click(applyBtn)

    // Want textarea has updated value
    const wantTextarea = screen.getByPlaceholderText(/Bạn muốn đạt được điều gì/i) as HTMLTextAreaElement
    expect(wantTextarea.value).toContain('Tăng tốc độ xử lý dữ liệu lên 10 lần')

    // Form goal has composed statement
    const goalTextarea = screen.getByLabelText(/Mô tả bài toán /i) as HTMLTextAreaElement
    expect(goalTextarea.value).toContain('Muốn Tăng tốc độ xử lý dữ liệu lên 10 lần')

    // Không tự động gọi API
    expect(mockedCreateProblemFrame).not.toHaveBeenCalled()
    expect(mockedAnalyzeProblemWithAI).not.toHaveBeenCalled()
  })

  it('3. áp dụng insight vào trường "obstacle" và tự động tái tính toán câu phát biểu', async () => {
    renderWithClient(<IntakeForm sessionId={sessionId} />)

    const trigger = await screen.findByRole('button', { name: /Dùng insight từ Sổ tay/i })
    fireEvent.click(trigger)

    const useButtons = await screen.findAllByRole('button', { name: /Dùng insight này/i })
    fireEvent.click(useButtons[1]) // Note 2: Bị giới hạn bởi băng thông mạng cục bộ

    const targetSelect = screen.getByLabelText(/Trường đích/i)
    fireEvent.change(targetSelect, { target: { value: 'obstacle' } })

    const applyBtn = screen.getByRole('button', { name: /Áp dụng/i })
    fireEvent.click(applyBtn)

    const obstacleInput = screen.getByLabelText(/Nhưng lại bị vướng/i) as HTMLInputElement
    expect(obstacleInput.value).toContain('Bị giới hạn bởi băng thông mạng cục bộ')

    const goalTextarea = screen.getByLabelText(/Mô tả bài toán /i) as HTMLTextAreaElement
    expect(goalTextarea.value).toContain('Bị giới hạn bởi băng thông mạng cục bộ')

    expect(mockedCreateProblemFrame).not.toHaveBeenCalled()
  })

  it('4. áp dụng insight vào trường "context" và tự động tái tính toán câu phát biểu', async () => {
    renderWithClient(<IntakeForm sessionId={sessionId} />)

    const trigger = await screen.findByRole('button', { name: /Dùng insight từ Sổ tay/i })
    fireEvent.click(trigger)

    const useButtons = await screen.findAllByRole('button', { name: /Dùng insight này/i })
    fireEvent.click(useButtons[2]) // Note 3: Môi trường máy chủ phân tán đa vùng

    const targetSelect = screen.getByLabelText(/Trường đích/i)
    fireEvent.change(targetSelect, { target: { value: 'context' } })

    const applyBtn = screen.getByRole('button', { name: /Áp dụng/i })
    fireEvent.click(applyBtn)

    // Context input được cập nhật đúng
    const contextInput = screen.getByLabelText(/Bối cảnh \/ ràng buộc/i) as HTMLInputElement
    expect(contextInput.value).toContain('Môi trường máy chủ phân tán đa vùng')

    // Khi want và obstacle đều rỗng, áp dụng context không làm thay đổi form.goal (bảo toàn behavior cũ)
    const goalTextarea = screen.getByLabelText(/Mô tả bài toán /i) as HTMLTextAreaElement
    expect(goalTextarea.value).toBe('')

    // Khi có want/obstacle, context được nối vào câu phát biểu theo đúng behavior cũ
    const wantInput = screen.getByLabelText(/Điều tôi muốn đạt được/i) as HTMLInputElement
    fireEvent.change(wantInput, { target: { value: 'Tối ưu hóa hiệu năng hệ thống' } })
    expect(goalTextarea.value).toBe('Muốn Tối ưu hóa hiệu năng hệ thống. Bối cảnh thực tế: Môi trường máy chủ phân tán đa vùng')

    expect(mockedCreateProblemFrame).not.toHaveBeenCalled()
    expect(mockedAnalyzeProblemWithAI).not.toHaveBeenCalled()
  })

  it('5. áp dụng insight vào trường "goal" trực tiếp mà không thay đổi want, obstacle, context', async () => {
    renderWithClient(<IntakeForm sessionId={sessionId} />)

    const trigger = await screen.findByRole('button', { name: /Dùng insight từ Sổ tay/i })
    fireEvent.click(trigger)

    const useButtons = await screen.findAllByRole('button', { name: /Dùng insight này/i })
    fireEvent.click(useButtons[0])

    const targetSelect = screen.getByLabelText(/Trường đích/i)
    fireEvent.change(targetSelect, { target: { value: 'goal' } })

    const applyBtn = screen.getByRole('button', { name: /Áp dụng/i })
    fireEvent.click(applyBtn)

    const goalTextarea = screen.getByLabelText(/Mô tả bài toán /i) as HTMLTextAreaElement
    expect(goalTextarea.value).toBe('Tăng tốc độ xử lý dữ liệu lên 10 lần')

    // want, obstacle, context remains unchanged
    const wantInput = screen.getByLabelText(/Điều tôi muốn đạt được/i) as HTMLInputElement
    expect(wantInput.value).toBe('')
  })
})
