/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TrizMatrixLookup } from '../triz-matrix-lookup'
import * as apiClient from '@/lib/api-client'
import type { TrizLookupResponse } from '@/lib/types'

jest.mock('@/lib/api-client', () => ({
  getTrizParameters: jest.fn(),
  lookupTrizMatrix: jest.fn(),
}))

const MOCK_PARAMETERS_RESPONSE = {
  data: [
    { id: 1, code: 'weight_moving', name_vi: 'Trọng lượng vật thể di động', name_en: 'Weight of moving object' },
    { id: 5, code: 'area_moving', name_vi: 'Diện tích vật thể di động', name_en: 'Area of moving object' },
    { id: 14, code: 'strength', name_vi: 'Độ bền', name_en: 'Strength' },
    { id: 17, code: 'temperature', name_vi: 'Nhiệt độ', name_en: 'Temperature' },
  ],
  meta: { total: 4 },
}

const MOCK_LOOKUP_OFF_DIAGONAL: TrizLookupResponse = {
  improving_parameter: { id: 1, code: 'weight_moving', name_vi: 'Trọng lượng vật thể di động', name_en: 'Weight of moving object' },
  worsening_parameter: { id: 14, code: 'strength', name_vi: 'Độ bền', name_en: 'Strength' },
  is_diagonal: false,
  principles: [
    {
      id: 35,
      principle_id: 35,
      name_vi: 'Nguyên tắc Chuyển đổi thông số',
      name_en: 'Parameter changes',
      description: 'Thay đổi trạng thái vật lý...',
    },
  ],
  principles_count: 1,
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

describe('TrizMatrixLookup source_context (Batch C7c-2c)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(apiClient.getTrizParameters as jest.Mock).mockResolvedValue(MOCK_PARAMETERS_RESPONSE)
  })

  it('1. Happy path: đóng gói source_context chuẩn xác từ lookupResult và activeLens', async () => {
    ;(apiClient.lookupTrizMatrix as jest.Mock).mockResolvedValue(MOCK_LOOKUP_OFF_DIAGONAL)
    const onSaveAsNoteMock = jest.fn()
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <TrizMatrixLookup
          improvingParameter={1}
          worseningParameter={14}
          onSaveAsNote={onSaveAsNoteMock}
        />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/Nguyên tắc Chuyển đổi thông số/i)).toBeInTheDocument()
    })

    const saveBtn = screen.getByRole('button', { name: /lưu vào sổ tay/i })
    fireEvent.click(saveBtn)

    expect(onSaveAsNoteMock).toHaveBeenCalledTimes(1)
    expect(onSaveAsNoteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('#35'),
        note_type: 'hypothesis',
        source_context: {
          schema_version: 1,
          source_type: 'triz_matrix',
          principle_id: 35,
          improving_param_id: 1,
          worsening_param_id: 14,
          lens: 'engineering',
        },
      })
    )
  })

  it('2. Phản ánh đúng lens khi người dùng chọn lăng kính Kinh doanh (business)', async () => {
    ;(apiClient.lookupTrizMatrix as jest.Mock).mockResolvedValue(MOCK_LOOKUP_OFF_DIAGONAL)
    const onSaveAsNoteMock = jest.fn()
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <TrizMatrixLookup
          improvingParameter={1}
          worseningParameter={14}
          onSaveAsNote={onSaveAsNoteMock}
        />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/Nguyên tắc Chuyển đổi thông số/i)).toBeInTheDocument()
    })

    // Chuyển sang lens Kinh doanh
    const businessLensBtn = screen.getByRole('button', { name: /kinh doanh/i })
    fireEvent.click(businessLensBtn)

    const saveBtn = screen.getByRole('button', { name: /lưu vào sổ tay/i })
    fireEvent.click(saveBtn)

    expect(onSaveAsNoteMock).toHaveBeenCalledTimes(1)
    const draft = onSaveAsNoteMock.mock.calls[0][0]
    expect(draft.source_context).toEqual({
      schema_version: 1,
      source_type: 'triz_matrix',
      principle_id: 35,
      improving_param_id: 1,
      worsening_param_id: 14,
      lens: 'business',
    })
  })

  it('3. Selection Drift: đổi dropdown nhưng chưa bấm tra cứu -> context phải dùng param ID từ lookupResult, không phải dropdown', async () => {
    ;(apiClient.lookupTrizMatrix as jest.Mock).mockResolvedValue(MOCK_LOOKUP_OFF_DIAGONAL)
    const onSaveAsNoteMock = jest.fn()
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <TrizMatrixLookup
          improvingParameter={1}
          worseningParameter={14}
          onSaveAsNote={onSaveAsNoteMock}
        />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/Nguyên tắc Chuyển đổi thông số/i)).toBeInTheDocument()
    })

    // Người dùng đổi dropdown thông số cải thiện thành #17, nhưng KHÔNG bấm nút tra cứu
    const impSelect = screen.getByLabelText(/Thông số cần cải thiện/i)
    fireEvent.change(impSelect, { target: { value: '17' } })

    // Bấm lưu nguyên tắc đang hiển thị
    const saveBtn = screen.getByRole('button', { name: /lưu vào sổ tay/i })
    fireEvent.click(saveBtn)

    expect(onSaveAsNoteMock).toHaveBeenCalledTimes(1)
    const draft = onSaveAsNoteMock.mock.calls[0][0]
    // Phải lấy improving_param_id = 1 từ lookupResult, TUYỆT ĐỐI không lấy 17 từ dropdown chưa tra cứu
    expect(draft.source_context.improving_param_id).toBe(1)
  })

  it('4. Chặn lưu và không gọi onSaveAsNote nếu principle.principle_id thiếu hoặc không phải số nguyên hợp lệ', async () => {
    const corruptPrincipleResult: TrizLookupResponse = {
      ...MOCK_LOOKUP_OFF_DIAGONAL,
      principles: [
        {
          id: 35,
          principle_id: '35' as any, // sai kiểu string
          name_vi: 'Nguyên tắc lỗi',
          name_en: 'Corrupted principle',
          description: 'Mô tả...',
        },
      ],
    }
    ;(apiClient.lookupTrizMatrix as jest.Mock).mockResolvedValue(corruptPrincipleResult)
    const onSaveAsNoteMock = jest.fn()
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <TrizMatrixLookup
          improvingParameter={1}
          worseningParameter={14}
          onSaveAsNote={onSaveAsNoteMock}
        />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/Nguyên tắc lỗi/i)).toBeInTheDocument()
    })

    const saveBtn = screen.getByRole('button', { name: /lưu vào sổ tay/i })
    fireEvent.click(saveBtn)

    // Tuyệt đối không được gọi onSaveAsNote
    expect(onSaveAsNoteMock).not.toHaveBeenCalled()
    // Phải hiển thị lỗi
    expect(await screen.findByText(/không thể tạo context|principle_id phải là số nguyên/i)).toBeInTheDocument()
  })

  it('5. Chặn lưu và không gọi onSaveAsNote nếu lookupResult.improving_parameter.id bị thiếu/undefined', async () => {
    const missingImprovingIdResult: any = {
      ...MOCK_LOOKUP_OFF_DIAGONAL,
      improving_parameter: {
        code: 'weight_moving',
        name_vi: 'Trọng lượng vật thể di động',
        name_en: 'Weight of moving object',
      },
    }
    ;(apiClient.lookupTrizMatrix as jest.Mock).mockResolvedValue(missingImprovingIdResult)
    const onSaveAsNoteMock = jest.fn()
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <TrizMatrixLookup
          improvingParameter={1}
          worseningParameter={14}
          onSaveAsNote={onSaveAsNoteMock}
        />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/Nguyên tắc Chuyển đổi thông số/i)).toBeInTheDocument()
    })

    const saveBtn = screen.getByRole('button', { name: /lưu vào sổ tay/i })
    fireEvent.click(saveBtn)

    expect(onSaveAsNoteMock).not.toHaveBeenCalled()
    expect(await screen.findByText(/không thể tạo context|improving_param_id/i)).toBeInTheDocument()
  })

  it('6. Chặn lưu và không gọi onSaveAsNote nếu lookupResult.worsening_parameter.id bị thiếu/undefined', async () => {
    const missingWorseningIdResult: any = {
      ...MOCK_LOOKUP_OFF_DIAGONAL,
      worsening_parameter: {
        code: 'strength',
        name_vi: 'Độ bền',
        name_en: 'Strength',
      },
    }
    ;(apiClient.lookupTrizMatrix as jest.Mock).mockResolvedValue(missingWorseningIdResult)
    const onSaveAsNoteMock = jest.fn()
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <TrizMatrixLookup
          improvingParameter={1}
          worseningParameter={14}
          onSaveAsNote={onSaveAsNoteMock}
        />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/Nguyên tắc Chuyển đổi thông số/i)).toBeInTheDocument()
    })

    const saveBtn = screen.getByRole('button', { name: /lưu vào sổ tay/i })
    fireEvent.click(saveBtn)

    expect(onSaveAsNoteMock).not.toHaveBeenCalled()
    expect(await screen.findByText(/không thể tạo context|worsening_param_id/i)).toBeInTheDocument()
  })
})
