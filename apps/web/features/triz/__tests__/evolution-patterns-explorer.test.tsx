/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { EvolutionPatternsExplorer } from '../evolution-patterns-explorer'
import * as apiClient from '@/lib/api-client'
import type { TrizEvolutionResponse } from '@/lib/types'

jest.mock('@/lib/api-client', () => ({
  getTrizEvolutionTrends: jest.fn(),
}))

const mockedGetTrizEvolutionTrends = apiClient.getTrizEvolutionTrends as jest.MockedFunction<typeof apiClient.getTrizEvolutionTrends>

const MOCK_EVOLUTION_RESPONSE: TrizEvolutionResponse = {
  data: [
    {
      trend_id: 'TREND_1_COMPLETENESS',
      name_vi: 'Quy luật về tính đầy đủ của các bộ phận trong hệ thống',
      name_en: 'Trend of Completeness of Parts of the System',
      description: 'Hệ thống kỹ thuật độc lập phải bao gồm tối thiểu 4 bộ phận cơ bản.',
      evolution_stages: ['Hệ thống thủ công', 'Cơ khí hóa', 'Tự động hóa'],
      domain_examples: {
        engineering: 'Xe ngựa -> Xe hơi động cơ đốt trong -> Xe điện tự lái',
        software: 'Script thủ công -> CI/CD pipeline -> Autonomous agent',
      },
    },
    {
      trend_id: 'TREND_2_ENERGY_CONDUCTIVITY',
      name_vi: 'Quy luật về khả năng dẫn truyền năng lượng của hệ thống',
      name_en: 'Trend of Energy Conductivity of the System',
      description: 'Dòng năng lượng phải lưu thông tự do qua mọi bộ phận của hệ thống.',
      evolution_stages: ['Truyền dẫn cơ học', 'Truyền dẫn thủy lực', 'Điện từ'],
      domain_examples: {
        engineering: 'Bánh răng truyền động -> Dây cáp điện -> Truyền sạc không dây',
      },
    },
    {
      trend_id: 'TREND_3_COORDINATION_RHYTHMS',
      name_vi: 'Quy luật điều phối nhịp điệu (đồng bộ tần số)',
      name_en: 'Trend of Harmonization of Rhythms',
      description: 'Tần số dao động và nhịp điệu hoạt động giữa các bộ phận phải phối hợp hài hòa.',
      evolution_stages: ['Không đồng bộ', 'Đồng bộ tần số', 'Cộng hưởng thích nghi'],
      domain_examples: {
        engineering: 'Búa đập đơn -> Búa rung tần số cao',
      },
    },
    {
      trend_id: 'TREND_4_INCREASING_IDEALITY',
      name_vi: 'Quy luật nâng cao mức độ lý tưởng (Ideality)',
      name_en: 'Trend of Increasing Ideality',
      description: 'Tỷ số giữa tổng lợi ích (chức năng hữu ích) trên tổng chi phí và tác hại tiến dần đến vô cực.',
      evolution_stages: ['Hệ thống cồng kềnh', 'Tối ưu hóa', 'Hệ thống biến mất chỉ còn chức năng'],
      domain_examples: {
        engineering: 'Cân đòn cơ -> Cân điện tử cảm ứng -> Cảm biến tích hợp',
      },
    },
    {
      trend_id: 'TREND_5_UNEVEN_DEVELOPMENT',
      name_vi: 'Quy luật phát triển không đều giữa các bộ phận',
      name_en: 'Trend of Uneven Development of Subsystems',
      description: 'Các bộ phận khác nhau trong một hệ thống phát triển với tốc độ khác nhau dẫn đến mâu thuẫn kỹ thuật.',
      evolution_stages: ['Động cơ đi trước vật liệu', 'Hạ tầng đuổi theo thiết bị'],
      domain_examples: {
        engineering: 'Động cơ máy bay phản lực đòi hỏi hợp kim siêu chịu nhiệt',
      },
    },
    {
      trend_id: 'TREND_6_TRANSITION_TO_SUPERSYSTEM',
      name_vi: 'Quy luật chuyển đổi sang Siêu hệ thống (Supersystem)',
      name_en: 'Trend of Transition to Supersystem',
      description: 'Khi một hệ thống cạn kiệt tiềm năng phát triển đơn lẻ, nó kết hợp với các hệ thống khác.',
      evolution_stages: ['Đơn hệ', 'Hệ thống kép/đa hệ', 'Tích hợp siêu hệ thống'],
      domain_examples: {
        engineering: 'Điện thoại đơn năng -> Smartphone tích hợp máy ảnh, GPS, thanh toán',
      },
    },
    {
      trend_id: 'TREND_7_TRANSITION_MACRO_TO_MICRO',
      name_vi: 'Quy luật chuyển dịch từ mức độ Vĩ mô sang Vi mô (Macro to Micro)',
      name_en: 'Trend of Transition from Macro to Micro Level',
      description: 'Sự dịch chuyển từ cơ chế cơ học vĩ mô sang cơ chế vi mô: phân tử, nguyên tử, trường lực.',
      evolution_stages: ['Cơ học thô', 'Hạt mịn/bột', 'Chất lỏng/khí', 'Trường vật lý/plasma'],
      domain_examples: {
        engineering: 'Khoan cơ khí -> Khoan siêu âm -> Cắt laser/tia nước áp lực cao',
      },
    },
    {
      trend_id: 'TREND_8_INCREASING_DYNAMISM',
      name_vi: 'Quy luật tăng tính động (Dynamism và Khả năng điều khiển)',
      name_en: 'Trend of Increasing Dynamism and Controllability',
      description: 'Hệ thống cứng nhắc trở nên linh hoạt, có khớp nối, biến hình và tự thích nghi với môi trường.',
      evolution_stages: ['Hệ thống cứng bất động', 'Hệ thống có một khớp nối', 'Đa khớp nối', 'Hệ thống đàn hồi linh hoạt'],
      domain_examples: {
        engineering: 'Thước kẻ gỗ cứng -> Thước cuộn lá thép -> Thước đo laser điện tử',
      },
    },
  ],
  total_trends: 8,
}

