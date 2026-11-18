/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ArizStepperPanel } from '../ariz-stepper-panel'
import * as apiClient from '@/lib/api-client'
import type { TrizArizResponse } from '@/lib/types'

jest.mock('@/lib/api-client', () => ({
  getTrizArizSteps: jest.fn(),
}))

const mockedGetTrizArizSteps = apiClient.getTrizArizSteps as jest.MockedFunction<typeof apiClient.getTrizArizSteps>

const MOCK_ARIZ_RESPONSE: TrizArizResponse = {
  data: [
    {
      step_number: 1,
      code: 'B1_CHON_HE_THONG',
      name_vi: 'Chọn hệ thống và phát biểu bài toán ban đầu',
      name_en: 'Choose system and formulate initial problem',
      description: 'Xác định hệ thống kỹ thuật cần cải tiến.',
      trigger_questions: ['Hệ thống kỹ thuật chính là gì?', 'Mục đích ban đầu là gì?'],
      recommended_actions: ['Liệt kê các phần tử của hệ thống', 'Xác định môi trường xung quanh'],
    },
    {
      step_number: 2,
      code: 'B2_MO_HINH_BAI_TOAN',
      name_vi: 'Xây dựng mô hình bài toán và mâu thuẫn',
      name_en: 'Build problem model and contradiction',
      description: 'Chuyển bài toán thực tế thành mô hình mâu thuẫn kỹ thuật.',
      trigger_questions: ['Cặp thông số mâu thuẫn là gì?'],
      recommended_actions: ['Vẽ sơ đồ tương tác'],
    },
    {
      step_number: 3,
      code: 'B3_PHAN_TICH_VUNG_XUNG_DOT',
      name_vi: 'Phân tích vùng xung đột (OZ và OT)',
      name_en: 'Analyze conflict zone and conflict time',
      description: 'Định vị chính xác không gian và thời gian nơi xảy ra mâu thuẫn.',
      trigger_questions: ['Xung đột xảy ra ở đâu và khi nào?'],
      recommended_actions: ['Cô lập vùng xung đột'],
    },
    {
      step_number: 4,
      code: 'B4_DINH_NGHIA_IFR',
      name_vi: 'Định nghĩa Kết quả Lý tưởng Cuối cùng (IFR)',
      name_en: 'Define Ideal Final Result (IFR)',
      description: 'Mô tả trạng thái lý tưởng nơi hệ thống tự giải quyết mâu thuẫn.',
      trigger_questions: ['Hệ thống tự thực hiện chức năng mà không tốn chi phí?'],
      recommended_actions: ['Phát biểu IFR-1 và IFR-2'],
    },
    {
      step_number: 5,
      code: 'B5_HUY_DONG_NGUON_LUC',
      name_vi: 'Huy động nguồn lực có sẵn (Substance-Field Resources)',
      name_en: 'Mobilize available substance-field resources',
      description: 'Khai thác tối đa các chất, trường, không gian, thời gian miễn phí.',
      trigger_questions: ['Có nguồn lực nội tại nào chưa dùng?'],
      recommended_actions: ['Kiểm tra 5 nhóm tài nguyên'],
    },
    {
      step_number: 6,
      code: 'B6_THAY_THE_HOAC_CHUYEN_DOI',
      name_vi: 'Thay thế bài toán hoặc chuyển sang mức trên/dưới',
      name_en: 'Reformulate problem or shift system level',
      description: 'Nếu mâu thuẫn chưa giải quyết được, xem xét bài toán ở siêu hệ thống hoặc phân hệ.',
      trigger_questions: ['Có thể giải quyết ở cấp độ phân hệ không?'],
      recommended_actions: ['Áp dụng quy tắc phân tách'],
    },
  ],
  total_steps: 6,
}

function renderComponent(props: Partial<React.ComponentProps<typeof ArizStepperPanel>> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ArizStepperPanel {...props} />
    </QueryClientProvider>
  )
}

