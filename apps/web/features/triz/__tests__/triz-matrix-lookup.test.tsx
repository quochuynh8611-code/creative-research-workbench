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
    { id: 1, code: 'weight_moving', name_vi: 'Trọng lượng vật thể di động', name_en: 'Weight of moving object', everyday_label: 'Độ nặng, tải trọng hoặc khối lượng cần di chuyển' },
    { id: 5, code: 'area_moving', name_vi: 'Diện tích vật thể di động', name_en: 'Area of moving object', everyday_label: 'Diện tích chiếm dụng hoặc bề mặt tiếp xúc' },
    { id: 9, code: 'speed', name_vi: 'Tốc độ / Vận tốc', name_en: 'Speed', everyday_label: 'Tốc độ hoàn thành công việc, thao tác hoặc tiến độ dự án' },
    { id: 14, code: 'strength', name_vi: 'Độ bền / Độ cứng', name_en: 'Strength', everyday_label: 'Độ bền chắc, khả năng chịu lực hoặc sức chịu đựng gian khó' },
    { id: 17, code: 'temperature', name_vi: 'Nhiệt độ', name_en: 'Temperature', everyday_label: 'Mức độ nhiệt hoặc sự thay đổi nóng lạnh của môi trường' },
    { id: 22, code: 'loss_of_energy', name_vi: 'Hao tổn năng lượng', name_en: 'Waste of energy', everyday_label: 'Tổn hao sinh lực, tiền bạc, nhiên liệu hoặc chi phí vận hành' },
    { id: 25, code: 'loss_of_time', name_vi: 'Hao tổn thời gian', name_en: 'Waste of time', everyday_label: 'Lãng phí thời gian, thời lượng chờ đợi hoặc độ trễ' },
    { id: 27, code: 'reliability', name_vi: 'Độ tin cậy', name_en: 'Reliability', everyday_label: 'Mức độ uy tín, tính chuẩn xác hoặc độ tin cậy của cam kết' },
  ],
  meta: { total: 8 },
}

