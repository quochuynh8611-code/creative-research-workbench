/** @jest-environment jsdom */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { EmbeddingStatusPanel } from '../embedding-status-panel'
import * as apiClient from '@/lib/api-client'

jest.mock('@/lib/api-client', () => ({
  getEmbeddingStatus: jest.fn(),
}))

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  })
}

describe('EmbeddingStatusPanel (Batch C21 - UI Execution)', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = createTestQueryClient()
    jest.clearAllMocks()
  })

  test('GIVEN a session with ingested documents WHEN user opens panel THEN shows embedding progress and model used', async () => {
    // Scenario: Display embedding status in UI
    render(
      <QueryClientProvider client={queryClient}>
        <EmbeddingStatusPanel
          totalDocuments={10}
          embeddedDocuments={10}
          totalChunks={32}
          embeddedChunks={32}
          modelUsed="ollama"
          provider="ollama"
        />
      </QueryClientProvider>
    )

    // Verify progress text and model display
    expect(screen.getByText(/10\/10 documents embedded/i)).toBeInTheDocument()
    expect(screen.getByText(/ollama/i)).toBeInTheDocument()
    expect(screen.getByTestId('embedding-status-panel')).toBeInTheDocument()
  })

  test('GIVEN API fetch WHEN data arrives THEN displays progress and mock model', async () => {
    ;(apiClient.getEmbeddingStatus as jest.Mock).mockResolvedValue({
      total_documents: 10,
      embedded_documents: 8,
      total_chunks: 25,
      embedded_chunks: 20,
      model: 'mock',
      provider: 'mock',
      progress_text: '8/10 documents embedded',
    })

    render(
      <QueryClientProvider client={queryClient}>
        <EmbeddingStatusPanel />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/8\/10 documents embedded/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/mock/i)).toBeInTheDocument()
  })
})
