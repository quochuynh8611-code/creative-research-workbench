/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntakeForm } from '../intake-form'
import * as apiClientModule from '@/lib/api-client'
import type { AIProblemAnalysisResponse, ProblemFrame } from '@/lib/types'


// Mock api-client
jest.mock('@/lib/api-client', () => {
  const original = jest.requireActual('@/lib/api-client')
  return {
    ...original,
    createProblemFrame: jest.fn(),
    analyzeProblemWithAI: jest.fn(),
  }
})

const mockedCreateProblemFrame = apiClientModule.createProblemFrame as jest.MockedFunction<
  typeof apiClientModule.createProblemFrame
>
const mockedAnalyzeProblemWithAI = apiClientModule.analyzeProblemWithAI as jest.MockedFunction<
  any
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

describe('IntakeForm Component — Phase 6.2 AI Problem Structuring UI', () => {
  const sessionId = 'test-session-602'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  // Scenario 2.1: Vị trí và điều kiện kích hoạt nút AI Suggestion
  it('Scenario 2.1: Nút "Gợi ý với AI" bị disabled khi < 10 ký tự và enabled khi >= 10 ký tự', () => {
    renderWithClient(<IntakeForm sessionId={sessionId} />)

    // Nút "Gợi ý với AI" phải có mặt trên giao diện
    const aiButton = screen.getByRole('button', { name: /Gợi ý với AI/i })
    expect(aiButton).toBeInTheDocument()
    expect(aiButton).toBeDisabled()

    // Gõ 5 ký tự (< 10)
    const textarea = screen.getByPlaceholderText(/Bạn muốn đạt được điều gì/i)
    fireEvent.change(textarea, { target: { value: 'Robot' } })
    expect(aiButton).toBeDisabled()

    // Gõ >= 10 ký tự
    fireEvent.change(textarea, {
      target: { value: 'Cánh tay robot cần tăng tải trọng nhưng giảm rung lắc khi quay' },
    })
    expect(aiButton).toBeEnabled()
  })

  // Scenario 2.2: Trạng thái Loading khi đang phân tích AI
  it('Scenario 2.2: Hiển thị trạng thái loading và khóa nút khi đang phân tích AI', async () => {
    let resolveAnalysis: (val: any) => void
    const pendingPromise = new Promise((resolve) => {
      resolveAnalysis = resolve
    })
    mockedAnalyzeProblemWithAI.mockReturnValueOnce(pendingPromise)

    renderWithClient(<IntakeForm sessionId={sessionId} />)

    const textarea = screen.getByPlaceholderText(/Bạn muốn đạt được điều gì/i)
    fireEvent.change(textarea, {
      target: { value: 'Cánh tay robot cần tăng tải trọng nhưng giảm rung lắc khi quay' },
    })

    const aiButton = screen.getByRole('button', { name: /Gợi ý với AI/i })
    fireEvent.click(aiButton)

    // Nút chuyển sang trạng thái loading
    expect(screen.getByText(/Đang phân tích/i)).toBeInTheDocument()
    expect(aiButton).toBeDisabled()

    // Resolve promise
    resolveAnalysis!({
      data: {
        normalized_statement: 'Tối ưu hóa tải trọng cánh tay robot trong giới hạn ổn định động học',
        domain: null,
        contradiction_type: 'technical',
        improving_parameter: 'load_capacity',
        worsening_parameter: 'stability',
        suggested_keywords: ['damping', 'carbon fiber'],
        reasoning: 'Mâu thuẫn giữa tải trọng và độ ổn định',
      },
      _meta: {
        provenance: 'ai_hypothesis',
        provider: 'openai',
        model: 'gpt-4o-mini',
        prompt_version: '2026-10-01.v1',
        latency_ms: 200,
        fallback_reason: null,
      },
    })

    await waitFor(() => {
      expect(screen.queryByText(/Đang phân tích/i)).not.toBeInTheDocument()
    })
  })

  // Scenario 2.3: Render Ephemeral Suggestion Card khi AI thành công (ai_hypothesis)
  it('Scenario 2.3: Render Ephemeral Suggestion Card với badge AI Hypothesis và read-only keywords', async () => {
    const aiResponse: AIProblemAnalysisResponse = {
      data: {
        normalized_statement: 'Tối ưu hóa tốc độ xử lý dữ liệu trong giới hạn phát nhiệt CPU',
        domain: 'computing',
        contradiction_type: 'technical',
        improving_parameter: 'speed',
        worsening_parameter: 'temperature',
        suggested_keywords: ['thermal throttling', 'heat pipe'],
        reasoning: 'Mâu thuẫn giữa tốc độ tính toán và nhiệt lượng sinh ra',
      },
      _meta: {
        provenance: 'ai_hypothesis',
        provider: 'openai',
        model: 'gpt-4o-mini',
        prompt_version: '2026-10-01.v1',
        latency_ms: 310,
        fallback_reason: null,
      },
    }
    mockedAnalyzeProblemWithAI.mockResolvedValueOnce(aiResponse)

    renderWithClient(<IntakeForm sessionId={sessionId} />)

    const textarea = screen.getByPlaceholderText(/Bạn muốn đạt được điều gì/i)
    fireEvent.change(textarea, {
      target: { value: 'Tăng tốc độ xử lý CPU mà không làm quá nhiệt' },
    })

    const aiButton = screen.getByRole('button', { name: /Gợi ý với AI/i })
    fireEvent.click(aiButton)

    await waitFor(() => {
      expect(screen.getByText(/Gợi ý AI/i)).toBeInTheDocument()
      expect(
        screen.getByText('Tối ưu hóa tốc độ xử lý dữ liệu trong giới hạn phát nhiệt CPU')
      ).toBeInTheDocument()
      expect(screen.getByText(/thermal throttling/i)).toBeInTheDocument()
      expect(screen.getByText(/heat pipe/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Áp dụng gợi ý/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Bỏ qua/i })).toBeInTheDocument()
    })
  })

  // Scenario 2.4: Render Ephemeral Suggestion Card khi Fallback (rule_based_fallback)
  it('Scenario 2.4: Render Ephemeral Suggestion Card với badge Rule-based Fallback', async () => {
    const fallbackResponse: AIProblemAnalysisResponse = {
      data: {
        normalized_statement: 'Độ cứng bề mặt vs Độ giảm chấn',
        domain: null,
        contradiction_type: 'technical',
        improving_parameter: 'strength',
        worsening_parameter: 'vibration',
        suggested_keywords: [],
        reasoning: 'Trích xuất từ ma trận từ khóa quy tắc',
      },
      _meta: {
        provenance: 'rule_based_fallback',
        provider: 'rule_based',
        model: 'triz_rules_v1',
        prompt_version: 'none',
        latency_ms: 10,
        fallback_reason: 'llm_api_key_missing',
      },
    }
    mockedAnalyzeProblemWithAI.mockResolvedValueOnce(fallbackResponse)

    renderWithClient(<IntakeForm sessionId={sessionId} />)

    const textarea = screen.getByPlaceholderText(/Bạn muốn đạt được điều gì/i)
    fireEvent.change(textarea, {
      target: { value: 'Bánh răng cần cứng để chịu lực nhưng mềm để giảm rung' },
    })

    const aiButton = screen.getByRole('button', { name: /Gợi ý với AI/i })
    fireEvent.click(aiButton)

    await waitFor(() => {
      expect(screen.getByText(/Rule-based \(Fallback\)/i)).toBeInTheDocument()
      expect(screen.getByText('Độ cứng bề mặt vs Độ giảm chấn')).toBeInTheDocument()
    })
  })

  // Scenario 2.5: Người dùng áp dụng gợi ý (Apply Suggestion — Local State Only)
  it('Scenario 2.5: "Áp dụng gợi ý" thay thế toàn bộ ô Mục tiêu bằng normalized_statement, đóng card và KHÔNG gọi API persist', async () => {
    const aiResponse: AIProblemAnalysisResponse = {
      data: {
        normalized_statement: 'Chuẩn hóa: Tăng tốc độ quay và kiểm soát nhiệt độ',
        domain: 'mechanical',
        contradiction_type: 'technical',
        improving_parameter: 'speed',
        worsening_parameter: 'temperature',
        suggested_keywords: [],
        reasoning: 'Gợi ý chuẩn hóa từ AI',
      },
      _meta: {
        provenance: 'ai_hypothesis',
        provider: 'openai',
        model: 'gpt-4o-mini',
        prompt_version: '2026-10-01.v1',
        latency_ms: 150,
        fallback_reason: null,
      },
    }
    mockedAnalyzeProblemWithAI.mockResolvedValueOnce(aiResponse)

    renderWithClient(<IntakeForm sessionId={sessionId} />)

    const textarea = screen.getByPlaceholderText(/Bạn muốn đạt được điều gì/i) as HTMLTextAreaElement
    fireEvent.change(textarea, {
      target: { value: 'Câu mô tả ban đầu của người dùng gõ vào đây' },
    })

    const aiButton = screen.getByRole('button', { name: /Gợi ý với AI/i })
    fireEvent.click(aiButton)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Áp dụng gợi ý/i })).toBeInTheDocument()
    })

    const applyButton = screen.getByRole('button', { name: /Áp dụng gợi ý/i })
    fireEvent.click(applyButton)

    // Ô Mục tiêu được thay thế bằng normalized_statement
    expect(textarea.value).toBe('Chuẩn hóa: Tăng tốc độ quay và kiểm soát nhiệt độ')

    // Card gợi ý biến mất
    expect(screen.queryByRole('button', { name: /Áp dụng gợi ý/i })).not.toBeInTheDocument()

    // KHÔNG gọi createProblemFrame
    expect(mockedCreateProblemFrame).not.toHaveBeenCalled()
  })

  // Scenario 2.6: Người dùng bỏ qua gợi ý (Discard Suggestion)
  it('Scenario 2.6: "Bỏ qua" đóng card gợi ý và giữ nguyên 100% nội dung form', async () => {
    const aiResponse: AIProblemAnalysisResponse = {
      data: {
        normalized_statement: 'Gợi ý không mong muốn từ AI',
        domain: null,
        contradiction_type: 'technical',
        improving_parameter: null,
        worsening_parameter: null,
        suggested_keywords: [],
        reasoning: 'Reasoning',
      },
      _meta: {
        provenance: 'ai_hypothesis',
        provider: 'openai',
        model: 'gpt-4o-mini',
        prompt_version: '2026-10-01.v1',
        latency_ms: 150,
        fallback_reason: null,
      },
    }
    mockedAnalyzeProblemWithAI.mockResolvedValueOnce(aiResponse)

    renderWithClient(<IntakeForm sessionId={sessionId} />)

    const textarea = screen.getByPlaceholderText(/Bạn muốn đạt được điều gì/i) as HTMLTextAreaElement
    const initialText = 'Nội dung nguyên bản người dùng muốn giữ'
    fireEvent.change(textarea, { target: { value: initialText } })

    const aiButton = screen.getByRole('button', { name: /Gợi ý với AI/i })
    fireEvent.click(aiButton)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Bỏ qua/i })).toBeInTheDocument()
    })

    const discardButton = screen.getByRole('button', { name: /Bỏ qua/i })
    fireEvent.click(discardButton)

    // Card gợi ý đóng lại
    expect(screen.queryByRole('button', { name: /Bỏ qua/i })).not.toBeInTheDocument()

    // Textarea giữ nguyên giá trị ban đầu
    expect(textarea.value).toBe(initialText)

    // KHÔNG gọi createProblemFrame
    expect(mockedCreateProblemFrame).not.toHaveBeenCalled()
  })

  // Scenario 2.7: Xử lý lỗi API khi gọi AI (Error Resilience)
  it('Scenario 2.7: Hiển thị thông báo lỗi inline khi API phân tích AI thất bại, không mất dữ liệu form', async () => {
    mockedAnalyzeProblemWithAI.mockRejectedValueOnce({
      response: { data: { detail: 'LLM Service Timeout' } },
    })

    renderWithClient(<IntakeForm sessionId={sessionId} />)

    const textarea = screen.getByPlaceholderText(/Bạn muốn đạt được điều gì/i) as HTMLTextAreaElement
    const initialText = 'Mô tả bài toán khi có lỗi mạng'
    fireEvent.change(textarea, { target: { value: initialText } })

    const aiButton = screen.getByRole('button', { name: /Gợi ý với AI/i })
    fireEvent.click(aiButton)

    await waitFor(() => {
      expect(screen.getByText(/LLM Service Timeout/i)).toBeInTheDocument()
    })

    // Dữ liệu form không bị mất
    expect(textarea.value).toBe(initialText)

    // Nút AI và nút Lưu được mở lại
    expect(aiButton).toBeEnabled()
  })

  // Scenario 2.8: Đảm bảo AI Trust Contract (No-Auto-Persist Guarantee)
  it('Scenario 2.8: Không bao giờ auto-persist vào DB cho đến khi người dùng chủ động bấm Lưu form', async () => {
    const aiResponse: AIProblemAnalysisResponse = {
      data: {
        normalized_statement: 'Normalized Statement',
        domain: null,
        contradiction_type: 'technical',
        improving_parameter: 'speed',
        worsening_parameter: 'weight',
        suggested_keywords: [],
        reasoning: 'Reasoning',
      },
      _meta: {
        provenance: 'ai_hypothesis',
        provider: 'openai',
        model: 'gpt-4o-mini',
        prompt_version: '2026-10-01.v1',
        latency_ms: 100,
        fallback_reason: null,
      },
    }
    mockedAnalyzeProblemWithAI.mockResolvedValue(aiResponse)
    const mockProblemFrame: ProblemFrame = {
      id: 'pf-101',
      session_id: sessionId,
      raw_statement: 'Normalized Statement',
      normalized_statement: 'speed vs weight',
      contradiction_type: 'technical',
      improving_parameter: 'speed',
      worsening_parameter: 'weight',
      domain: null,
      created_at: '2026-10-02T10:00:00Z',
    }
    mockedCreateProblemFrame.mockResolvedValueOnce(mockProblemFrame)

    const onCreated = jest.fn()
    renderWithClient(<IntakeForm sessionId={sessionId} onProblemFrameCreated={onCreated} />)

    const textarea = screen.getByPlaceholderText(/Bạn muốn đạt được điều gì/i)
    fireEvent.change(textarea, { target: { value: 'Mô tả bài toán kiểm tra auto persist' } })

    const aiButton = screen.getByRole('button', { name: /Gợi ý với AI/i })
    fireEvent.click(aiButton)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Áp dụng gợi ý/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Áp dụng gợi ý/i }))

    // Đến lúc này vẫn CHƯA được gọi createProblemFrame
    expect(mockedCreateProblemFrame).not.toHaveBeenCalled()
    expect(onCreated).not.toHaveBeenCalled()

    // Chỉ khi bấm nút Lưu form chính thì mới gửi createProblemFrame
    const submitButton = screen.getByRole('button', {
      name: /Lưu và chuyển sang Phân tích cấu trúc/i,
    })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockedCreateProblemFrame).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          raw_statement: 'Normalized Statement',
        })
      )
      expect(onCreated).toHaveBeenCalledWith(mockProblemFrame)
    })
  })
})