const MOCK_LOOKUP_OFF_DIAGONAL: TrizLookupResponse = {
  improving_parameter: { id: 17, code: 'temperature', name_vi: 'Nhiệt độ', name_en: 'Temperature', everyday_label: 'Mức độ nhiệt' },
  worsening_parameter: { id: 14, code: 'strength', name_vi: 'Độ bền / Độ cứng', name_en: 'Strength', everyday_label: 'Độ bền chắc' },
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
      everyday_title: 'Thay đổi tính chất (Chuyển đổi thông số)',
      daily_application: 'Điều chỉnh linh hoạt cách thức, tần suất hoặc cường độ hoạt động.',
      daily_examples: ['Chuyển từ học 2 tiếng liên tục sang học 25 phút nghỉ 5 phút.'],
      action_prompt: 'Thông số hoặc thói quen nào có thể chuyển đổi linh hoạt hơn?',
    },
    {
      id: 10,
      principle_id: 10,
      name_vi: 'Nguyên tắc Tác động sơ bộ',
      name_en: 'Preliminary action',
      description: 'Thực hiện tác động trước khi cần thiết.',
      explanation: 'Gia nhiệt trước để giảm sốc nhiệt.',
      examples: ['Ủ nhiệt trước khi hàn'],
      // Không có everyday metadata để test fallback
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

  it('6. Kích hoạt callback onSaveAsNote khi người dùng bấm Lưu vào sổ tay trên thẻ nguyên tắc', async () => {
    ;(apiClient.getTrizParameters as jest.Mock).mockResolvedValueOnce(MOCK_PARAMETERS_RESPONSE)
    ;(apiClient.lookupTrizMatrix as jest.Mock).mockResolvedValueOnce(MOCK_LOOKUP_OFF_DIAGONAL)
    const onSaveAsNoteMock = jest.fn()
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <TrizMatrixLookup onSaveAsNote={onSaveAsNoteMock} />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getAllByText(/#17. Nhiệt độ/i)[0]).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/Thông số cần cải thiện/i), { target: { value: '17' } })
    fireEvent.change(screen.getByLabelText(/Thông số bị suy giảm/i), { target: { value: '14' } })
    fireEvent.click(screen.getByRole('button', { name: /tra cứu ma trận/i }))

    await waitFor(() => {
      expect(screen.getByText(/Nguyên tắc Chuyển đổi thông số/i)).toBeInTheDocument()
    })

    const saveBtns = screen.getAllByRole('button', { name: /lưu vào sổ tay|lưu ghi chú/i })
    expect(saveBtns.length).toBeGreaterThan(0)
    fireEvent.click(saveBtns[0])

    expect(onSaveAsNoteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('#35'),
        note_type: 'hypothesis',
      })
    )
  })

  it('7. TrizMatrixLookup nhận improving/worsening props và tự động chạy lookup khi có đủ tham số', async () => {
    ;(apiClient.getTrizParameters as jest.Mock).mockResolvedValueOnce(MOCK_PARAMETERS_RESPONSE)
    ;(apiClient.lookupTrizMatrix as jest.Mock).mockResolvedValueOnce(MOCK_LOOKUP_OFF_DIAGONAL)
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <TrizMatrixLookup
          improvingParameter="temperature"
          worseningParameter="strength"
        />
      </QueryClientProvider>
    )

    // Should automatically call lookupTrizMatrix with resolved IDs: temperature=17, strength=14
    await waitFor(() => {
      expect(apiClient.lookupTrizMatrix).toHaveBeenCalledWith({
        improving: 17,
        worsening: 14,
      })
    })

    // Principles should be displayed without manual click
    await waitFor(() => {
      expect(screen.getByText(/Nguyên tắc Chuyển đổi thông số/i)).toBeInTheDocument()
    })
  })

  it('8. TrizMatrixLookup tự động resolve legacy aliases loss_of_money -> 22 và duration_action -> 25', async () => {
    ;(apiClient.getTrizParameters as jest.Mock).mockResolvedValueOnce(MOCK_PARAMETERS_RESPONSE)
    ;(apiClient.lookupTrizMatrix as jest.Mock).mockResolvedValueOnce(MOCK_LOOKUP_OFF_DIAGONAL)
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <TrizMatrixLookup
          improvingParameter="loss_of_money"
          worseningParameter="duration_action"
        />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(apiClient.lookupTrizMatrix).toHaveBeenCalledWith({
        improving: 22,
        worsening: 25,
      })
    })
  })

  it('9. Dropdown parameter hiển thị everyday_label khi có', async () => {
    ;(apiClient.getTrizParameters as jest.Mock).mockResolvedValueOnce(MOCK_PARAMETERS_RESPONSE)
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <TrizMatrixLookup />
      </QueryClientProvider>
    )

    await waitFor(() => {
      // Option của parameter 14 phải chứa everyday_label
      expect(screen.getAllByText(/Độ bền chắc, khả năng chịu lực/i)[0]).toBeInTheDocument()
      expect(screen.getAllByText(/Hao tổn năng lượng/i)[0]).toBeInTheDocument()
    })
  })

  it('10. Hiển thị đầy đủ 4 trường Everyday Metadata của principle và fallback đúng khi thiếu', async () => {
    ;(apiClient.getTrizParameters as jest.Mock).mockResolvedValueOnce(MOCK_PARAMETERS_RESPONSE)
    ;(apiClient.lookupTrizMatrix as jest.Mock).mockResolvedValueOnce(MOCK_LOOKUP_OFF_DIAGONAL)
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <TrizMatrixLookup
          improvingParameter="temperature"
          worseningParameter="strength"
        />
      </QueryClientProvider>
    )

    // Chuyển sang lăng kính Đời sống để kiểm tra everyday metadata
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Đời sống/i })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /Đời sống/i }))

    await waitFor(() => {
      // everyday_title
      expect(screen.getByText('Thay đổi tính chất (Chuyển đổi thông số)')).toBeInTheDocument()
      // daily_application
      expect(screen.getByText(/Điều chỉnh linh hoạt cách thức, tần suất hoặc cường độ/i)).toBeInTheDocument()
      // daily_examples
      expect(screen.getByText(/Chuyển từ học 2 tiếng liên tục sang học 25 phút/i)).toBeInTheDocument()
      // action_prompt
      expect(screen.getByText(/Thông số hoặc thói quen nào có thể chuyển đổi linh hoạt hơn/i)).toBeInTheDocument()
      // Nguyên tắc kỹ thuật gốc vẫn hiển thị
      expect(screen.getByText('Nguyên tắc Chuyển đổi thông số')).toBeInTheDocument()
      // Nguyên tắc #10 không có metadata -> fallback bình thường
      expect(screen.getByText('Nguyên tắc Tác động sơ bộ')).toBeInTheDocument()
    })
  })

  it('11. Accordion toggle everyday metadata có accessible name và aria-expanded', async () => {
    ;(apiClient.getTrizParameters as jest.Mock).mockResolvedValueOnce(MOCK_PARAMETERS_RESPONSE)
    ;(apiClient.lookupTrizMatrix as jest.Mock).mockResolvedValueOnce(MOCK_LOOKUP_OFF_DIAGONAL)
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <TrizMatrixLookup
          improvingParameter="temperature"
          worseningParameter="strength"
        />
      </QueryClientProvider>
    )

    // Chuyển sang lăng kính Đời sống để kiểm tra accordion toggle
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Đời sống/i })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /Đời sống/i }))

    await waitFor(() => {
      const toggleBtns = screen.getAllByRole('button', { name: /chi tiết đời sống|hướng dẫn đời thường|ví dụ & câu hỏi/i })
      expect(toggleBtns.length).toBeGreaterThan(0)
      const btn = toggleBtns[0]
      expect(btn).toHaveAttribute('aria-expanded')
      const isExp = btn.getAttribute('aria-expanded') === 'true'
      fireEvent.click(btn)
      expect(btn).toHaveAttribute('aria-expanded', String(!isExp))
    })
  })

  it('12. Bấm áp dụng nguyên tắc chỉ gọi callback onSelectPrinciple, không tự gọi API mutation', async () => {
    ;(apiClient.getTrizParameters as jest.Mock).mockResolvedValueOnce(MOCK_PARAMETERS_RESPONSE)
    ;(apiClient.lookupTrizMatrix as jest.Mock).mockResolvedValueOnce(MOCK_LOOKUP_OFF_DIAGONAL)
    const onSelectMock = jest.fn()
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <TrizMatrixLookup
          improvingParameter="temperature"
          worseningParameter="strength"
          onSelectPrinciple={onSelectMock}
        />
      </QueryClientProvider>
    )

    // Chuyển sang lăng kính Đời sống để hiển thị tên lăng kính tương ứng
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Đời sống/i })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /Đời sống/i }))

    await waitFor(() => {
      expect(screen.getByText(/Thay đổi tính chất/i)).toBeInTheDocument()
    })

    const applyBtns = screen.getAllByRole('button', { name: /áp dụng thành giải pháp|áp dụng nguyên tắc/i })
    fireEvent.click(applyBtns[0])

    expect(onSelectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 35,
        principle_id: 35,
      })
    )
  })
})
