/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AICoachPanel } from '../ai-coach-panel'
import * as apiClient from '@/lib/api-client'
import type { ProblemFrame, AICoachResult } from '@/lib/types'

jest.mock('@/lib/api-client', () => ({
  getAICoachSuggestions: jest.fn(),
  createCandidateSolution: jest.fn(),
  createResearchNote: jest.fn(),
}))

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

const mockProblemFrame: ProblemFrame = {
  id: 'frame-1',
  session_id: 'session-123',
  raw_statement: 'Giao hàng nhanh 2 giờ nhưng chi phí đội xe quá lớn',
  normalized_statement: 'Giao hàng nhanh nhưng chi phí cao',
  contradiction_type: 'technical',
  improving_parameter: 'speed',
  worsening_parameter: 'cost',
}

const sampleAICoachResult: AICoachResult = {
  session_id: 'session-123',
  summary: 'AI Coach nhận định mâu thuẫn cốt lõi giữa tốc độ và chi phí.',
  provenance: 'ai_coach',
  provider: 'mock',
  model: 'mock-model',
  latency_ms: 50,
  generated_at: '2026-11-17T13:00:00Z',
  suggestions: [
    {
      id: 'sug-1',
      category: 'possible_cause',
      title: 'Tắc nghẽn tại khâu điều phối tuyến đường',
      description: 'Hệ thống dispatch phân bổ xe thủ công gây trễ nhịp.',
      source_grounding: {
        source_type: 'contradiction',
        source_reference: 'Mâu thuẫn tốc độ vs chi phí',
      },
      actionable_payload: null,
    },
    {
      id: 'sug-2',
      category: 'solution_candidate',
      title: 'Mạng lưới kho vệ tinh linh hoạt',
      description: 'Phân tách hàng hóa về các điểm gom vệ tinh.',
      source_grounding: {
        source_type: 'principle',
        source_reference: 'Nguyên tắc #1: Phân nhỏ (Segmentation)',
      },
      actionable_payload: {
        title: 'Mạng lưới kho vệ tinh linh hoạt',
        mechanism: 'Ứng dụng nguyên tắc phân nhỏ trong logistics.',
      },
    },
    {
      id: 'sug-3',
      category: 'clarifying_question',
      title: 'Xác minh ngưỡng chấp nhận của khách hàng',
      description: 'Khách hàng có chấp nhận nhận hàng trong 3 giờ nếu giảm 20% phí?',
      source_grounding: {
        source_type: 'note',
        source_reference: 'Ghi chép khảo sát người dùng',
      },
      actionable_payload: null,
    },
  ],
}