function renderComponent(props: Partial<React.ComponentProps<typeof EvolutionPatternsExplorer>> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <EvolutionPatternsExplorer {...props} />
    </QueryClientProvider>
  )
}

describe('EvolutionPatternsExplorer Component (Batch C34 — 8 Evolution Trends)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('test_renders_eight_classic_trends', async () => {
    mockedGetTrizEvolutionTrends.mockResolvedValueOnce(MOCK_EVOLUTION_RESPONSE)
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('8 Quy luật Tiến hóa Kỹ thuật (Altshuller)')).toBeInTheDocument()
    })

    // Assert strictly 8 trends rendered
    expect(screen.getByText('Quy luật về tính đầy đủ của các bộ phận trong hệ thống')).toBeInTheDocument()
    expect(screen.getByText('Quy luật về khả năng dẫn truyền năng lượng của hệ thống')).toBeInTheDocument()
    expect(screen.getByText('Quy luật điều phối nhịp điệu (đồng bộ tần số)')).toBeInTheDocument()
    expect(screen.getByText('Quy luật nâng cao mức độ lý tưởng (Ideality)')).toBeInTheDocument()
    expect(screen.getByText('Quy luật phát triển không đều giữa các bộ phận')).toBeInTheDocument()
    expect(screen.getByText('Quy luật chuyển đổi sang Siêu hệ thống (Supersystem)')).toBeInTheDocument()
    expect(screen.getByText('Quy luật chuyển dịch từ mức độ Vĩ mô sang Vi mô (Macro to Micro)')).toBeInTheDocument()
    expect(screen.getByText('Quy luật tăng tính động (Dynamism và Khả năng điều khiển)')).toBeInTheDocument()
  })

  test('test_expand_trend_stages_and_domain_examples', async () => {
    mockedGetTrizEvolutionTrends.mockResolvedValueOnce(MOCK_EVOLUTION_RESPONSE)
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Quy luật về tính đầy đủ của các bộ phận trong hệ thống')).toBeInTheDocument()
    })

    // Click on trend 1 to expand
    const trendBtn = screen.getByText('Quy luật về tính đầy đủ của các bộ phận trong hệ thống')
    fireEvent.click(trendBtn)

    // Stages should be visible
    expect(screen.getByText('Hệ thống thủ công')).toBeInTheDocument()
    expect(screen.getByText('Cơ khí hóa')).toBeInTheDocument()
    expect(screen.getByText('Tự động hóa')).toBeInTheDocument()

    // Domain examples visible
    expect(screen.getByText(/Xe ngựa -> Xe hơi động cơ đốt trong/i)).toBeInTheDocument()
  })

  test('test_calls_onSaveAsNote_with_correct_triz_evolution_context', async () => {
    mockedGetTrizEvolutionTrends.mockResolvedValueOnce(MOCK_EVOLUTION_RESPONSE)
    const onSaveAsNote = jest.fn()
    renderComponent({ onSaveAsNote })

    await waitFor(() => {
      expect(screen.getByText('Quy luật về tính đầy đủ của các bộ phận trong hệ thống')).toBeInTheDocument()
    })

    // Expand trend 1
    const trendBtn = screen.getByText('Quy luật về tính đầy đủ của các bộ phận trong hệ thống')
    fireEvent.click(trendBtn)

    const textarea = screen.getByPlaceholderText(/Ghi chú định hướng tiến hóa cho hệ thống/i)
    fireEvent.change(textarea, { target: { value: 'Chuyển từ tự động hóa sang agentic AI tự hành' } })

    const saveBtn = screen.getByRole('button', { name: /Lưu vào sổ tay/i })
    fireEvent.click(saveBtn)

    expect(onSaveAsNote).toHaveBeenCalledTimes(1)
    const callArg = onSaveAsNote.mock.calls[0][0]
    expect(callArg.note_type).toBe('insight')
    expect(callArg.content).toContain('Quy luật về tính đầy đủ của các bộ phận trong hệ thống')
    expect(callArg.content).toContain('Chuyển từ tự động hóa sang agentic AI tự hành')
    expect(callArg.source_context).toEqual({
      schema_version: 1,
      source_type: 'triz_evolution',
      trend_id: 'TREND_1_COMPLETENESS',
      trend_name: 'Quy luật về tính đầy đủ của các bộ phận trong hệ thống',
    })
  })

  test('test_handles_error_state_with_retry', async () => {
    mockedGetTrizEvolutionTrends.mockRejectedValueOnce(new Error('Network error'))
    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('evolution-patterns-error')).toBeInTheDocument()
    })

    mockedGetTrizEvolutionTrends.mockResolvedValueOnce(MOCK_EVOLUTION_RESPONSE)
    const retryBtn = screen.getByRole('button', { name: /Thử lại/i })
    fireEvent.click(retryBtn)

    await waitFor(() => {
      expect(screen.getByText('8 Quy luật Tiến hóa Kỹ thuật (Altshuller)')).toBeInTheDocument()
    })
  })
})
