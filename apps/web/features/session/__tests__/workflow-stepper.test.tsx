/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WorkflowStepper } from '../workflow-stepper'
import * as apiClient from '@/lib/api-client'
import type { NextStepResponse } from '@/lib/types'

jest.mock('@/lib/api-client', () => ({
  nextStep: jest.fn(),
}))

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

describe('Phase 5.5 — WorkflowStepper & FSM Transition Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('1. Render đầy đủ 6 bước TRIZ với trạng thái active/completed/upcoming', () => {
    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <WorkflowStepper
          sessionId="sess-123"
          currentStage="structuring"
        />
      </QueryClientProvider>
    )

    // 6 bước TRIZ
    expect(screen.getByText('Nhập vấn đề')).toBeInTheDocument()
    expect(screen.getAllByText('Phân tích cấu trúc').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Truy xuất tài liệu')).toBeInTheDocument()
    expect(screen.getByText('Sinh ý tưởng')).toBeInTheDocument()
    expect(screen.getByText('Đánh giá')).toBeInTheDocument()
    expect(screen.getByText('Tổng hợp')).toBeInTheDocument()

    // Structuring là current stage -> hiển thị nút chuyển bước tiếp theo
    expect(screen.getByRole('button', { name: /chuyển sang bước tiếp theo/i })).toBeInTheDocument()
  })

  it('2. Gọi API nextStep khi bấm nút chuyển bước và kích hoạt callback', async () => {
    const queryClient = createTestQueryClient()
    const mockNextStepResponse: NextStepResponse = {
      session_id: 'sess-123',
      previous_state: 'structuring',
      current_state: 'retrieval',
      workflow_state: 'retrieval',
      next_step: 'retrieval',
      recommended_methods: [
        {
          id: 1,
          principle_id: 35,
          title: 'Thay đổi thông số lý hóa',
          description: 'Thay đổi trạng thái tập hợp, mật độ, độ dẻo.',
        },
      ],
    }

    ;(apiClient.nextStep as jest.Mock).mockResolvedValueOnce(mockNextStepResponse)
    const onNextStepSuccess = jest.fn()

    render(
      <QueryClientProvider client={queryClient}>
        <WorkflowStepper
          sessionId="sess-123"
          currentStage="structuring"
          onNextStepSuccess={onNextStepSuccess}
        />
      </QueryClientProvider>
    )

    const nextBtn = screen.getByRole('button', { name: /chuyển sang bước tiếp theo/i })
    fireEvent.click(nextBtn)

    await waitFor(() => {
      expect(apiClient.nextStep).toHaveBeenCalledWith('sess-123')
      expect(onNextStepSuccess).toHaveBeenCalledWith(mockNextStepResponse)
    })
  })

  it('3. Hiển thị trạng thái loading khi nextStep mutation đang chạy', async () => {
    const queryClient = createTestQueryClient()
    let resolveMutation: any
    const pendingPromise = new Promise((resolve) => {
      resolveMutation = resolve
    })
    ;(apiClient.nextStep as jest.Mock).mockReturnValueOnce(pendingPromise)

    render(
      <QueryClientProvider client={queryClient}>
        <WorkflowStepper
          sessionId="sess-123"
          currentStage="structuring"
        />
      </QueryClientProvider>
    )

    const nextBtn = screen.getByRole('button', { name: /chuyển sang bước tiếp theo/i })
    fireEvent.click(nextBtn)

    // Button bị disabled trong lúc đang chuyển bước
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /đang chuyển bước/i })).toBeDisabled()
    })

    // Resolve promise
    await React.act(async () => {
      resolveMutation({
        session_id: 'sess-123',
        previous_state: 'structuring',
        current_state: 'retrieval',
        workflow_state: 'retrieval',
        next_step: 'retrieval',
        recommended_methods: [],
      })
    })
  })

  it('4. Hiển thị thông báo lỗi khi nextStep API thất bại', async () => {
    const queryClient = createTestQueryClient()
    ;(apiClient.nextStep as jest.Mock).mockRejectedValueOnce(
      new Error('InvalidTransitionError: Cannot advance from intake without problem frame.')
    )

    render(
      <QueryClientProvider client={queryClient}>
        <WorkflowStepper
          sessionId="sess-123"
          currentStage="intake"
        />
      </QueryClientProvider>
    )

    const nextBtn = screen.getByRole('button', { name: /chuyển sang bước tiếp theo/i })
    fireEvent.click(nextBtn)

    await waitFor(() => {
      expect(screen.getByText(/Cannot advance from intake/i)).toBeInTheDocument()
    })
  })

  it('5. Cho phép click chọn trực tiếp các stage khi có onSelectStage callback', () => {
    const queryClient = createTestQueryClient()
    const onSelectStage = jest.fn()

    render(
      <QueryClientProvider client={queryClient}>
        <WorkflowStepper
          sessionId="sess-123"
          currentStage="structuring"
          onSelectStage={onSelectStage}
        />
      </QueryClientProvider>
    )

    const intakeStep = screen.getByText('Nhập vấn đề')
    fireEvent.click(intakeStep)

    expect(onSelectStage).toHaveBeenCalledWith('intake')
  })
})
