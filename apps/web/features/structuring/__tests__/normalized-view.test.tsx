/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NormalizedView } from '../normalized-view'
import * as apiClient from '@/lib/api-client'
import type { ProblemFrame, TrizNineWindowsResponse } from '@/lib/types'

jest.mock('@/lib/api-client', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/api-client'),
  getTrizNineWindows: jest.fn(),
}))

const mockedGetTrizNineWindows = apiClient.getTrizNineWindows as jest.MockedFunction<typeof apiClient.getTrizNineWindows>

const MOCK_NINE_WINDOWS_RESPONSE: TrizNineWindowsResponse = {
  lens: 'engineering',
  lens_title: 'Lăng kính Kỹ thuật & Công nghệ',
  grid: [
    {
      level: 'supersystem',
      time: 'past',
      label_vi: 'Siêu hệ thống quá khứ',
      label_en: 'Past Supersystem',
      prompt_vi: 'Hạ tầng trước đây thế nào?',
      description_vi: 'Bối cảnh hạ tầng lịch sử.',
      examples_vi: ['Hệ thống đường ray thế kỷ 19'],
    },
    {
      level: 'supersystem',
      time: 'present',
      label_vi: 'Siêu hệ thống hiện tại',
      label_en: 'Present Supersystem',
      prompt_vi: 'Hạ tầng hiện tại thế nào?',
      description_vi: 'Bối cảnh hạ tầng hiện tại.',
      examples_vi: ['Lưới điện 5G'],
    },
    {
      level: 'supersystem',
      time: 'future',
      label_vi: 'Siêu hệ thống tương lai',
      label_en: 'Future Supersystem',
      prompt_vi: 'Hạ tầng tương lai thế nào?',
      description_vi: 'Bối cảnh hạ tầng tương lai.',
      examples_vi: ['Microgrid vệ tinh'],
    },
    {
      level: 'system',
      time: 'past',
      label_vi: 'Hệ thống quá khứ',
      label_en: 'Past System',
      prompt_vi: 'Hệ thống ban đầu hoạt động ra sao?',
      description_vi: 'Cơ chế cơ học cũ.',
      examples_vi: ['Điện thoại dạng thanh'],
    },
    {
      level: 'system',
      time: 'present',
      label_vi: 'Hệ thống hiện tại',
      label_en: 'Present System',
      prompt_vi: 'Hệ thống hiện tại giải quyết mâu thuẫn gì?',
      description_vi: 'Thiết kế hiện tại.',
      examples_vi: ['Điện thoại thông minh màn hình gập'],
    },
    {
      level: 'system',
      time: 'future',
      label_vi: 'Hệ thống tương lai',
      label_en: 'Future System',
      prompt_vi: 'Hệ thống lý tưởng tương lai thế nào?',
      description_vi: 'Hòa tan vào môi trường.',
      examples_vi: ['Giao diện não máy sinh học'],
    },
    {
      level: 'subsystem',
      time: 'past',
      label_vi: 'Phân hệ quá khứ',
      label_en: 'Past Subsystem',
      prompt_vi: 'Linh kiện cũ gồm những gì?',
      description_vi: 'Cơ cấu cơ học rời rạc.',
      examples_vi: ['Bóng đèn chân không'],
    },
    {
      level: 'subsystem',
      time: 'present',
      label_vi: 'Phân hệ hiện tại',
      label_en: 'Present Subsystem',
      prompt_vi: 'Linh kiện hiện tại nghẽn ở đâu?',
      description_vi: 'Vi xử lý và cảm biến.',
      examples_vi: ['Chip bán dẫn 3nm'],
    },
    {
      level: 'subsystem',
      time: 'future',
      label_vi: 'Phân hệ tương lai',
      label_en: 'Future Subsystem',
      prompt_vi: 'Vật liệu tương lai thay thế linh kiện ra sao?',
      description_vi: 'Vật liệu tự phục hồi.',
      examples_vi: ['Mạch quang tử học'],
    },
  ],
  meta: {
    total_windows: 9,
    system_levels: ['supersystem', 'system', 'subsystem'],
    time_horizons: ['past', 'present', 'future'],
  },
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  )
}

