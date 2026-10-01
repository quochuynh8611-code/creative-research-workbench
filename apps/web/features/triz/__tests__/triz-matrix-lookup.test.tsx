/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TrizMatrixLookup } from '../triz-matrix-lookup'
import { SessionDetail } from '@/features/session/session-detail'
import * as apiClient from '@/lib/api-client'
import type {
  TrizParametersResponse,
  TrizLookupResponse,
  ResearchSession,
} from '@/lib/types'

jest.mock('@/lib/api-client', () => ({
  getTrizParameters: jest.fn(),
  lookupTrizMatrix: jest.fn(),
  getSession: jest.fn(),
  createProblemFrame: jest.fn(),
  nextStep: jest.fn(),
}))

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  })
}

const MOCK_SESSION_STRUCTURING: ResearchSession = {
  id: 'ses-456',
  title: 'Tối ưu độ bền và trọng lượng cánh tay robot',
  description: 'Nghiên cứu vật liệu composite cho robot công nghiệp',
  domain: 'technical',
  status: 'active',
  workflow_state: 'structuring',
  tags: ['robotics', 'triz', 'materials'],
  created_at: '2026-03-15T08:30:00Z',
  updated_at: '2026-03-15T09:15:00Z',
  problem_frame: {
    id: 'frame-789',
    session_id: 'ses-456',
    raw_statement: 'Cánh tay robot cần nhẹ để tăng tốc độ nhưng phải cứng để chịu tải',
    normalized_statement: 'Tăng độ cứng vững của cấu trúc trong khi duy trì hoặc giảm khối lượng tổng thể',
    contradiction_type: 'technical',
    improving_parameter: 'Độ bền / Độ cứng',
    worsening_parameter: 'Trọng lượng vật thể',
    domain: 'technical',
    created_at: '2026-03-15T09:00:00Z',
  },
}

const MOCK_PARAMETERS_RESPONSE: TrizParametersResponse = {
  data: [
    { id: 1, code: 'weight_moving', name_vi: 'Trọng lượng vật thể di động', name_en: 'Weight of moving object' },
    { id: 5, code: 'area_moving', name_vi: 'Diện tích vật thể di động', name_en: 'Area of moving object' },
    { id: 14, code: 'strength', name_vi: 'Độ bền / Độ cứng', name_en: 'Strength' },
    { id: 17, code: 'temperature', name_vi: 'Nhiệt độ', name_en: 'Temperature' },
  ],
  meta: { total: 4 },
}

const MOCK_LOOKUP_OFF_DIAGONAL: TrizLookupResponse = {
  improving_parameter: { id: 17, code: 'temperature', name_vi: 'Nhiệt độ', name_en: 'Temperature' },
  worsening_parameter: { id: 14, code: 'strength', name_vi: 'Độ bền / Độ cứng', name_en: 'Strength' },
  is_diagonal: false,
  principles: [
    {
      id: 35,
      principle_id: 35,
      name_vi: 'Nguyên tắc Chuyển đổi thông số',
      name_en: 'Parameter changes',
      description: 'Thay đổi trạng thái vật lý, nồng độ hoặc độ dẻo.',
      explanation: 'Thay đổi thông số nhiệt độ giúp giảm ứng suất phá hủy vật liệu.',
      examples: ['Sử dụng vật liệu nhớ hình', 'Thay đổi pha lỏng sang rắn'],
    },
    {
      id: 10,
      principle_id: 10,
      name_vi: 'Nguyên tắc Tác động sơ bộ',
      name_en: 'Preliminary action',
      description: 'Thực hiện tác động trước khi cần thiết.',
      explanation: 'Gia nhiệt trước để giảm sốc nhiệt.',
      examples: ['Ủ nhiệt trước khi hàn'],
    },
  ],
  principles_count: 2,
}

const MOCK_LOOKUP_DIAGONAL: TrizLookupResponse = {
  improving_parameter: { id: 5, code: 'area_moving', name_vi: 'Diện tích vật thể di động', name_en: 'Area of moving object' },
  worsening_parameter: { id: 5, code: 'area_moving', name_vi: 'Diện tích vật thể di động', name_en: 'Area of moving object' },
  is_diagonal: true,
  principles: [],
  principles_count: 0,
}

