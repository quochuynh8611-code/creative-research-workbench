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

  // ──────────────────────────────────────────────
  // Intake Upgrade: Khung "Muốn... Nhưng..." & Quick Examples
  // ──────────────────────────────────────────────
  it('Scenario 3.1: Nhập vào khung "Muốn... Nhưng..." tự động ghép thành câu bài toán và gửi API khi submit', async () => {
    mockedCreateProblemFrame.mockResolvedValueOnce({
      id: 'frame-test-01',
      session_id: sessionId,
      raw_statement: 'Muốn nấu ăn tại nhà đủ chất dinh dưỡng nhưng lại bị vướng đi làm về muộn và ít thời gian sơ chế. Bối cảnh thực tế: Ngân sách gia đình tiết kiệm',
      contradiction_type: 'technical',
      improving_parameter: 'ease_of_operation',
      worsening_parameter: 'loss_of_time',
      created_at: '2026-10-01T08:00:00Z',
    })

    renderWithClient(<IntakeForm sessionId={sessionId} />)

    const wantInput = screen.getByLabelText(/Điều tôi muốn đạt được \/ cải thiện/i)
    const obstacleInput = screen.getByLabelText(/Nhưng lại bị vướng \/ lo ngại/i)
    const contextInput = screen.getByLabelText(/Bối cảnh \/ ràng buộc thực tế/i)

    fireEvent.change(wantInput, { target: { value: 'nấu ăn tại nhà đủ chất dinh dưỡng' } })
    fireEvent.change(obstacleInput, { target: { value: 'đi làm về muộn và ít thời gian sơ chế' } })
    fireEvent.change(contextInput, { target: { value: 'Ngân sách gia đình tiết kiệm' } })

    const submitButton = screen.getByRole('button', {
      name: /Lưu và chuyển sang Phân tích cấu trúc/i,
    })
    expect(submitButton).toBeEnabled()
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockedCreateProblemFrame).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          raw_statement: expect.stringContaining('nấu ăn tại nhà đủ chất dinh dưỡng'),
        })
      )
    })
  })

  it('Scenario 3.2: Bấm nút Quick Example (Đời sống cá nhân) điền sẵn dữ liệu và cập nhật bài toán', async () => {
    renderWithClient(<IntakeForm sessionId={sessionId} />)

    const exampleBtn = screen.getByRole('button', { name: /Đời sống cá nhân/i })
    expect(exampleBtn).toBeInTheDocument()
    fireEvent.click(exampleBtn)

    const textarea = screen.getByPlaceholderText(/Bạn muốn đạt được điều gì/i) as HTMLTextAreaElement
    expect(textarea.value).toContain('Dậy sớm')
  })

  // ──────────────────────────────────────────────
  // Stage A: Intake Synchronization & Data Integrity Regression Tests
  // ──────────────────────────────────────────────
  describe('Stage A: Intake Synchronization and Data Integrity Regression Tests', () => {
    // Test A: Guided inputs → sửa textarea → lưu:
    // Assert raw_statement chính xác bằng textarea đã sửa
    it('Test A (H1 Regression): Khi người dùng sửa textarea sau khi điền Guided Inputs, submit phải gửi chính xác nội dung textarea đã sửa', async () => {
      // Given: Màn hình IntakeForm đang mở
      mockedCreateProblemFrame.mockResolvedValueOnce({
        id: 'pf-reg-a',
        session_id: sessionId,
        raw_statement: 'Thiết kế cơ chế phân đoạn luồng dữ liệu (streaming pipeline) để tối ưu bộ nhớ',
        contradiction_type: 'technical',
        created_at: '2026-10-02T10:00:00Z',
      })
      renderWithClient(<IntakeForm sessionId={sessionId} />)

      // When: Người dùng nhập vào khung "Muốn... Nhưng..."
      const wantInput = screen.getByLabelText(/Điều tôi muốn đạt được \/ cải thiện/i)
      const obstacleInput = screen.getByLabelText(/Nhưng lại bị vướng \/ lo ngại/i)
      const contextInput = screen.getByLabelText(/Bối cảnh \/ ràng buộc thực tế/i)

      fireEvent.change(wantInput, { target: { value: 'Tăng tốc độ xử lý dữ liệu lớn' } })
      fireEvent.change(obstacleInput, { target: { value: 'Bộ nhớ RAM bị tràn khi tải dữ liệu' } })
      fireEvent.change(contextInput, { target: { value: 'Môi trường máy chủ cấu hình cố định' } })

      // And: Người dùng chỉnh sửa thủ công trực tiếp trong textarea Mục tiêu
      const textarea = screen.getByPlaceholderText(/Bạn muốn đạt được điều gì/i) as HTMLTextAreaElement
      const manualEditedText = 'Thiết kế cơ chế phân đoạn luồng dữ liệu (streaming pipeline) để tối ưu bộ nhớ'
      fireEvent.change(textarea, { target: { value: manualEditedText } })

      // And: Bấm nút lưu form
      const submitButton = screen.getByRole('button', {
        name: /Lưu và chuyển sang Phân tích cấu trúc/i,
      })
      fireEvent.click(submitButton)

      // Then: API createProblemFrame phải nhận chính xác chuỗi từ textarea đã sửa, không bị câu ghép cũ từ guided inputs ghi đè
      await waitFor(() => {
        expect(mockedCreateProblemFrame).toHaveBeenCalledWith(
          sessionId,
          {
            raw_statement: manualEditedText,
          }
        )
      })
    })

    // Test B: Guided inputs → phân tích AI → áp dụng → lưu:
    // Assert chưa gọi API lưu trước submit; sau submit phải gửi câu AI đã áp dụng
    it('Test B (H2 Regression): Khi áp dụng gợi ý AI sau khi điền Guided Inputs, submit phải gửi câu chuẩn hóa AI, không gửi câu ghép cũ', async () => {
      // Given: Màn hình IntakeForm đang mở với mock AI suggestion
      const aiResponse: AIProblemAnalysisResponse = {
        data: {
          normalized_statement: 'Tối ưu hóa đối lưu nhiệt bề mặt trong giới hạn không gian vỏ động cơ',
          domain: null,
          contradiction_type: 'technical',
          improving_parameter: 'temperature',
          worsening_parameter: 'dimensions',
          suggested_keywords: ['convection', 'cooling fin'],
          reasoning: 'Mâu thuẫn giữa hiệu quả tản nhiệt và kích thước thiết bị',
        },
        _meta: {
          provenance: 'ai_hypothesis',
          provider: 'openai',
          model: 'gpt-4o-mini',
          prompt_version: '2026-10-01.v1',
          latency_ms: 120,
          fallback_reason: null,
        },
      }
      mockedAnalyzeProblemWithAI.mockResolvedValueOnce(aiResponse)
      mockedCreateProblemFrame.mockResolvedValueOnce({
        id: 'pf-reg-b',
        session_id: sessionId,
        raw_statement: 'Tối ưu hóa đối lưu nhiệt bề mặt trong giới hạn không gian vỏ động cơ',
        contradiction_type: 'technical',
        created_at: '2026-10-02T10:00:00Z',
      })

      renderWithClient(<IntakeForm sessionId={sessionId} />)

      // When: Người dùng nhập vào khung "Muốn... Nhưng..."
      const wantInput = screen.getByLabelText(/Điều tôi muốn đạt được \/ cải thiện/i)
      const obstacleInput = screen.getByLabelText(/Nhưng lại bị vướng \/ lo ngại/i)
      fireEvent.change(wantInput, { target: { value: 'Giảm nhiệt độ động cơ máy bay không người lái' } })
      fireEvent.change(obstacleInput, { target: { value: 'Không được tăng kích thước cánh tản nhiệt' } })

      // And: Bấm nút "Gợi ý với AI"
      const aiButton = screen.getByRole('button', { name: /Gợi ý với AI/i })
      fireEvent.click(aiButton)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Áp dụng gợi ý/i })).toBeInTheDocument()
      })

      // And: Bấm "Áp dụng gợi ý"
      fireEvent.click(screen.getByRole('button', { name: /Áp dụng gợi ý/i }))

      // Then: Đảm bảo no auto-persist: createProblemFrame chưa bao giờ được gọi
      expect(mockedCreateProblemFrame).not.toHaveBeenCalled()

      // When: Người dùng bấm nút lưu form chính
      const submitButton = screen.getByRole('button', {
        name: /Lưu và chuyển sang Phân tích cấu trúc/i,
      })
      fireEvent.click(submitButton)

      // Then: API createProblemFrame phải nhận chính xác câu chuẩn hóa từ AI
      await waitFor(() => {
        expect(mockedCreateProblemFrame).toHaveBeenCalledWith(
          sessionId,
          {
            raw_statement: 'Tối ưu hóa đối lưu nhiệt bề mặt trong giới hạn không gian vỏ động cơ',
          }
        )
      })
    })

    // Test C: Điền đầy đủ 4 nhóm tags → Phân tích AI rồi lưu
    // Assert hai raw_statement bằng nhau và đúng chuỗi kỳ vọng, đủ 4 nhãn/giá trị theo thứ tự format hiện có
    it('Test C (H3 Regression): Cùng trạng thái form có 4 nhóm tags, request AI và request lưu phải có cùng raw_statement đầy đủ', async () => {
      // Given: IntakeForm với goal và đầy đủ 4 nhóm tags
      const aiResponse: AIProblemAnalysisResponse = {
        data: {
          normalized_statement: 'Tối ưu hóa độ bền va chạm trong giới hạn khối lượng thân xe',
          domain: null,
          contradiction_type: 'technical',
          improving_parameter: 'strength',
          worsening_parameter: 'weight',
          suggested_keywords: [],
          reasoning: 'Lý giải',
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
      mockedAnalyzeProblemWithAI.mockResolvedValueOnce(aiResponse)
      mockedCreateProblemFrame.mockResolvedValueOnce({
        id: 'pf-reg-c',
        session_id: sessionId,
        raw_statement: '',
        contradiction_type: 'technical',
        created_at: '2026-10-02T10:00:00Z',
      })

      renderWithClient(<IntakeForm sessionId={sessionId} />)

      // Nhập goal vào textarea
      const textarea = screen.getByPlaceholderText(/Bạn muốn đạt được điều gì/i)
      fireEvent.change(textarea, { target: { value: 'Cải thiện độ cứng vững thân vỏ ô tô điện' } })

      // Thêm 4 nhóm tags
      const constraintInput = screen.getByPlaceholderText(/Ngân sách vật liệu/i)
      fireEvent.change(constraintInput, { target: { value: 'Khối lượng pin < 450kg' } })
      fireEvent.keyDown(constraintInput, { key: 'Enter', code: 'Enter' })
      fireEvent.change(constraintInput, { target: { value: 'Chi phí hợp kim < 2000 USD' } })
      fireEvent.keyDown(constraintInput, { key: 'Enter', code: 'Enter' })

      const entityInput = screen.getByPlaceholderText(/Động cơ servo/i)
      fireEvent.change(entityInput, { target: { value: 'Khung gầm hợp kim nhôm' } })
      fireEvent.keyDown(entityInput, { key: 'Enter', code: 'Enter' })
      fireEvent.change(entityInput, { target: { value: 'Khối pin Lithium-ion' } })
      fireEvent.keyDown(entityInput, { key: 'Enter', code: 'Enter' })

      const signalInput = screen.getByPlaceholderText(/Rung lắc khi quay/i)
      fireEvent.change(signalInput, { target: { value: 'Biến dạng khi va chạm bên hông' } })
      fireEvent.keyDown(signalInput, { key: 'Enter', code: 'Enter' })

      const criteriaInput = screen.getByPlaceholderText(/Tăng gia tốc/i)
      fireEvent.change(criteriaInput, { target: { value: 'Đạt chuẩn an toàn 5 sao NCAP' } })
      fireEvent.keyDown(criteriaInput, { key: 'Enter', code: 'Enter' })
      fireEvent.change(criteriaInput, { target: { value: 'Khối lượng xe giảm 8%' } })
      fireEvent.keyDown(criteriaInput, { key: 'Enter', code: 'Enter' })

      const expectedStatement =
        'Cải thiện độ cứng vững thân vỏ ô tô điện. ' +
        'Ràng buộc: Khối lượng pin < 450kg, Chi phí hợp kim < 2000 USD. ' +
        'Đối tượng: Khung gầm hợp kim nhôm, Khối pin Lithium-ion. ' +
        'Tín hiệu thất bại: Biến dạng khi va chạm bên hông. ' +
        'Tiêu chí: Đạt chuẩn an toàn 5 sao NCAP, Khối lượng xe giảm 8%'

      // When 1: Gọi phân tích AI
      const aiButton = screen.getByRole('button', { name: /Gợi ý với AI/i })
      fireEvent.click(aiButton)

      await waitFor(() => {
        expect(mockedAnalyzeProblemWithAI).toHaveBeenCalledTimes(1)
      })

      // When 2: Người dùng bấm Lưu (không thay đổi form giữa 2 thao tác)
      const submitButton = screen.getByRole('button', {
        name: /Lưu và chuyển sang Phân tích cấu trúc/i,
      })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockedCreateProblemFrame).toHaveBeenCalledTimes(1)
      })

      // Then: Cả hai request phải có cùng raw_statement và khớp đúng chuỗi format kỳ vọng
      const aiStatement = mockedAnalyzeProblemWithAI.mock.calls[0][1].raw_statement
      const saveStatement = mockedCreateProblemFrame.mock.calls[0][1].raw_statement

      expect(aiStatement).toBe(expectedStatement)
      expect(saveStatement).toBe(expectedStatement)
      expect(saveStatement).toBe(aiStatement)
    })

    // Test D: Guided inputs dài → sửa textarea thành dưới 10 ký tự:
    // Assert nút AI và nút lưu bị disabled. Không để guided inputs cũ làm validation pass
    it('Test D (Validation Regression): Khi textarea dưới 10 ký tự, nút AI và nút lưu phải bị disabled dù Guided Inputs vẫn có chữ', () => {
      // Given: Guided inputs đã được điền câu dài
      renderWithClient(<IntakeForm sessionId={sessionId} />)

      const wantInput = screen.getByLabelText(/Điều tôi muốn đạt được \/ cải thiện/i)
      const obstacleInput = screen.getByLabelText(/Nhưng lại bị vướng \/ lo ngại/i)
      fireEvent.change(wantInput, { target: { value: 'Tăng độ bền kết cấu' } })
      fireEvent.change(obstacleInput, { target: { value: 'Không được tăng trọng lượng' } })

      const aiButton = screen.getByRole('button', { name: /Gợi ý với AI/i })
      const submitButton = screen.getByRole('button', {
        name: /Lưu và chuyển sang Phân tích cấu trúc/i,
      })

      // Ban đầu cả 2 nút đang enabled vì goal được tự động điền từ guided inputs
      expect(aiButton).toBeEnabled()
      expect(submitButton).toBeEnabled()

      // When: Người dùng xóa/sửa textarea thành chuỗi ngắn dưới 10 ký tự
      const textarea = screen.getByPlaceholderText(/Bạn muốn đạt được điều gì/i)
      fireEvent.change(textarea, { target: { value: 'Ngắn' } })

      // Then: Cả nút AI và nút Lưu phải bị disabled dựa trên độ dài của textarea (form.goal.trim()), không để guided inputs cũ bypass
      expect(aiButton).toBeDisabled()
      expect(submitButton).toBeDisabled()
    })

    // Test E: Sau khi áp dụng AI, guided inputs vẫn giữ nguyên; sau đó sửa guided input và assert textarea cập nhật câu ghép mới
    it('Test E (Regression Guard): Sau khi áp dụng AI, guided inputs được giữ nguyên; nếu sửa tiếp guided input thì textarea cập nhật câu ghép mới', async () => {
      // Given: Đã điền guided inputs và nhận gợi ý AI
      const aiResponse: AIProblemAnalysisResponse = {
        data: {
          normalized_statement: 'Áp dụng lặp lại ngắt quãng SM-2 để tối ưu hóa khả năng ghi nhớ từ vựng',
          domain: null,
          contradiction_type: 'technical',
          improving_parameter: 'memory',
          worsening_parameter: 'time',
          suggested_keywords: [],
          reasoning: 'Lý giải',
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
      mockedAnalyzeProblemWithAI.mockResolvedValueOnce(aiResponse)

      renderWithClient(<IntakeForm sessionId={sessionId} />)

      const wantInput = screen.getByLabelText(/Điều tôi muốn đạt được \/ cải thiện/i) as HTMLInputElement
      const obstacleInput = screen.getByLabelText(/Nhưng lại bị vướng \/ lo ngại/i) as HTMLInputElement

      fireEvent.change(wantInput, { target: { value: 'Học thuộc 50 từ vựng mỗi ngày' } })
      fireEvent.change(obstacleInput, { target: { value: 'Hay quên sau 24 giờ' } })

      // When 1: Gọi AI và bấm "Áp dụng gợi ý"
      fireEvent.click(screen.getByRole('button', { name: /Gợi ý với AI/i }))
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Áp dụng gợi ý/i })).toBeInTheDocument()
      })
      fireEvent.click(screen.getByRole('button', { name: /Áp dụng gợi ý/i }))

      // Then 1: Textarea hiển thị gợi ý AI, nhưng 2 ô guided inputs KHÔNG bị tự động xóa trắng
      const textarea = screen.getByPlaceholderText(/Bạn muốn đạt được điều gì/i) as HTMLTextAreaElement
      expect(textarea.value).toBe('Áp dụng lặp lại ngắt quãng SM-2 để tối ưu hóa khả năng ghi nhớ từ vựng')
      expect(wantInput.value).toBe('Học thuộc 50 từ vựng mỗi ngày')
      expect(obstacleInput.value).toBe('Hay quên sau 24 giờ')

      // When 2: Người dùng sửa tiếp ô trở ngại
      fireEvent.change(obstacleInput, { target: { value: 'quá bận rộn vào buổi tối' } })

      // Then 2: Textarea tự động cập nhật câu ghép mới từ guided inputs
      expect(textarea.value).toBe(
        'Muốn Học thuộc 50 từ vựng mỗi ngày nhưng lại bị vướng quá bận rộn vào buổi tối'
      )
    })

    // Test F: initialProblemFrame → sửa textarea → lưu:
    // Assert payload đúng và giữ luồng cũ
    it('Test F (Regression Guard): Khởi tạo từ initialProblemFrame có sẵn, sửa textarea và lưu bảo toàn đúng luồng hiện có', async () => {
      // Given: Session đã có ProblemFrame từ trước
      const initialFrame: ProblemFrame = {
        id: 'pf-existing-01',
        session_id: sessionId,
        raw_statement: 'Bài toán cũ đã lưu: Giảm tiêu hao năng lượng chiller',
        contradiction_type: 'technical',
        created_at: '2026-10-01T08:00:00Z',
      }
      mockedCreateProblemFrame.mockResolvedValueOnce({
        ...initialFrame,
        raw_statement: 'Bài toán cập nhật: Giảm tiêu hao năng lượng chiller kết hợp biến tần',
      })

      // When: Render IntakeForm với initialProblemFrame
      renderWithClient(<IntakeForm sessionId={sessionId} initialProblemFrame={initialFrame} />)

      const textarea = screen.getByPlaceholderText(/Bạn muốn đạt được điều gì/i) as HTMLTextAreaElement
      expect(textarea.value).toBe('Bài toán cũ đã lưu: Giảm tiêu hao năng lượng chiller')

      // And: Sửa textarea
      const updatedText = 'Bài toán cập nhật: Giảm tiêu hao năng lượng chiller kết hợp biến tần'
      fireEvent.change(textarea, { target: { value: updatedText } })

      // And: Submit
      const submitButton = screen.getByRole('button', {
        name: /Lưu và chuyển sang Phân tích cấu trúc/i,
      })
      fireEvent.click(submitButton)

      // Then: Gửi đúng payload đã cập nhật
      await waitFor(() => {
        expect(mockedCreateProblemFrame).toHaveBeenCalledWith(
          sessionId,
          {
            raw_statement: updatedText,
          }
        )
      })
    })

    // ──────────────────────────────────────────────
    // Boundary Guards: form.goal rỗng, whitespace hoặc < 10 ký tự
    // ──────────────────────────────────────────────
    describe.each([
      { label: 'chuỗi rỗng ""', value: '' },
      { label: 'chỉ toàn khoảng trắng "   "', value: '   ' },
      { label: 'dưới 10 ký tự "Ngắn"', value: 'Ngắn' },
    ])(
      'Boundary Guard: form.goal là $label khi có Guided Inputs và Constraints dài',
      ({ value }) => {
        it('nút AI và nút lưu bị disabled, click AI và submit trực tiếp form đều bị chặn', async () => {
          // Given: Màn hình IntakeForm đang mở
          renderWithClient(<IntakeForm sessionId={sessionId} />)

          // Guided inputs có nội dung dài
          const wantInput = screen.getByLabelText(/Điều tôi muốn đạt được \/ cải thiện/i)
          const obstacleInput = screen.getByLabelText(/Nhưng lại bị vướng \/ lo ngại/i)
          fireEvent.change(wantInput, {
            target: { value: 'Tăng tốc độ xử lý dữ liệu và thông lượng hệ thống' },
          })
          fireEvent.change(obstacleInput, {
            target: { value: 'Bộ nhớ RAM bị tràn khi tải khối lượng công việc lớn' },
          })

          // Có ít nhất một constraint dài đã thêm vào tags
          const constraintInput = screen.getByPlaceholderText(/Ngân sách vật liệu/i)
          fireEvent.change(constraintInput, {
            target: { value: 'Ngân sách phần cứng không vượt quá 50 triệu VNĐ' },
          })
          fireEvent.keyDown(constraintInput, { key: 'Enter', code: 'Enter' })

          // When: Người dùng thay textarea bằng giá trị biên
          const textarea = screen.getByPlaceholderText(/Bạn muốn đạt được điều gì/i) as HTMLTextAreaElement
          fireEvent.change(textarea, { target: { value } })

          // Then 1: Nút AI và Nút Lưu đều bị disabled
          const aiButton = screen.getByRole('button', { name: /Gợi ý với AI/i })
          const submitButton = screen.getByRole('button', {
            name: /Lưu và chuyển sang Phân tích cấu trúc/i,
          })
          expect(aiButton).toBeDisabled()
          expect(submitButton).toBeDisabled()

          // Then 2: Click nút AI không gọi analyzeProblemWithAI
          fireEvent.click(aiButton)
          expect(mockedAnalyzeProblemWithAI).not.toHaveBeenCalled()

          // Then 3: Dispatch submit trực tiếp vào form chứa textarea để kiểm tra guard trong handleSubmit
          const formElement = textarea.closest('form')
          expect(formElement).not.toBeNull()
          fireEvent.submit(formElement!)

          // Then 4: createProblemFrame không được gọi
          expect(mockedCreateProblemFrame).not.toHaveBeenCalled()
        })
      }
    )
  })
})
