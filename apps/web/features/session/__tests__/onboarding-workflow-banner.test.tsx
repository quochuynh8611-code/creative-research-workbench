/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OnboardingWorkflowBanner } from '../onboarding-workflow-banner'
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

describe('OnboardingWorkflowBanner (Batch C30 PR 2)', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = createTestQueryClient()
    mockPush.mockReset()
    jest.clearAllMocks()
  })

  test('GIVEN banner rendered THEN displays all 6 TRIZ workflow steps', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <OnboardingWorkflowBanner />
      </QueryClientProvider>
    )

    expect(screen.getByText(/Intake/i)).toBeInTheDocument()
    expect(screen.getByText(/Structuring/i)).toBeInTheDocument()
    expect(screen.getByText(/Retrieval/i)).toBeInTheDocument()
    expect(screen.getByText(/Ideation/i)).toBeInTheDocument()
    expect(screen.getByText(/Evaluation/i)).toBeInTheDocument()
    expect(screen.getByText(/Synthesis/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Bắt đầu phiên mẫu/i })).toBeInTheDocument()
  })

  test('GIVEN templates list with logistics WHEN user clicks CTA THEN creates session with logistics template and redirects', async () => {
    const mockTemplates = [
      { id: 'random_template_1', title: 'Random', domain: 'other' },
      { id: 'business_delivery_speed_cost', title: 'Tối ưu Tốc độ Giao hàng & Chi phí', domain: 'business' },
      { id: 'personal_healthy_meal_time_cost', title: 'Bữa ăn Dinh dưỡng', domain: 'personal' },
    ]
    ;(apiClient.getSessionTemplates as jest.Mock).mockResolvedValue(mockTemplates)
    ;(apiClient.createSessionFromTemplate as jest.Mock).mockResolvedValue({
      id: 'session-new-logistics-123',
      title: 'Tối ưu Tốc độ Giao hàng & Chi phí',
    })

    render(
      <QueryClientProvider client={queryClient}>
        <OnboardingWorkflowBanner />
      </QueryClientProvider>
    )

    const ctaButton = screen.getByRole('button', { name: /Bắt đầu phiên mẫu/i })
    fireEvent.click(ctaButton)

    await waitFor(() => {
      expect(apiClient.createSessionFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ template_id: 'business_delivery_speed_cost' })
      )
      expect(mockPush).toHaveBeenCalledWith('/sessions/session-new-logistics-123')
    })
  })

  test('GIVEN templates without logistics but with nutrition WHEN user clicks CTA THEN falls back to nutrition template and redirects', async () => {
    const mockTemplates = [
      { id: 'other_template_xyz', title: 'Other Template', domain: 'tech' },
      { id: 'personal_healthy_meal_time_cost', title: 'Bữa ăn Dinh dưỡng', domain: 'personal' },
    ]
    ;(apiClient.getSessionTemplates as jest.Mock).mockResolvedValue(mockTemplates)
    ;(apiClient.createSessionFromTemplate as jest.Mock).mockResolvedValue({
      id: 'session-new-nutrition-456',
      title: 'Bữa ăn Dinh dưỡng',
    })

    render(
      <QueryClientProvider client={queryClient}>
        <OnboardingWorkflowBanner />
      </QueryClientProvider>
    )

    const ctaButton = screen.getByRole('button', { name: /Bắt đầu phiên mẫu/i })
    fireEvent.click(ctaButton)

    await waitFor(() => {
      expect(apiClient.createSessionFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ template_id: 'personal_healthy_meal_time_cost' })
      )
      expect(mockPush).toHaveBeenCalledWith('/sessions/session-new-nutrition-456')
    })
  })

  test('GIVEN templates WITHOUT logistics AND WITHOUT nutrition WHEN user clicks CTA THEN does NOT use templates[0], shows friendly error and does NOT redirect', async () => {
    // Chỉ có các template khác, hoàn toàn không có logistics hoặc nutrition
    const mockTemplates = [
      { id: 'unrelated_other_0', title: 'Unrelated 0', domain: 'other' },
      { id: 'unrelated_other_1', title: 'Unrelated 1', domain: 'other' },
    ]
    ;(apiClient.getSessionTemplates as jest.Mock).mockResolvedValue(mockTemplates)

    render(
      <QueryClientProvider client={queryClient}>
        <OnboardingWorkflowBanner />
      </QueryClientProvider>
    )

    const ctaButton = screen.getByRole('button', { name: /Bắt đầu phiên mẫu/i })
    fireEvent.click(ctaButton)

    await waitFor(() => {
      expect(screen.getByText(/Không tìm thấy mẫu phù hợp/i)).toBeInTheDocument()
    })

    // Tuyệt đối không gọi createSessionFromTemplate với templates[0] ('unrelated_other_0')
    expect(apiClient.createSessionFromTemplate).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })
})