describe('Track 1.3 — TrizMatrixLookup Component Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('1. Tải danh mục parameters và hiển thị 2 bộ chọn (Improving & Worsening)', async () => {
    ;(apiClient.getTrizParameters as jest.Mock).mockResolvedValueOnce(MOCK_PARAMETERS_RESPONSE)
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <TrizMatrixLookup />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getAllByText(/#17. Nhiệt độ/i)[0]).toBeInTheDocument()
    })

    const improvingSelect = screen.getByLabelText(/Thông số cần cải thiện/i)
    expect(improvingSelect).toHaveTextContent('Nhiệt độ')
  })

  it('2. Chọn cặp mâu thuẫn kỹ thuật (17 Temperature vs 14 Strength) gọi lookupTrizMatrix và render principles', async () => {
    ;(apiClient.getTrizParameters as jest.Mock).mockResolvedValueOnce(MOCK_PARAMETERS_RESPONSE)
    ;(apiClient.lookupTrizMatrix as jest.Mock).mockResolvedValueOnce(MOCK_LOOKUP_OFF_DIAGONAL)
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <TrizMatrixLookup />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getAllByText(/#17. Nhiệt độ/i)[0]).toBeInTheDocument()
    })

    const improvingSelect = screen.getByLabelText(/Thông số cần cải thiện/i)
    const worseningSelect = screen.getByLabelText(/Thông số bị suy giảm/i)

    fireEvent.change(improvingSelect, { target: { value: '17' } })
    fireEvent.change(worseningSelect, { target: { value: '14' } })

    const lookupButton = screen.getByRole('button', { name: /tra cứu ma trận/i })
    fireEvent.click(lookupButton)

    await waitFor(() => {
      expect(apiClient.lookupTrizMatrix).toHaveBeenCalledWith({ improving: 17, worsening: 14 })
      expect(screen.getByText(/Nguyên tắc Chuyển đổi thông số/i)).toBeInTheDocument()
      expect(screen.getByText(/#35/i)).toBeInTheDocument()
      expect(screen.getByText(/Nguyên tắc Tác động sơ bộ/i)).toBeInTheDocument()
      expect(screen.getByText(/#10/i)).toBeInTheDocument()
    })
  })

  it('3. Chọn cùng một thông số (5 vs 5) hiển thị cảnh báo mâu thuẫn vật lý', async () => {
    ;(apiClient.getTrizParameters as jest.Mock).mockResolvedValueOnce(MOCK_PARAMETERS_RESPONSE)
    ;(apiClient.lookupTrizMatrix as jest.Mock).mockResolvedValueOnce(MOCK_LOOKUP_DIAGONAL)
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <TrizMatrixLookup />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getAllByText(/#5. Diện tích vật thể di động/i)[0]).toBeInTheDocument()
    })

    const improvingSelect = screen.getByLabelText(/Thông số cần cải thiện/i)
    const worseningSelect = screen.getByLabelText(/Thông số bị suy giảm/i)

    fireEvent.change(improvingSelect, { target: { value: '5' } })
    fireEvent.change(worseningSelect, { target: { value: '5' } })

    const lookupButton = screen.getByRole('button', { name: /tra cứu ma trận/i })
    fireEvent.click(lookupButton)

    await waitFor(() => {
      expect(apiClient.lookupTrizMatrix).toHaveBeenCalledWith({ improving: 5, worsening: 5 })
      expect(screen.getByText(/Mâu thuẫn vật lý \(Physical Contradiction\)/i)).toBeInTheDocument()
      expect(screen.getByText(/Phân tách trong không gian/i)).toBeInTheDocument()
    })
  })

  it('4. Hiển thị error message khi lookup API gặp sự cố', async () => {
    ;(apiClient.getTrizParameters as jest.Mock).mockResolvedValueOnce(MOCK_PARAMETERS_RESPONSE)
    ;(apiClient.lookupTrizMatrix as jest.Mock).mockRejectedValueOnce(new Error('Lỗi kết nối máy chủ TRIZ'))
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <TrizMatrixLookup />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getAllByText(/#17. Nhiệt độ/i)[0]).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/Thông số cần cải thiện/i), { target: { value: '17' } })
    fireEvent.change(screen.getByLabelText(/Thông số bị suy giảm/i), { target: { value: '14' } })

    fireEvent.click(screen.getByRole('button', { name: /tra cứu ma trận/i }))

    await waitFor(() => {
      expect(screen.getByText(/Không thể tra cứu ma trận mâu thuẫn/i)).toBeInTheDocument()
    })
  })

  it('5. SessionDetail chỉ render TrizMatrixLookup khi tab Ý tưởng & Nguyên tắc (ideation) active', async () => {
    ;(apiClient.getSession as jest.Mock).mockResolvedValue(MOCK_SESSION_STRUCTURING)
    ;(apiClient.getTrizParameters as jest.Mock).mockResolvedValue(MOCK_PARAMETERS_RESPONSE)
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <SessionDetail sessionId="ses-456" />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Tối ưu độ bền và trọng lượng cánh tay robot')).toBeInTheDocument()
    })

    // Khi ở tab structuring ban đầu, không hiển thị TrizMatrixLookup
    expect(screen.queryByText(/Tra cứu Ma trận Mâu thuẫn TRIZ/i)).not.toBeInTheDocument()

    // Chuyển sang tab Ý tưởng & Nguyên tắc
    const ideationTab = screen.getByRole('button', { name: /Ý tưởng & Nguyên tắc/i })
    fireEvent.click(ideationTab)

    // Khi tab ideation active, TrizMatrixLookup hiển thị
    await waitFor(() => {
      expect(screen.getByText(/Tra cứu Ma trận Mâu thuẫn TRIZ/i)).toBeInTheDocument()
    })
  })
})
