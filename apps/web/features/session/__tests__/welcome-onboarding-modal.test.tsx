/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WelcomeOnboardingModal } from '../welcome-onboarding-modal'
import * as apiClient from '@/lib/api-client'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

jest.mock('@/lib/api-client', () => ({
  getSessionTemplates: jest.fn(),
  createSessionFromTemplate: jest.fn(),
}))

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  })
}

describe('WelcomeOnboardingModal (Batch C33 PR 1)', () => {
  let queryClient: QueryClient
  const mockOnClose = jest.fn()
  const mockOnOpenCreateForm = jest.fn()

  beforeEach(() => {
    queryClient = createTestQueryClient()
    mockPush.mockReset()
    mockOnClose.mockReset()
    mockOnOpenCreateForm.mockReset()
    jest.clearAllMocks()
    localStorage.clear()
  })

  test('GIVEN isOpen is false THEN does not render dialog', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <WelcomeOnboardingModal
          isOpen={false}
          onClose={mockOnClose}
          onOpenCreateForm={mockOnOpenCreateForm}
        />
      </QueryClientProvider>
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('GIVEN isOpen is true THEN renders 3 core steps and action buttons', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <WelcomeOnboardingModal
          isOpen={true}
          onClose={mockOnClose}
          onOpenCreateForm={mockOnOpenCreateForm}
        />
      </QueryClientProvider>
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/Chào mừng bạn đến với Creative Research Workbench/i)).toBeInTheDocument()
    expect(screen.getByText(/1\. Định nghĩa bài toán/i)).toBeInTheDocument()
    expect(screen.getByText(/2\. Chuẩn hóa mâu thuẫn/i)).toBeInTheDocument()
    expect(screen.getByText(/3\. Gợi ý AI Coach & Hành động/i)).toBeInTheDocument()

    expect(screen.getByRole('button', { name: /Bắt đầu nhanh với bài toán mẫu/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tự tạo phiên nghiên cứu/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Bỏ qua/i })).toBeInTheDocument()
  })

  test('GIVEN user clicks "Bỏ qua" THEN closes modal immediately and sets localStorage flag (Skip 1-Click)', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <WelcomeOnboardingModal
          isOpen={true}
          onClose={mockOnClose}
          onOpenCreateForm={mockOnOpenCreateForm}
        />
      </QueryClientProvider>
    )

    const skipButton = screen.getByRole('button', { name: /Bỏ qua/i })
    fireEvent.click(skipButton)

    expect(mockOnClose).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('crw_onboarding_dismissed')).toBe('true')
  })

  test('GIVEN user clicks Close icon (X) THEN closes modal immediately and sets localStorage flag', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <WelcomeOnboardingModal
          isOpen={true}
          onClose={mockOnClose}
          onOpenCreateForm={mockOnOpenCreateForm}
        />
      </QueryClientProvider>
    )

    const closeButton = screen.getByRole('button', { name: /Đóng hướng dẫn/i })
    fireEvent.click(closeButton)

    expect(mockOnClose).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('crw_onboarding_dismissed')).toBe('true')
  })

  test('GIVEN user clicks "Tự tạo phiên nghiên cứu" THEN triggers onOpenCreateForm and sets localStorage flag', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <WelcomeOnboardingModal
          isOpen={true}
          onClose={mockOnClose}
          onOpenCreateForm={mockOnOpenCreateForm}
        />
      </QueryClientProvider>
    )

    const manualCreateButton = screen.getByRole('button', { name: /Tự tạo phiên nghiên cứu/i })
    fireEvent.click(manualCreateButton)

    expect(mockOnOpenCreateForm).toHaveBeenCalledTimes(1)
    expect(mockOnClose).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('crw_onboarding_dismissed')).toBe('true')
  })

  test('GIVEN templates list WHEN user clicks "Bắt đầu nhanh với bài toán mẫu" THEN creates session and redirects to workspace', async () => {
    const mockTemplates = [
      { id: 'business_delivery_speed_cost', title: 'Tối ưu Tốc độ Giao hàng & Chi phí', domain: 'business' },
      { id: 'personal_healthy_meal_time_cost', title: 'Bữa ăn Dinh dưỡng', domain: 'personal' },
    ]
    ;(apiClient.getSessionTemplates as jest.Mock).mockResolvedValue(mockTemplates)
    ;(apiClient.createSessionFromTemplate as jest.Mock).mockResolvedValue({
      id: 'session-demo-logistics-999',
      title: 'Tối ưu Tốc độ Giao hàng & Chi phí',
    })

    render(
      <QueryClientProvider client={queryClient}>
        <WelcomeOnboardingModal
          isOpen={true}
          onClose={mockOnClose}
          onOpenCreateForm={mockOnOpenCreateForm}
        />
      </QueryClientProvider>
    )

    const quickStartBtn = screen.getByRole('button', { name: /Bắt đầu nhanh với bài toán mẫu/i })
    fireEvent.click(quickStartBtn)

    await waitFor(() => {
      expect(apiClient.createSessionFromTemplate).toHaveBeenCalledWith({
        template_id: 'business_delivery_speed_cost',
      })
      expect(mockPush).toHaveBeenCalledWith('/sessions/session-demo-logistics-999')
      expect(localStorage.getItem('crw_onboarding_dismissed')).toBe('true')
    })
  })
})
