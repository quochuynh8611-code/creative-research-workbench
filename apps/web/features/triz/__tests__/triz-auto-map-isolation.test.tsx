/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TrizMatrixLookup } from '../triz-matrix-lookup'
import * as apiClient from '@/lib/api-client'

jest.mock('@/lib/api-client', () => ({
  getTrizParameters: jest.fn(),
  lookupTrizMatrix: jest.fn(),
  mapTrizParameters: jest.fn(),
}))

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  })
}

const MOCK_PARAMETERS = {
  data: [
    {
      id: 1,
      code: 'weight_moving',
      name_vi: 'Trọng lượng vật thể di động',
      name_en: 'Weight of moving object',
      description: 'Mô tả',
      business_label: 'Vốn luân chuyển',
      everyday_label: 'Đồ đạc di chuyển',
    },
  ],
}

describe('TrizMatrixLookup Auto-Map Isolation Regression', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(apiClient.getTrizParameters as jest.Mock).mockResolvedValue(MOCK_PARAMETERS)
    ;(apiClient.lookupTrizMatrix as jest.Mock).mockResolvedValue({
      improving_parameter: { id: 1, name_vi: 'P1' },
      worsening_parameter: { id: 1, name_vi: 'P1' },
      is_diagonal: true,
      principles: [],
      principles_count: 0,
    })
  })

  it('chuyển đổi giữa các lens không bao giờ phát sinh gọi mapTrizParameters', async () => {
    const qc = createTestQueryClient()
    render(
      <QueryClientProvider client={qc}>
        <TrizMatrixLookup />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Kinh doanh/i })).toBeInTheDocument()
    })

    // Click lens Kinh doanh
    fireEvent.click(screen.getByRole('button', { name: /Kinh doanh/i }))
    // Click lens Đời sống
    fireEvent.click(screen.getByRole('button', { name: /Đời sống/i }))
    // Click lens Kỹ thuật
    fireEvent.click(screen.getByRole('button', { name: /Kỹ thuật/i }))

    // Khẳng định không có bất kỳ lời gọi nào tới mapTrizParameters
    expect(apiClient.mapTrizParameters).not.toHaveBeenCalled()
  })
})
