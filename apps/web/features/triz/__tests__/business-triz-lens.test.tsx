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
}))

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  })
}

const MOCK_PARAMETERS_WITH_BUSINESS = {
  data: [
    {
      id: 1,
      code: 'weight_moving',
      name_vi: 'Trọng lượng vật thể di động',
      name_en: 'Weight of moving object',
      description: 'Khối lượng của vật thể chuyển động trong trường trọng lực.',
      everyday_label: 'Khối lượng đồ đạc, hành lý cần di chuyển',
      business_label: 'Quy mô vốn luân chuyển, dòng tiền lưu động',
    },
    {
      id: 2,
      code: 'weight_stationary',
      name_vi: 'Trọng lượng vật thể tĩnh',
      name_en: 'Weight of stationary object',
      description: 'Khối lượng của vật thể đứng yên.',
      everyday_label: 'Khối lượng bàn ghế, tủ kệ cố định',
      business_label: 'Tài sản cố định, quy mô vốn đầu tư cơ sở hạ tầng',
    },
  ],
  meta: { total: 2 },
}

const MOCK_LOOKUP_WITH_BUSINESS = {
  improving_parameter: {
    id: 1,
    code: 'weight_moving',
    name_vi: 'Trọng lượng vật thể di động',
    name_en: 'Weight of moving object',
    business_label: 'Quy mô vốn luân chuyển, dòng tiền lưu động',
    everyday_label: 'Khối lượng đồ đạc, hành lý cần di chuyển',
  },
  worsening_parameter: {
    id: 2,
    code: 'weight_stationary',
    name_vi: 'Trọng lượng vật thể tĩnh',
    name_en: 'Weight of stationary object',
    business_label: 'Tài sản cố định, quy mô vốn đầu tư cơ sở hạ tầng',
    everyday_label: 'Khối lượng bàn ghế, tủ kệ cố định',
  },
  is_diagonal: false,
  principles: [
    {
      id: 1,
      principle_id: 1,
      name_vi: 'Nguyên tắc Phân đoạn (Segmentation)',
      name_en: 'Segmentation',
      description: 'Chia đối tượng thành các phần độc lập.',
      explanation: 'Phân rã hệ thống thành các khối nhỏ...',
      examples: ['Cửa cuốn xếp lớp thay vì cửa nguyên tấm'],
      everyday_title: 'Chia nhỏ việc lớn (Phân đoạn)',
      daily_application: 'Chia nhỏ mục tiêu phức tạp thành các bước nhỏ 5–15 phút.',
      daily_examples: ['Chia bài đọc 40 trang thành 4 phần 10 trang.'],
      action_prompt: 'Việc nào có thể chia nhỏ để bắt đầu ngay?',
      business_title: 'Phân khúc thị trường / Chia nhỏ quy trình',
      business_application: 'Chia nhỏ tệp khách hàng hoặc tách quy trình vận hành phức tạp.',
      business_examples: ['Phân khúc khách hàng theo LTV để cá nhân hóa chiến dịch.'],
      business_action_prompt: 'Quy trình nào đang quá cồng kềnh có thể chia nhỏ để quản lý linh hoạt hơn?',
    },
  ],
  principles_count: 1,
}

const MOCK_LOOKUP_MISSING_BUSINESS = {
  improving_parameter: {
    id: 1,
    code: 'weight_moving',
    name_vi: 'Trọng lượng vật thể di động',
    name_en: 'Weight of moving object',
  },
  worsening_parameter: {
    id: 2,
    code: 'weight_stationary',
    name_vi: 'Trọng lượng vật thể tĩnh',
    name_en: 'Weight of stationary object',
  },
  is_diagonal: false,
  principles: [
    {
      id: 1,
      principle_id: 1,
      name_vi: 'Nguyên tắc Phân đoạn (Segmentation)',
      name_en: 'Segmentation',
      description: 'Chia đối tượng thành các phần độc lập.',
      // Không có business_*
    },
  ],
  principles_count: 1,
}