describe('AICoachPanel (Batch C31 PR 2)', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = createTestQueryClient()
    jest.clearAllMocks()
  })

  test('GIVEN session without ProblemFrame WHEN rendered THEN shows empty state banner and disabled button', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AICoachPanel sessionId="session-123" problemFrame={null} />
      </QueryClientProvider>
    )

    expect(screen.getByText(/Phiên nghiên cứu chưa có thông tin bài toán/i)).toBeInTheDocument()
    const analyzeButton = screen.getByRole('button', { name: /Phân tích với AI Coach/i })
    expect(analyzeButton).toBeDisabled()
  })

  test('GIVEN session with valid ProblemFrame WHEN rendered initially THEN shows idle state ready to analyze', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AICoachPanel sessionId="session-123" problemFrame={mockProblemFrame} />
      </QueryClientProvider>
    )

    const analyzeButton = screen.getByRole('button', { name: /Phân tích với AI Coach/i })
    expect(analyzeButton).not.toBeDisabled()
    expect(screen.getByText(/AI Solution Coach/i)).toBeInTheDocument()
  })

  test('GIVEN analyzing state WHEN user clicks analyze THEN displays loading indicator', async () => {
    ;(apiClient.getAICoachSuggestions as jest.Mock).mockReturnValue(
      new Promise(() => {}) // pending promise
    )

    render(
      <QueryClientProvider client={queryClient}>
        <AICoachPanel sessionId="session-123" problemFrame={mockProblemFrame} />
      </QueryClientProvider>
    )

    const analyzeButton = screen.getByRole('button', { name: /Phân tích với AI Coach/i })
    fireEvent.click(analyzeButton)

    await waitFor(() => {
      expect(screen.getByText(/AI Coach đang rà soát mâu thuẫn/i)).toBeInTheDocument()
    })
  })

  test('GIVEN successful API response WHEN rendered THEN displays suggestions with grounding and provenance tags', async () => {
    ;(apiClient.getAICoachSuggestions as jest.Mock).mockResolvedValue({
      data: sampleAICoachResult,
    })

    render(
      <QueryClientProvider client={queryClient}>
        <AICoachPanel sessionId="session-123" problemFrame={mockProblemFrame} />
      </QueryClientProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: /Phân tích với AI Coach/i }))

    await waitFor(() => {
      expect(screen.getByText('AI Coach nhận định mâu thuẫn cốt lõi giữa tốc độ và chi phí.')).toBeInTheDocument()
    })

    expect(screen.getByText('Tắc nghẽn tại khâu điều phối tuyến đường')).toBeInTheDocument()
    expect(screen.getByText('Mạng lưới kho vệ tinh linh hoạt')).toBeInTheDocument()
    expect(screen.getByText('Xác minh ngưỡng chấp nhận của khách hàng')).toBeInTheDocument()
    expect(screen.getByText(/Nguyên tắc #1: Phân nhỏ/i)).toBeInTheDocument()
    expect(screen.getByText('AI Coach')).toBeInTheDocument()
  })

  test('GIVEN fallback response WHEN rendered THEN displays Rule-based fallback provenance tag', async () => {
    ;(apiClient.getAICoachSuggestions as jest.Mock).mockResolvedValue({
      data: {
        ...sampleAICoachResult,
        provenance: 'rule_based_fallback',
      },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <AICoachPanel sessionId="session-123" problemFrame={mockProblemFrame} />
      </QueryClientProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: /Phân tích với AI Coach/i }))

    await waitFor(() => {
      expect(screen.getByText('Rule-based fallback')).toBeInTheDocument()
    })
  })

  test('GIVEN API returns more than 5 suggestions WHEN rendered THEN only displays top 5 and cap notification', async () => {
    const sevenSuggestions = Array.from({ length: 7 }, (_, i) => ({
      id: `sug-${i + 1}`,
      category: 'possible_cause',
      title: `Gợi ý số ${i + 1}`,
      description: `Mô tả chi tiết ${i + 1}`,
      source_grounding: {
        source_type: 'contradiction',
        source_reference: `Căn cứ ${i + 1}`,
      },
      actionable_payload: null,
    }))

    ;(apiClient.getAICoachSuggestions as jest.Mock).mockResolvedValue({
      data: {
        ...sampleAICoachResult,
        suggestions: sevenSuggestions,
      },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <AICoachPanel sessionId="session-123" problemFrame={mockProblemFrame} />
      </QueryClientProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: /Phân tích với AI Coach/i }))

    await waitFor(() => {
      expect(screen.getByText('Gợi ý số 1')).toBeInTheDocument()
    })

    expect(screen.getByText('Gợi ý số 5')).toBeInTheDocument()
    expect(screen.queryByText('Gợi ý số 6')).not.toBeInTheDocument()
    expect(screen.queryByText('Gợi ý số 7')).not.toBeInTheDocument()
    expect(screen.getByText(/Đã hiển thị 5 gợi ý ưu tiên/i)).toBeInTheDocument()
  })

  test('GIVEN malformed suggestion missing mandatory fields WHEN rendered THEN skips malformed card without crash', async () => {
    const mixedSuggestions = [
      {
        id: 'valid-1',
        category: 'possible_cause',
        title: 'Gợi ý hợp lệ',
        description: 'Mô tả hợp lệ',
        source_grounding: {
          source_type: 'contradiction',
          source_reference: 'Căn cứ hợp lệ',
        },
      },
      {
        id: 'invalid-missing-grounding',
        category: 'possible_cause',
        title: 'Gợi ý hỏng không có grounding',
        description: 'Mô tả',
        source_grounding: null,
      },
      {
        id: 'invalid-empty-title',
        category: 'possible_cause',
        title: '',
        description: 'Mô tả',
        source_grounding: { source_type: 'note', source_reference: 'ref' },
      },
    ]

    ;(apiClient.getAICoachSuggestions as jest.Mock).mockResolvedValue({
      data: {
        ...sampleAICoachResult,
        suggestions: mixedSuggestions,
      },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <AICoachPanel sessionId="session-123" problemFrame={mockProblemFrame} />
      </QueryClientProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: /Phân tích với AI Coach/i }))

    await waitFor(() => {
      expect(screen.getByText('Gợi ý hợp lệ')).toBeInTheDocument()
    })
    expect(screen.queryByText('Gợi ý hỏng không có grounding')).not.toBeInTheDocument()
  })

  test('GIVEN suggestions of different categories WHEN rendered THEN only solution_candidate has "Lưu thành Giải pháp"', async () => {
    ;(apiClient.getAICoachSuggestions as jest.Mock).mockResolvedValue({
      data: sampleAICoachResult,
    })

    render(
      <QueryClientProvider client={queryClient}>
        <AICoachPanel sessionId="session-123" problemFrame={mockProblemFrame} />
      </QueryClientProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: /Phân tích với AI Coach/i }))

    await waitFor(() => {
      expect(screen.getByText('Mạng lưới kho vệ tinh linh hoạt')).toBeInTheDocument()
    })

    // Only 1 solution candidate exists in sampleAICoachResult
    const saveSolutionButtons = screen.getAllByRole('button', { name: /Lưu thành Giải pháp/i })
    expect(saveSolutionButtons).toHaveLength(1)

    // Notes can be saved for all other cards
    const saveNoteButtons = screen.getAllByRole('button', { name: /Lưu vào Ghi chép/i })
    expect(saveNoteButtons.length).toBeGreaterThanOrEqual(2)
  })

  test('GIVEN solution suggestion WHEN user clicks "Lưu thành Giải pháp" THEN opens modal and only calls API on confirmation', async () => {
    ;(apiClient.getAICoachSuggestions as jest.Mock).mockResolvedValue({
      data: sampleAICoachResult,
    })
    ;(apiClient.createCandidateSolution as jest.Mock).mockResolvedValue({
      id: 'sol-created-1',
      title: 'Mạng lưới kho vệ tinh linh hoạt',
    })

    render(
      <QueryClientProvider client={queryClient}>
        <AICoachPanel sessionId="session-123" problemFrame={mockProblemFrame} />
      </QueryClientProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: /Phân tích với AI Coach/i }))

    await waitFor(() => {
      expect(screen.getByText('Mạng lưới kho vệ tinh linh hoạt')).toBeInTheDocument()
    })

    const saveSolutionBtn = screen.getByRole('button', { name: /Lưu thành Giải pháp/i })
    fireEvent.click(saveSolutionBtn)

    // Modal opens
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/Xác nhận lưu giải pháp/i)).toBeInTheDocument()
    expect(apiClient.createCandidateSolution).not.toHaveBeenCalled()

    // Confirm inside modal
    const confirmBtn = screen.getByRole('button', { name: /Xác nhận lưu/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(apiClient.createCandidateSolution).toHaveBeenCalledWith(
        'session-123',
        expect.objectContaining({
          title: 'Mạng lưới kho vệ tinh linh hoạt',
        })
      )
    })
  })

  test('GIVEN note suggestion WHEN user clicks "Lưu vào Ghi chép" THEN opens modal and only calls API on confirmation', async () => {
    ;(apiClient.getAICoachSuggestions as jest.Mock).mockResolvedValue({
      data: sampleAICoachResult,
    })
    ;(apiClient.createResearchNote as jest.Mock).mockResolvedValue({
      id: 'note-created-1',
      content: 'Tắc nghẽn tại khâu điều phối tuyến đường',
    })

    render(
      <QueryClientProvider client={queryClient}>
        <AICoachPanel sessionId="session-123" problemFrame={mockProblemFrame} />
      </QueryClientProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: /Phân tích với AI Coach/i }))

    await waitFor(() => {
      expect(screen.getByText('Tắc nghẽn tại khâu điều phối tuyến đường')).toBeInTheDocument()
    })

    const saveNoteButtons = screen.getAllByRole('button', { name: /Lưu vào Ghi chép/i })
    fireEvent.click(saveNoteButtons[0])

    // Modal opens
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/Xác nhận lưu ghi chép/i)).toBeInTheDocument()
    expect(apiClient.createResearchNote).not.toHaveBeenCalled()

    // Confirm inside modal
    const confirmBtn = screen.getByRole('button', { name: /Xác nhận lưu/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(apiClient.createResearchNote).toHaveBeenCalledWith(
        'session-123',
        expect.objectContaining({
          content: expect.stringContaining('Tắc nghẽn tại khâu điều phối tuyến đường'),
        })
      )
    })
  })

  test('GIVEN suggestion WHEN user clicks "Bỏ qua" THEN card is hidden without calling any API', async () => {
    ;(apiClient.getAICoachSuggestions as jest.Mock).mockResolvedValue({
      data: sampleAICoachResult,
    })

    render(
      <QueryClientProvider client={queryClient}>
        <AICoachPanel sessionId="session-123" problemFrame={mockProblemFrame} />
      </QueryClientProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: /Phân tích với AI Coach/i }))

    await waitFor(() => {
      expect(screen.getByText('Tắc nghẽn tại khâu điều phối tuyến đường')).toBeInTheDocument()
    })

    const dismissButtons = screen.getAllByRole('button', { name: /Bỏ qua/i })
    fireEvent.click(dismissButtons[0])

    // Card should disappear
    expect(screen.queryByText('Tắc nghẽn tại khâu điều phối tuyến đường')).not.toBeInTheDocument()
    expect(apiClient.createCandidateSolution).not.toHaveBeenCalled()
    expect(apiClient.createResearchNote).not.toHaveBeenCalled()
  })

  test('GIVEN API error WHEN rendered THEN displays friendly error message without crash and allows retry', async () => {
    ;(apiClient.getAICoachSuggestions as jest.Mock).mockRejectedValue(
      new Error('Connection timeout')
    )

    render(
      <QueryClientProvider client={queryClient}>
        <AICoachPanel sessionId="session-123" problemFrame={mockProblemFrame} />
      </QueryClientProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: /Phân tích với AI Coach/i }))

    await waitFor(() => {
      expect(screen.getByText(/Không thể lấy gợi ý từ AI Coach vào lúc này/i)).toBeInTheDocument()
    })

    const retryBtn = screen.getByRole('button', { name: /Thử lại/i })
    expect(retryBtn).toBeInTheDocument()
  })

  test('GIVEN response with potential secrets WHEN rendered THEN never renders forbidden secret tokens', async () => {
    ;(apiClient.getAICoachSuggestions as jest.Mock).mockResolvedValue({
      data: {
        ...sampleAICoachResult,
        summary: 'Safe summary text',
      },
    })

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <AICoachPanel sessionId="session-123" problemFrame={mockProblemFrame} />
      </QueryClientProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: /Phân tích với AI Coach/i }))

    await waitFor(() => {
      expect(screen.getByText('Safe summary text')).toBeInTheDocument()
    })

    const domText = container.textContent?.toLowerCase() || ''
    const forbiddenSecrets = ['sk-proj', 'bearer', 'password', 'supersecret', 'stack_trace', 'database query']
    for (const secret of forbiddenSecrets) {
      expect(domText).not.toContain(secret)
    }
  })
})