describe('ArizStepperPanel Component (Batch C34 — ARIZ 6-Step Guide)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('test_renders_six_steps_and_stepper_navigation', async () => {
    mockedGetTrizArizSteps.mockResolvedValueOnce(MOCK_ARIZ_RESPONSE)
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Thuật giải ARIZ 6 bước rút gọn')).toBeInTheDocument()
    })

    // Assert strictly 6 step buttons exist
    const stepButtons = screen.getAllByRole('button', { name: /Bước \d/i })
    expect(stepButtons).toHaveLength(6)

    // Current step name rendered
    expect(screen.getByText('Chọn hệ thống và phát biểu bài toán ban đầu')).toBeInTheDocument()
    expect(screen.getByText('B1_CHON_HE_THONG')).toBeInTheDocument()
  })

  test('test_navigation_between_steps', async () => {
    mockedGetTrizArizSteps.mockResolvedValueOnce(MOCK_ARIZ_RESPONSE)
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Chọn hệ thống và phát biểu bài toán ban đầu')).toBeInTheDocument()
    })

    // Previous button on step 1 should be disabled
    const prevBtn = screen.getByRole('button', { name: /Bước trước/i })
    const nextBtn = screen.getByRole('button', { name: /Bước kế tiếp/i })
    expect(prevBtn).toBeDisabled()
    expect(nextBtn).toBeEnabled()

    // Click next -> Step 2
    fireEvent.click(nextBtn)
    expect(screen.getByText('Xây dựng mô hình bài toán và mâu thuẫn')).toBeInTheDocument()
    expect(screen.getByText('B2_MO_HINH_BAI_TOAN')).toBeInTheDocument()
    expect(prevBtn).toBeEnabled()

    // Click prev -> Back to Step 1
    fireEvent.click(prevBtn)
    expect(screen.getByText('Chọn hệ thống và phát biểu bài toán ban đầu')).toBeInTheDocument()
  })

  test('test_direct_step_click_navigation', async () => {
    mockedGetTrizArizSteps.mockResolvedValueOnce(MOCK_ARIZ_RESPONSE)
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Chọn hệ thống và phát biểu bài toán ban đầu')).toBeInTheDocument()
    })

    const step4Btn = screen.getByRole('button', { name: /Bước 4/i })
    fireEvent.click(step4Btn)

    expect(screen.getByText('Định nghĩa Kết quả Lý tưởng Cuối cùng (IFR)')).toBeInTheDocument()
    expect(screen.getByText('B4_DINH_NGHIA_IFR')).toBeInTheDocument()
  })

  test('test_displays_trigger_questions_and_recommended_actions', async () => {
    mockedGetTrizArizSteps.mockResolvedValueOnce(MOCK_ARIZ_RESPONSE)
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Hệ thống kỹ thuật chính là gì?')).toBeInTheDocument()
      expect(screen.getByText('Liệt kê các phần tử của hệ thống')).toBeInTheDocument()
    })
  })

  test('test_calls_onSaveAsNote_with_correct_triz_ariz_context', async () => {
    mockedGetTrizArizSteps.mockResolvedValueOnce(MOCK_ARIZ_RESPONSE)
    const onSaveAsNote = jest.fn()
    renderComponent({ onSaveAsNote })

    await waitFor(() => {
      expect(screen.getByText('Chọn hệ thống và phát biểu bài toán ban đầu')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText(/Ghi chú giải pháp hoặc câu trả lời cho bước này/i)
    fireEvent.change(textarea, { target: { value: 'Hệ thống là máy sấy hạt công nghiệp' } })

    const saveBtn = screen.getByRole('button', { name: /Lưu vào sổ tay/i })
    fireEvent.click(saveBtn)

    expect(onSaveAsNote).toHaveBeenCalledTimes(1)
    const callArg = onSaveAsNote.mock.calls[0][0]
    expect(callArg.note_type).toBe('action')
    expect(callArg.content).toContain('ARIZ Bước 1')
    expect(callArg.content).toContain('Hệ thống là máy sấy hạt công nghiệp')
    expect(callArg.source_context).toEqual({
      schema_version: 1,
      source_type: 'triz_ariz',
      step_number: 1,
      step_name: 'B1_CHON_HE_THONG',
    })
  })

  test('test_handles_error_state_with_retry', async () => {
    mockedGetTrizArizSteps.mockRejectedValueOnce(new Error('Network error'))
    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('ariz-stepper-error')).toBeInTheDocument()
    })

    mockedGetTrizArizSteps.mockResolvedValueOnce(MOCK_ARIZ_RESPONSE)
    const retryBtn = screen.getByRole('button', { name: /Thử lại/i })
    fireEvent.click(retryBtn)

    await waitFor(() => {
      expect(screen.getByText('Thuật giải ARIZ 6 bước rút gọn')).toBeInTheDocument()
    })
  })
})