describe('NormalizedView — TRIZ 9-Windows Integration (Batch C3a: RED Phase)', () => {
  const mockProblemFrame: ProblemFrame = {
    id: 'frame-test-001',
    session_id: 'ses-test-001',
    raw_statement: 'Cần nâng cao độ bền cánh tay robot nhưng không làm tăng khối lượng',
    normalized_statement: 'Tăng độ bền cơ học trong khi duy trì hoặc giảm khối lượng tổng thể',
    contradiction_type: 'technical',
    improving_parameter: 'Độ bền / Độ cứng',
    worsening_parameter: 'Trọng lượng vật thể',
    domain: 'technical',
    created_at: '2026-03-15T09:00:00Z',
  }

  const mockBusinessFrame: ProblemFrame = {
    ...mockProblemFrame,
    domain: 'business',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockedGetTrizNineWindows.mockResolvedValue(MOCK_NINE_WINDOWS_RESPONSE)
  })

  it('1. test_does_not_render_nine_windows_when_collapsed: mặc định collapsible đóng, không có cell article và không gọi API', () => {
    renderWithClient(<NormalizedView problemFrame={mockProblemFrame} />)

    // Khối điều khiển collapsible phải tồn tại
    const toggleButton = screen.getByRole('button', {
      name: /Mở rộng góc nhìn hệ thống đa chiều \(TRIZ 9-Windows\)|TRIZ 9-Windows/i,
    })
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false')

    // Nội dung 9 ô không được xuất hiện
    expect(screen.queryByRole('article')).not.toBeInTheDocument()

    // API không được gọi khi section đóng
    expect(mockedGetTrizNineWindows).not.toHaveBeenCalled()
  })

  it('2. test_expands_nine_windows_and_fetches_engineering_lens: mở section render 9-Windows và gọi lens=engineering mà không gửi text bài toán', async () => {
    renderWithClient(<NormalizedView problemFrame={mockProblemFrame} />)

    const toggleButton = screen.getByRole('button', {
      name: /Mở rộng góc nhìn hệ thống đa chiều \(TRIZ 9-Windows\)|TRIZ 9-Windows/i,
    })
    fireEvent.click(toggleButton)

    // Đã gọi API với lens mặc định engineering
    expect(mockedGetTrizNineWindows).toHaveBeenCalledTimes(1)
    expect(mockedGetTrizNineWindows).toHaveBeenCalledWith('engineering')

    // Chờ 9 ô cửa sổ hiển thị
    await waitFor(() => {
      expect(screen.getAllByRole('article')).toHaveLength(9)
    })

    // Xác nhận không truyền nội dung ProblemFrame vào API call
    expect(mockedGetTrizNineWindows).not.toHaveBeenCalledWith(
      expect.stringContaining('cánh tay robot')
    )
  })

  it('3. test_collapse_hides_nine_windows_content: mở rồi đóng lại sẽ gỡ bỏ hoàn toàn nội dung 9-Windows khỏi DOM', async () => {
    renderWithClient(<NormalizedView problemFrame={mockProblemFrame} />)

    const toggleButton = screen.getByRole('button', {
      name: /Mở rộng góc nhìn hệ thống đa chiều \(TRIZ 9-Windows\)|TRIZ 9-Windows/i,
    })

    // Mở
    fireEvent.click(toggleButton)
    await waitFor(() => {
      expect(screen.getAllByRole('article')).toHaveLength(9)
    })

    // Đóng
    fireEvent.click(toggleButton)
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })

  it('4. test_does_not_map_session_domain_to_lens: dù domain là business, lần mở đầu tiên vẫn luôn gọi lens="engineering"', async () => {
    renderWithClient(<NormalizedView problemFrame={mockBusinessFrame} />)

    const toggleButton = screen.getByRole('button', {
      name: /Mở rộng góc nhìn hệ thống đa chiều \(TRIZ 9-Windows\)|TRIZ 9-Windows/i,
    })
    fireEvent.click(toggleButton)

    expect(mockedGetTrizNineWindows).toHaveBeenCalledWith('engineering')
    expect(mockedGetTrizNineWindows).not.toHaveBeenCalledWith('business')
  })

  it('5. test_has_accessible_expand_control: nút điều khiển có accessible name rõ ràng và aria-expanded phản ánh chính xác', () => {
    renderWithClient(<NormalizedView problemFrame={mockProblemFrame} />)

    const toggleButton = screen.getByRole('button', {
      name: /Mở rộng góc nhìn hệ thống đa chiều \(TRIZ 9-Windows\)|TRIZ 9-Windows/i,
    })
    expect(toggleButton).toBeInTheDocument()
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(toggleButton)
    expect(toggleButton).toHaveAttribute('aria-expanded', 'true')
  })

  it('6. test_does_not_render_save_note_control: không có nút lưu vào Notebook hoặc callback onSaveAsNote trong C3a', async () => {
    renderWithClient(<NormalizedView problemFrame={mockProblemFrame} />)

    const toggleButton = screen.getByRole('button', {
      name: /Mở rộng góc nhìn hệ thống đa chiều \(TRIZ 9-Windows\)|TRIZ 9-Windows/i,
    })
    fireEvent.click(toggleButton)

    await waitFor(() => {
      expect(screen.getAllByRole('article')).toHaveLength(9)
    })

    expect(screen.queryByRole('button', { name: /Lưu vào Notebook|Lưu ghi chú/i })).not.toBeInTheDocument()
  })

  describe('7. 9-Windows Notebook Integration (Batch C3b)', () => {
    it('test_does_not_render_save_note_buttons_without_callback: không truyền onSaveAsNote thì không có nút Lưu vào sổ tay', async () => {
      renderWithClient(<NormalizedView problemFrame={mockProblemFrame} />)

      const toggleButton = screen.getByRole('button', {
        name: /Mở rộng góc nhìn hệ thống đa chiều \(TRIZ 9-Windows\)|TRIZ 9-Windows/i,
      })
      fireEvent.click(toggleButton)

      await waitFor(() => {
        expect(screen.getAllByRole('article')).toHaveLength(9)
      })

      expect(screen.queryByRole('button', { name: /lưu vào sổ tay/i })).not.toBeInTheDocument()
    })

    it('test_passes_save_note_callback_to_nine_windows: truyền onSaveAsNote thì truyền tiếp xuống TrizNineWindows và gọi callback khi click', async () => {
      const onSaveAsNote = jest.fn()
      renderWithClient(<NormalizedView problemFrame={mockProblemFrame} onSaveAsNote={onSaveAsNote} />)

      const toggleButton = screen.getByRole('button', {
        name: /Mở rộng góc nhìn hệ thống đa chiều \(TRIZ 9-Windows\)|TRIZ 9-Windows/i,
      })
      fireEvent.click(toggleButton)

      await waitFor(() => {
        expect(screen.getAllByRole('article')).toHaveLength(9)
      })

      const saveButtons = screen.getAllByRole('button', { name: /lưu vào sổ tay/i })
      expect(saveButtons).toHaveLength(9)

      fireEvent.click(saveButtons[0])
      expect(onSaveAsNote).toHaveBeenCalledTimes(1)
      expect(onSaveAsNote).toHaveBeenCalledWith(
        expect.objectContaining({
          note_type: 'insight',
          source_chunk_id: null,
          content: expect.stringContaining('Siêu hệ thống'),
        })
      )
    })

    it('test_standalone_behavior_remains_read_only: khi không truyền callback, mở collapsible vẫn thuần read-only', async () => {
      renderWithClient(<NormalizedView problemFrame={mockProblemFrame} />)

      const toggleButton = screen.getByRole('button', {
        name: /Mở rộng góc nhìn hệ thống đa chiều \(TRIZ 9-Windows\)|TRIZ 9-Windows/i,
      })
      fireEvent.click(toggleButton)

      await waitFor(() => {
        expect(screen.getAllByRole('article')).toHaveLength(9)
      })

      expect(screen.queryByRole('button', { name: /lưu vào sổ tay/i })).not.toBeInTheDocument()
    })
  })
})
