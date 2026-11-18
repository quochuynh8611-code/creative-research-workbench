/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ResourceAnalysisPanel } from '../resource-analysis-panel'
import * as apiClient from '@/lib/api-client'
import type { TrizResourceTaxonomyResponse } from '@/lib/types'

jest.mock('@/lib/api-client', () => ({
  getTrizResourceTaxonomy: jest.fn(),
}))

const mockedGetTrizResourceTaxonomy = apiClient.getTrizResourceTaxonomy as jest.MockedFunction<typeof apiClient.getTrizResourceTaxonomy>

const MOCK_RESOURCE_RESPONSE: TrizResourceTaxonomyResponse = {
  data: [
    {
      category: 'substance',
      name_vi: 'Tài nguyên Chất (Substance)',
      name_en: 'Substance Resources',
      description: 'Mọi vật liệu, chất thải, phụ phẩm, nguyên liệu thô hoặc chất trung gian có sẵn trong hoặc quanh hệ thống.',
      subtypes: ['Vật liệu cấu thành hệ thống', 'Phụ phẩm, chất thải từ quá trình vận hành', 'Môi trường xung quanh'],
      checklist_questions: [
        'Có chất thải hoặc phụ phẩm nào có thể tái sử dụng không?',
        'Có thể thay đổi trạng thái pha của chất sẵn có không?',
      ],
    },
    {
      category: 'field',
      name_vi: 'Tài nguyên Trường năng lượng (Field)',
      name_en: 'Field Resources',
      description: 'Các dạng năng lượng và trường vật lý sẵn có: cơ, nhiệt, hóa, điện, từ, quang, hạt nhân (MATChEM).',
      subtypes: ['Nhiệt thải hoặc gradient nhiệt', 'Trọng lực và quán tính', 'Trường điện từ'],
      checklist_questions: [
        'Hệ thống có tỏa nhiệt dư thừa có thể tận dụng không?',
        'Có thể chuyển đổi trường cơ học thành trường điện từ không?',
      ],
    },
    {
      category: 'time',
      name_vi: 'Tài nguyên Thời gian (Time)',
      name_en: 'Time Resources',
      description: 'Khoảng thời gian trước, trong và sau khi hệ thống hoạt động; thời gian chết (idle time); các chu kỳ vận hành.',
      subtypes: ['Thời gian chuẩn bị trước chu kỳ', 'Thời gian chết/nghỉ giữa các chu kỳ', 'Thời gian trễ trong phản ứng'],
      checklist_questions: [
        'Có thể thực hiện hành động phụ trong thời gian chết không?',
        'Có thể thực hiện trước một phần tác vụ (Pre-action) không?',
      ],
    },
    {
      category: 'space',
      name_vi: 'Tài nguyên Không gian (Space)',
      name_en: 'Space Resources',
      description: 'Vùng thể tích trống, diện tích bề mặt, chiều không gian thứ ba hoặc cấu trúc vi mô bên trong vật thể.',
      subtypes: ['Khoảng trống bên trong cấu trúc', 'Bề mặt tiếp xúc bên ngoài', 'Chiều không gian thẳng đứng'],
      checklist_questions: [
        'Có khoảng trống rỗng nào bên trong vật thể có thể tận dụng?',
        'Có thể chuyển từ mặt phẳng sang không gian 3 chiều không?',
      ],
    },
    {
      category: 'information',
      name_vi: 'Tài nguyên Thông tin (Information)',
      name_en: 'Information Resources',
      description: 'Dữ liệu đo đạc, tín hiệu vật lý tự phát, thuộc tính quang học, âm thanh hoặc trạng thái phản hồi của hệ thống.',
      subtypes: ['Trạng thái thay đổi màu sắc/nhiệt độ tự nhiên', 'Tín hiệu âm thanh hoặc rung động vận hành', 'Dữ liệu đo lường từ cảm biến'],
      checklist_questions: [
        'Hệ thống có tự phát ra tín hiệu cảnh báo nào không?',
        'Có thể khai thác thông tin phản hồi có sẵn mà không cần thêm cảm biến mới?',
      ],
    },
  ],
  total_categories: 5,
}

function renderComponent(props: Partial<React.ComponentProps<typeof ResourceAnalysisPanel>> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ResourceAnalysisPanel {...props} />
    </QueryClientProvider>
  )
}

describe('ResourceAnalysisPanel Component (Batch C34 — 5 Resource Categories)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('test_renders_five_resource_tabs', async () => {
    mockedGetTrizResourceTaxonomy.mockResolvedValueOnce(MOCK_RESOURCE_RESPONSE)
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Phân tích Nguồn lực TRIZ (5 nhóm tài nguyên)')).toBeInTheDocument()
    })

    // Assert strictly 5 category tabs exist
    expect(screen.getByRole('tab', { name: /Chất/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Trường/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Thời gian/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Không gian/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Thông tin/i })).toBeInTheDocument()
  })

  test('test_tab_switching_shows_category_content', async () => {
    mockedGetTrizResourceTaxonomy.mockResolvedValueOnce(MOCK_RESOURCE_RESPONSE)
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Tài nguyên Chất (Substance)')).toBeInTheDocument()
    })

    expect(screen.getByText('Có chất thải hoặc phụ phẩm nào có thể tái sử dụng không?')).toBeInTheDocument()

    // Switch to Time tab
    const timeTab = screen.getByRole('tab', { name: /Thời gian/i })
    fireEvent.click(timeTab)

    expect(screen.getByText('Tài nguyên Thời gian (Time)')).toBeInTheDocument()
    expect(screen.getByText('Có thể thực hiện hành động phụ trong thời gian chết không?')).toBeInTheDocument()
  })

  test('test_calls_onSaveAsNote_with_correct_triz_resource_context', async () => {
    mockedGetTrizResourceTaxonomy.mockResolvedValueOnce(MOCK_RESOURCE_RESPONSE)
    const onSaveAsNote = jest.fn()
    renderComponent({ onSaveAsNote })

    await waitFor(() => {
      expect(screen.getByText('Tài nguyên Chất (Substance)')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText(/Ghi chú tài nguyên tiềm năng phát hiện được/i)
    fireEvent.change(textarea, { target: { value: 'Tận dụng vỏ trấu làm chất đốt sinh khối sấy lúa' } })

    const saveBtn = screen.getByRole('button', { name: /Lưu vào sổ tay/i })
    fireEvent.click(saveBtn)

    expect(onSaveAsNote).toHaveBeenCalledTimes(1)
    const callArg = onSaveAsNote.mock.calls[0][0]
    expect(callArg.note_type).toBe('hypothesis')
    expect(callArg.content).toContain('Tài nguyên Chất (Substance)')
    expect(callArg.content).toContain('Tận dụng vỏ trấu làm chất đốt sinh khối sấy lúa')
    expect(callArg.source_context).toEqual({
      schema_version: 1,
      source_type: 'triz_resource',
      resource_type: 'substance',
      resource_name: 'Tài nguyên Chất (Substance)',
    })
  })

  test('test_handles_error_state_with_retry', async () => {
    mockedGetTrizResourceTaxonomy.mockRejectedValueOnce(new Error('Network error'))
    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('resource-analysis-error')).toBeInTheDocument()
    })

    mockedGetTrizResourceTaxonomy.mockResolvedValueOnce(MOCK_RESOURCE_RESPONSE)
    const retryBtn = screen.getByRole('button', { name: /Thử lại/i })
    fireEvent.click(retryBtn)

    await waitFor(() => {
      expect(screen.getByText('Phân tích Nguồn lực TRIZ (5 nhóm tài nguyên)')).toBeInTheDocument()
    })
  })
})
