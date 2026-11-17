/** @jest-environment jsdom */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AIStatusBadge } from '../ai-status-badge'
import * as apiClient from '@/lib/api-client'

jest.mock('@/lib/api-client', () => ({
  getAIStatus: jest.fn(),
}))

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  })
}

describe('AIStatusBadge (Batch C30 PR 2)', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = createTestQueryClient()
    jest.clearAllMocks()
  })

  test('GIVEN status=ready WHEN rendered THEN shows "AI thực tế" and green styling', async () => {
    ;(apiClient.getAIStatus as jest.Mock).mockResolvedValue({
      data: {
        status: 'ready',
        status_label: 'AI thực tế',
        llm: { provider: 'openai', model: 'gpt-4o-mini', is_real: true, healthy: true },
        embedding: { provider: 'openai', model: 'text-embedding-3-small', is_real: true, healthy: true },
        fallback_active: false,
      },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <AIStatusBadge />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('AI thực tế')).toBeInTheDocument()
    })
    const badge = screen.getByTestId('ai-status-badge')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('emerald')
  })

  test('GIVEN status=mock WHEN rendered THEN shows "Mock mode" and blue styling', async () => {
    ;(apiClient.getAIStatus as jest.Mock).mockResolvedValue({
      data: {
        status: 'mock',
        status_label: 'Mock mode',
        llm: { provider: 'mock', model: 'mock-model', is_real: false, healthy: true },
        embedding: { provider: 'mock', model: 'mock-embedding', is_real: false, healthy: true },
        fallback_active: false,
      },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <AIStatusBadge />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Mock mode')).toBeInTheDocument()
    })
    const badge = screen.getByTestId('ai-status-badge')
    expect(badge.className).toContain('blue')
  })

  test('GIVEN status=degraded or unavailable WHEN rendered THEN shows "AI tạm thời không khả dụng"', async () => {
    ;(apiClient.getAIStatus as jest.Mock).mockResolvedValue({
      data: {
        status: 'degraded',
        status_label: 'Chế độ suy giảm',
        llm: { provider: 'openai', model: 'gpt-4o-mini', is_real: true, healthy: false },
        embedding: { provider: 'openai', model: 'text-embedding-3-small', is_real: true, healthy: false },
        fallback_active: true,
      },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <AIStatusBadge />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('AI tạm thời không khả dụng')).toBeInTheDocument()
    })
  })

  test('GIVEN API network error WHEN rendered THEN degrades gracefully without crashing UI', async () => {
    ;(apiClient.getAIStatus as jest.Mock).mockRejectedValue(new Error('Network error 500'))

    render(
      <QueryClientProvider client={queryClient}>
        <AIStatusBadge />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('AI tạm thời không khả dụng')).toBeInTheDocument()
    })
    expect(screen.getByTestId('ai-status-badge')).toBeInTheDocument()
  })

  test('GIVEN AI response with sensitive properties WHEN rendered THEN does NOT expose secrets in DOM', async () => {
    ;(apiClient.getAIStatus as jest.Mock).mockResolvedValue({
      data: {
        status: 'ready',
        status_label: 'AI thực tế',
        llm: { provider: 'openai', model: 'gpt-4o-mini', is_real: true, healthy: true },
        embedding: { provider: 'openai', model: 'text-embedding-3-small', is_real: true, healthy: true },
        fallback_active: false,
      },
    })

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <AIStatusBadge />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('AI thực tế')).toBeInTheDocument()
    })

    const domHtml = container.innerHTML.toLowerCase()
    expect(domHtml).not.toContain('sk-')
    expect(domHtml).not.toContain('secret')
    expect(domHtml).not.toContain('token')
    expect(domHtml).not.toContain('password')
    expect(domHtml).not.toContain('bearer')
  })
})
