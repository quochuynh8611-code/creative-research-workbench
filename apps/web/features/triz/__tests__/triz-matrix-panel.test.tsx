/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TrizMatrixPanel } from '../triz-matrix-panel'
import * as apiClient from '@/lib/api-client'
import type { TrizLookupResponse, TrizParametersResponse } from '@/lib/types'

jest.mock('@/lib/api-client', () => ({
  getTrizParameters: jest.fn(),
  lookupTrizMatrix: jest.fn(),
}))

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  })
}

const MOCK_PARAMETERS_RESPONSE: TrizParametersResponse = {
  data: [
    { id: 14, code: 'strength', name_vi: 'Độ bền / Độ cứng', name_en: 'Strength' },
    { id: 1, code: 'weight_moving', name_vi: 'Trọng lượng vật thể di động', name_en: 'Weight of moving object' },
    { id: 9, code: 'speed', name_vi: 'Tốc độ / Vận tốc', name_en: 'Speed' },
  ],
  meta: { total: 3 },
}

const MOCK_LOOKUP_RESPONSE: TrizLookupResponse = {
  improving_parameter: { id: 14, code: 'strength', name_vi: 'Độ bền / Độ cứng', name_en: 'Strength' },
  worsening_parameter: { id: 1, code: 'weight_moving', name_vi: 'Trọng lượng vật thể di động', name_en: 'Weight of moving object' },
  principles: [
    {
      id: 1,
      principle_id: 1,
      name_vi: 'Phân đoạn',
      name_en: 'Segmentation',
      description: 'Chia đối tượng thành các phần độc lập.',
      explanation: 'Giúp giảm khối lượng tổng thể trong khi tăng cường độ chịu lực cục bộ.',
    },
    {
      id: 10,
      principle_id: 10,
      name_vi: 'Tác động sơ bộ',
      name_en: 'Preliminary action',
      description: 'Thực hiện trước các hành động cần thiết.',
      explanation: 'Đặt trước ứng suất hoặc kết cấu gia cường.',
    },
  ],
  principles_count: 2,
  is_diagonal: false,
}

describe('TrizMatrixPanel (Batch C21 - TRIZ Matrix Integration)', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = createTestQueryClient()
    jest.clearAllMocks()
    ;(apiClient.getTrizParameters as jest.Mock).mockResolvedValue(MOCK_PARAMETERS_RESPONSE)
    ;(apiClient.lookupTrizMatrix as jest.Mock).mockResolvedValue(MOCK_LOOKUP_RESPONSE)
  })

  test('GIVEN technical contradiction WHEN user opens TRIZ matrix panel THEN shows improving vs worsening parameters and highlights relevant principles', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <TrizMatrixPanel
          improvingParameter="Độ bền / Độ cứng"
          worseningParameter="Trọng lượng vật thể di động"
        />
      </QueryClientProvider>
    )

    // Verify improving and worsening parameters are displayed in the matrix panel
    await waitFor(() => {
      expect(screen.getByTestId('triz-matrix-panel')).toBeInTheDocument()
    })

    expect(screen.getByText(/Độ bền \/ Độ cứng/i)).toBeInTheDocument()
    expect(screen.getByText(/Trọng lượng vật thể di động/i)).toBeInTheDocument()

    // Verify highlighted TRIZ principles based on matrix lookup
    await waitFor(() => {
      expect(screen.getByText(/Phân đoạn/i)).toBeInTheDocument()
      expect(screen.getByText(/Tác động sơ bộ/i)).toBeInTheDocument()
    })

    const highlightedBadges = screen.getAllByTestId('highlighted-principle')
    expect(highlightedBadges.length).toBeGreaterThanOrEqual(2)
  })

  test('GIVEN onSelectPrinciple callback WHEN user clicks a highlighted principle THEN triggers callback', async () => {
    const handleSelect = jest.fn()

    render(
      <QueryClientProvider client={queryClient}>
        <TrizMatrixPanel
          improvingParameter={14}
          worseningParameter={1}
          onSelectPrinciple={handleSelect}
        />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/Phân đoạn/i)).toBeInTheDocument()
    })

    const applyButton = screen.getByRole('button', { name: /áp dụng nguyên tắc #1\b/i })
    fireEvent.click(applyButton)
    expect(handleSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }))
  })
})