describe('TrizMatrixLookup — Business-TRIZ Lens (Batch B1: RED Phase)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('1. Hiển thị Segmented Control với đúng 3 lăng kính: Kỹ thuật, Kinh doanh, Đời sống', async () => {
    ;(apiClient.getTrizParameters as jest.Mock).mockResolvedValueOnce(MOCK_PARAMETERS_WITH_BUSINESS)
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <TrizMatrixLookup />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Kỹ thuật/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Kinh doanh/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Đời sống/i })).toBeInTheDocument()
    })
  })

  it('2. Lăng kính mặc định là Kỹ thuật, dropdown hiển thị tên kỹ thuật gốc', async () => {
    ;(apiClient.getTrizParameters as jest.Mock).mockResolvedValueOnce(MOCK_PARAMETERS_WITH_BUSINESS)
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <TrizMatrixLookup />
      </QueryClientProvider>
    )

    await waitFor(() => {
      const techBtn = screen.getByRole('button', { name: /Kỹ thuật/i })
      // Lăng kính Kỹ thuật phải ở trạng thái active (aria-pressed hoặc data-state)
      expect(techBtn).toHaveAttribute('aria-pressed', 'true')
    })
  })

  it('3. Khi chọn lăng kính Kinh doanh, dropdown và principle hiển thị business metadata', async () => {
    ;(apiClient.getTrizParameters as jest.Mock).mockResolvedValueOnce(MOCK_PARAMETERS_WITH_BUSINESS)
    ;(apiClient.lookupTrizMatrix as jest.Mock).mockResolvedValueOnce(MOCK_LOOKUP_WITH_BUSINESS)
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <TrizMatrixLookup improvingParameter="1" worseningParameter="2" />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Kinh doanh/i })).toBeInTheDocument()
    })

    // Bấm chọn lăng kính Kinh doanh
    fireEvent.click(screen.getByRole('button', { name: /Kinh doanh/i }))

    await waitFor(() => {
      // Dropdown option hiển thị business_label (xuất hiện ở cả 2 selector improving & worsening)
      expect(screen.getAllByText(/Quy mô vốn luân chuyển, dòng tiền lưu động/i)[0]).toBeInTheDocument()
      // Card principle hiển thị business_title & business_application
      expect(screen.getByText(/Phân khúc thị trường \/ Chia nhỏ quy trình/i)).toBeInTheDocument()
      expect(screen.getByText(/Chia nhỏ tệp khách hàng hoặc tách quy trình/i)).toBeInTheDocument()
    })
  })

  it('4. Khi chọn lăng kính Đời sống, hiển thị đúng everyday metadata đã có', async () => {
    ;(apiClient.getTrizParameters as jest.Mock).mockResolvedValueOnce(MOCK_PARAMETERS_WITH_BUSINESS)
    ;(apiClient.lookupTrizMatrix as jest.Mock).mockResolvedValueOnce(MOCK_LOOKUP_WITH_BUSINESS)
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <TrizMatrixLookup improvingParameter="1" worseningParameter="2" />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Đời sống/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Đời sống/i }))

    await waitFor(() => {
      expect(screen.getAllByText(/Khối lượng đồ đạc, hành lý cần di chuyển/i)[0]).toBeInTheDocument()
      expect(screen.getByText(/Chia nhỏ việc lớn \(Phân đoạn\)/i)).toBeInTheDocument()
    })
  })

  it('5. Khi thiếu dữ liệu business metadata, hiển thị controlled fallback, không lỗi raw', async () => {
    ;(apiClient.getTrizParameters as jest.Mock).mockResolvedValueOnce(MOCK_PARAMETERS_WITH_BUSINESS)
    ;(apiClient.lookupTrizMatrix as jest.Mock).mockResolvedValueOnce(MOCK_LOOKUP_MISSING_BUSINESS)
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <TrizMatrixLookup improvingParameter="1" worseningParameter="2" />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Kinh doanh/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Kinh doanh/i }))

    await waitFor(() => {
      // Phải có fallback có kiểm soát tiếng Việt, không bị crash hoặc hiển thị undefined
      expect(screen.getByText(/Đang cập nhật diễn giải kinh doanh|Chưa có dữ liệu kinh doanh/i)).toBeInTheDocument()
    })
  })
})
