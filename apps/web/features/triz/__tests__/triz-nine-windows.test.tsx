/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TrizNineWindows } from '../triz-nine-windows'
import * as apiClient from '@/lib/api-client'
import type { TrizNineWindowsLens, TrizNineWindowsResponse, NoteDraft } from '@/lib/types'

jest.mock('@/lib/api-client', () => ({
  getTrizNineWindows: jest.fn(),
}))

const mockedGetTrizNineWindows = apiClient.getTrizNineWindows as jest.MockedFunction<typeof apiClient.getTrizNineWindows>

const MOCK_ENGINEERING_DATA: TrizNineWindowsResponse = {
  lens: 'engineering',
  lens_title: 'Lăng kính Kỹ thuật & Công nghệ',
  grid: [
    {
      level: 'supersystem',
      time: 'past',
      label_vi: 'Hạ tầng kỹ thuật quá khứ',
      label_en: 'Past Supersystem',
      prompt_vi: 'Hệ thống hạ tầng trước đây giới hạn công nghệ thế nào?',
      description_vi: 'Mô tả hạ tầng quá khứ.',
      examples_vi: ['Đường ray xe lửa khổ hẹp'],
    },
    {
      level: 'supersystem',
      time: 'present',
      label_vi: 'Hạ tầng kỹ thuật hiện tại',
      label_en: 'Present Supersystem',
      prompt_vi: 'Mạng lưới viễn thông và lưới điện tương tác ra sao?',
      description_vi: 'Mô tả hạ tầng hiện tại.',
      examples_vi: ['Mạng 5G và trạm sạc xe điện'],
    },
    {
      level: 'supersystem',
      time: 'future',
      label_vi: 'Hạ tầng kỹ thuật tương lai',
      label_en: 'Future Supersystem',
      prompt_vi: 'Điện toán lượng tử và năng lượng phân tán đòi hỏi gì?',
      description_vi: 'Mô tả hạ tầng tương lai.',
      examples_vi: ['Lưới điện thông minh microgrid'],
    },
    {
      level: 'system',
      time: 'past',
      label_vi: 'Hệ thống kỹ thuật quá khứ',
      label_en: 'Past System',
      prompt_vi: 'Thiết kế ban đầu giải quyết mâu thuẫn bằng cơ chế nào?',
      description_vi: 'Mô tả hệ thống quá khứ.',
      examples_vi: ['Điện thoại thanh ăng-ten ngoài'],
    },
    {
      level: 'system',
      time: 'present',
      label_vi: 'Hệ thống kỹ thuật hiện tại',
      label_en: 'Present System',
      prompt_vi: 'Sản phẩm hiện tại gặp mâu thuẫn hiệu năng và chi phí nào?',
      description_vi: 'Mô tả hệ thống hiện tại.',
      examples_vi: ['Điện thoại thông minh màn hình OLED'],
    },
    {
      level: 'system',
      time: 'future',
      label_vi: 'Hệ thống kỹ thuật tương lai',
      label_en: 'Future System',
      prompt_vi: 'Hệ thống tự hòa tan chức năng vào môi trường như thế nào?',
      description_vi: 'Mô tả hệ thống tương lai.',
      examples_vi: ['Giao diện não máy không xâm lấn'],
    },
    {
      level: 'subsystem',
      time: 'past',
      label_vi: 'Phân hệ linh kiện quá khứ',
      label_en: 'Past Subsystem',
      prompt_vi: 'Linh kiện rời rạc trước đây gồm những gì?',
      description_vi: 'Mô tả phân hệ quá khứ.',
      examples_vi: ['Bóng đèn chân không triode'],
    },
    {
      level: 'subsystem',
      time: 'present',
      label_vi: 'Phân hệ linh kiện hiện tại',
      label_en: 'Present Subsystem',
      prompt_vi: 'Các cảm biến và chip bán dẫn phối hợp ra sao?',
      description_vi: 'Mô tả phân hệ hiện tại.',
      examples_vi: ['Cảm biến hình ảnh CMOS và chip 3nm'],
    },
    {
      level: 'subsystem',
      time: 'future',
      label_vi: 'Phân hệ linh kiện tương lai',
      label_en: 'Future Subsystem',
      prompt_vi: 'Vật liệu tự phục hồi sẽ thay thế linh kiện hiện tại ra sao?',
      description_vi: 'Mô tả phân hệ tương lai.',
      examples_vi: ['Mạch tích hợp quang tử học'],
    },
  ],
  meta: {
    total_windows: 9,
    system_levels: ['supersystem', 'system', 'subsystem'],
    time_horizons: ['past', 'present', 'future'],
  },
}

const MOCK_BUSINESS_DATA: TrizNineWindowsResponse = {
  ...MOCK_ENGINEERING_DATA,
  lens: 'business',
  lens_title: 'Lăng kính Kinh doanh & Thị trường',
  grid: MOCK_ENGINEERING_DATA.grid.map((cell) => ({
    ...cell,
    label_vi: `[Kinh doanh] ${cell.label_vi}`,
  })),
}

const MOCK_EVERYDAY_DATA: TrizNineWindowsResponse = {
  ...MOCK_ENGINEERING_DATA,
  lens: 'everyday',
  lens_title: 'Lăng kính Đời sống & Cá nhân',
  grid: MOCK_ENGINEERING_DATA.grid.map((cell) => ({
    ...cell,
    label_vi: `[Đời sống] ${cell.label_vi}`,
  })),
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

describe('TrizNineWindows Component (Batch C2 — Hardened RED Phase)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedGetTrizNineWindows.mockImplementation(
      (lens?: TrizNineWindowsLens) => {
        if (lens === 'business') return Promise.resolve(MOCK_BUSINESS_DATA)
        if (lens === 'everyday') return Promise.resolve(MOCK_EVERYDAY_DATA)
        return Promise.resolve(MOCK_ENGINEERING_DATA)
      }
    )
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('1. test_renders_nine_cells_in_canonical_order_and_semantics: render đúng 9 cell có role="article", aria-label đầy đủ và đúng thứ tự canonical', async () => {
    renderWithClient(<TrizNineWindows />)

    await waitFor(() => {
      expect(screen.getByText('Hạ tầng kỹ thuật quá khứ')).toBeInTheDocument()
    })

    const cells = screen.getAllByRole('article')
    expect(cells).toHaveLength(9)

    const expectedLabels = [
      'Siêu hệ thống • Quá khứ: Hạ tầng kỹ thuật quá khứ',
      'Siêu hệ thống • Hiện tại: Hạ tầng kỹ thuật hiện tại',
      'Siêu hệ thống • Tương lai: Hạ tầng kỹ thuật tương lai',
      'Hệ thống • Quá khứ: Hệ thống kỹ thuật quá khứ',
      'Hệ thống • Hiện tại: Hệ thống kỹ thuật hiện tại',
      'Hệ thống • Tương lai: Hệ thống kỹ thuật tương lai',
      'Phân hệ • Quá khứ: Phân hệ linh kiện quá khứ',
      'Phân hệ • Hiện tại: Phân hệ linh kiện hiện tại',
      'Phân hệ • Tương lai: Phân hệ linh kiện tương lai',
    ]

    expectedLabels.forEach((label, idx) => {
      expect(cells[idx]).toHaveAttribute('aria-label', label)
    })
  })

  it('2. test_displays_full_cell_content_across_all_nine_cells: kiểm tra label_vi, prompt_vi, description_vi trên cả 9 cell bằng within(cell)', async () => {
    renderWithClient(<TrizNineWindows />)

    await waitFor(() => {
      expect(screen.getByText('Hạ tầng kỹ thuật quá khứ')).toBeInTheDocument()
    })

    const cells = screen.getAllByRole('article')
    expect(cells).toHaveLength(9)

    MOCK_ENGINEERING_DATA.grid.forEach((expectedCell, idx) => {
      const cell = cells[idx]
      const cellWithin = within(cell)
      expect(cellWithin.getByText(expectedCell.label_vi)).toBeInTheDocument()
      expect(cellWithin.getByText(expectedCell.prompt_vi)).toBeInTheDocument()
      expect(cellWithin.getByText(expectedCell.description_vi)).toBeInTheDocument()
    })
  })

  it('3. test_default_lens_is_engineering: mặc định nút Kỹ thuật có aria-pressed=true và gọi API với lens=engineering', async () => {
    renderWithClient(<TrizNineWindows />)

    const engineeringBtn = screen.getByRole('button', { name: /Kỹ thuật/i })
    expect(engineeringBtn).toHaveAttribute('aria-pressed', 'true')

    await waitFor(() => {
      expect(mockedGetTrizNineWindows).toHaveBeenCalledWith('engineering')
    })
  })

  it('4. test_switch_lens_triggers_query_and_updates_content: chuyển đổi sang Kinh doanh và Đời sống gọi đúng query và cập nhật aria-pressed', async () => {
    renderWithClient(<TrizNineWindows />)

    await waitFor(() => {
      expect(screen.getByText('Hạ tầng kỹ thuật quá khứ')).toBeInTheDocument()
    })

    const businessBtn = screen.getByRole('button', { name: /Kinh doanh/i })
    fireEvent.click(businessBtn)

    expect(businessBtn).toHaveAttribute('aria-pressed', 'true')
    const engineeringBtn = screen.getByRole('button', { name: /Kỹ thuật/i })
    expect(engineeringBtn).toHaveAttribute('aria-pressed', 'false')

    await waitFor(() => {
      expect(mockedGetTrizNineWindows).toHaveBeenCalledWith('business')
      expect(screen.getByText('[Kinh doanh] Hạ tầng kỹ thuật quá khứ')).toBeInTheDocument()
    })

    const everydayBtn = screen.getByRole('button', { name: /Đời sống/i })
    fireEvent.click(everydayBtn)

    expect(everydayBtn).toHaveAttribute('aria-pressed', 'true')
    expect(businessBtn).toHaveAttribute('aria-pressed', 'false')

    await waitFor(() => {
      expect(mockedGetTrizNineWindows).toHaveBeenCalledWith('everyday')
      expect(screen.getByText('[Đời sống] Hạ tầng kỹ thuật quá khứ')).toBeInTheDocument()
    })
  })

  it('5. test_renders_examples_vi_when_present: cell có mảng ví dụ sẽ render danh sách ví dụ với role="list"', async () => {
    const customData: TrizNineWindowsResponse = {
      ...MOCK_ENGINEERING_DATA,
      grid: MOCK_ENGINEERING_DATA.grid.map((cell, idx) =>
        idx === 0
          ? { ...cell, examples_vi: ['Ví dụ A thực tế', 'Ví dụ B thực tế'] }
          : cell
      ),
    }
    mockedGetTrizNineWindows.mockResolvedValueOnce(customData)

    renderWithClient(<TrizNineWindows />)

    await waitFor(() => {
      expect(screen.getByText('Ví dụ A thực tế')).toBeInTheDocument()
      expect(screen.getByText('Ví dụ B thực tế')).toBeInTheDocument()
    })

    const firstCell = screen.getAllByRole('article')[0]
    expect(within(firstCell).getByRole('list')).toBeInTheDocument()
    expect(within(firstCell).getByText('Ví dụ A thực tế')).toBeInTheDocument()
    expect(within(firstCell).getByText('Ví dụ B thực tế')).toBeInTheDocument()
  })

  it('6. test_handles_empty_examples_vi_array_without_empty_container: examples_vi=[] không render container list rỗng', async () => {
    const customData: TrizNineWindowsResponse = {
      ...MOCK_ENGINEERING_DATA,
      grid: MOCK_ENGINEERING_DATA.grid.map((cell) => ({
        ...cell,
        examples_vi: [],
      })),
    }
    mockedGetTrizNineWindows.mockResolvedValueOnce(customData)

    renderWithClient(<TrizNineWindows />)

    await waitFor(() => {
      expect(screen.getByText('Hạ tầng kỹ thuật quá khứ')).toBeInTheDocument()
    })

    const cells = screen.getAllByRole('article')
    cells.forEach((cell) => {
      expect(within(cell).queryByRole('list')).not.toBeInTheDocument()
      expect(within(cell).queryByText(/Ví dụ/i)).not.toBeInTheDocument()
    })
  })

  it('7. test_handles_omitted_examples_vi_without_empty_container: examples_vi=undefined không render container rỗng', async () => {
    const customData: TrizNineWindowsResponse = {
      ...MOCK_ENGINEERING_DATA,
      grid: MOCK_ENGINEERING_DATA.grid.map((cell) => {
        const { examples_vi: _, ...rest } = cell
        return rest
      }),
    }
    mockedGetTrizNineWindows.mockResolvedValueOnce(customData)

    renderWithClient(<TrizNineWindows />)

    await waitFor(() => {
      expect(screen.getByText('Hạ tầng kỹ thuật quá khứ')).toBeInTheDocument()
    })

    const cells = screen.getAllByRole('article')
    cells.forEach((cell) => {
      expect(within(cell).queryByRole('list')).not.toBeInTheDocument()
    })
  })

  it('8. test_renders_optional_label_en_when_present: có label_en thì hiển thị subtitle tiếng Anh', async () => {
    const customData: TrizNineWindowsResponse = {
      ...MOCK_ENGINEERING_DATA,
      grid: MOCK_ENGINEERING_DATA.grid.map((cell, idx) =>
        idx === 0 ? { ...cell, label_en: 'Past Supersystem Infrastructure' } : cell
      ),
    }
    mockedGetTrizNineWindows.mockResolvedValueOnce(customData)

    renderWithClient(<TrizNineWindows />)

    await waitFor(() => {
      expect(screen.getByText('Past Supersystem Infrastructure')).toBeInTheDocument()
    })

    const firstCell = screen.getAllByRole('article')[0]
    expect(within(firstCell).getByText('Past Supersystem Infrastructure')).toBeInTheDocument()
  })

  it('9. test_omits_label_en_when_absent_without_placeholder: không có label_en thì không render placeholder hay "undefined"', async () => {
    const customData: TrizNineWindowsResponse = {
      ...MOCK_ENGINEERING_DATA,
      grid: MOCK_ENGINEERING_DATA.grid.map((cell) => {
        const { label_en: _, ...rest } = cell
        return rest
      }),
    }
    mockedGetTrizNineWindows.mockResolvedValueOnce(customData)

    renderWithClient(<TrizNineWindows />)

    await waitFor(() => {
      expect(screen.getByText('Hạ tầng kỹ thuật quá khứ')).toBeInTheDocument()
    })

    const cells = screen.getAllByRole('article')
    cells.forEach((cell) => {
      expect(within(cell).queryByText('undefined')).not.toBeInTheDocument()
    })
  })

  it('10. test_loading_state_displays_skeleton: hiển thị skeleton loading với data-testid="nine-windows-loading"', () => {
    mockedGetTrizNineWindows.mockImplementation(() => new Promise(() => {}))

    renderWithClient(<TrizNineWindows />)

    expect(screen.getByTestId('nine-windows-loading')).toBeInTheDocument()
  })

  it('11. test_error_state_displays_alert_and_retry_on_generic_error: lỗi mạng hiển thị alert data-testid="nine-windows-error" và nút retry', async () => {
    mockedGetTrizNineWindows.mockRejectedValueOnce(new Error('Network timeout'))

    renderWithClient(<TrizNineWindows />)

    await waitFor(() => {
      expect(screen.getByTestId('nine-windows-error')).toBeInTheDocument()
    })

    const retryBtn = screen.getByRole('button', { name: /Thử lại/i })
    expect(retryBtn).toBeInTheDocument()

    mockedGetTrizNineWindows.mockResolvedValueOnce(MOCK_ENGINEERING_DATA)
    fireEvent.click(retryBtn)

    await waitFor(() => {
      expect(screen.getByText('Hạ tầng kỹ thuật quá khứ')).toBeInTheDocument()
    })
  })

  it('12. test_error_state_handles_axios_422_error_and_allows_retry: lỗi 422 hiển thị thông báo phù hợp và phục hồi khi click retry', async () => {
    const axiosError422 = {
      isAxiosError: true,
      name: 'AxiosError',
      message: 'Request failed with status code 422',
      response: {
        status: 422,
        statusText: 'Unprocessable Entity',
        data: {
          detail: [
            {
              loc: ['query', 'lens'],
              msg: "Input should be 'engineering', 'business' or 'everyday'",
            },
          ],
        },
      },
    }
    mockedGetTrizNineWindows.mockRejectedValueOnce(axiosError422)

    renderWithClient(<TrizNineWindows />)

    await waitFor(() => {
      expect(screen.getByTestId('nine-windows-error')).toBeInTheDocument()
    })

    const errorAlert = screen.getByTestId('nine-windows-error')
    expect(errorAlert).toBeInTheDocument()

    const retryBtn = screen.getByRole('button', { name: /Thử lại/i })
    expect(retryBtn).toBeInTheDocument()

    mockedGetTrizNineWindows.mockResolvedValueOnce(MOCK_ENGINEERING_DATA)
    fireEvent.click(retryBtn)

    await waitFor(() => {
      expect(screen.getByText('Hạ tầng kỹ thuật quá khứ')).toBeInTheDocument()
    })
  })

  describe('13. Notebook Integration (Batch C3b)', () => {
    it('test_does_not_render_save_note_buttons_without_callback: không truyền onSaveAsNote thì không có nút Lưu vào sổ tay', async () => {
      mockedGetTrizNineWindows.mockResolvedValueOnce(MOCK_ENGINEERING_DATA)
      renderWithClient(<TrizNineWindows />)

      await waitFor(() => {
        expect(screen.getAllByRole('article')).toHaveLength(9)
      })

      expect(screen.queryByRole('button', { name: /lưu vào sổ tay/i })).not.toBeInTheDocument()
    })

    it('test_renders_save_note_buttons_when_callback_provided: truyền onSaveAsNote thì có đúng 9 nút Lưu vào sổ tay', async () => {
      mockedGetTrizNineWindows.mockResolvedValueOnce(MOCK_ENGINEERING_DATA)
      const onSaveAsNote = jest.fn()
      renderWithClient(<TrizNineWindows onSaveAsNote={onSaveAsNote} />)

      await waitFor(() => {
        expect(screen.getAllByRole('article')).toHaveLength(9)
      })

      const saveButtons = screen.getAllByRole('button', { name: /lưu vào sổ tay/i })
      expect(saveButtons).toHaveLength(9)
    })

    it('test_saves_selected_cell_as_insight_draft: click nút lưu của một cell xác định sẽ gọi callback với NoteDraft chuẩn xác', async () => {
      mockedGetTrizNineWindows.mockResolvedValueOnce(MOCK_ENGINEERING_DATA)
      const onSaveAsNote = jest.fn()
      renderWithClient(<TrizNineWindows onSaveAsNote={onSaveAsNote} />)

      await waitFor(() => {
        expect(screen.getAllByRole('article')).toHaveLength(9)
      })

      const saveButtons = screen.getAllByRole('button', { name: /lưu vào sổ tay/i })
      fireEvent.click(saveButtons[0])

      expect(onSaveAsNote).toHaveBeenCalledTimes(1)
      const draft: NoteDraft = onSaveAsNote.mock.calls[0][0]
      expect(draft.note_type).toBe('insight')
      expect(draft.source_chunk_id).toBeNull()
      expect(draft.content).toContain('Lăng kính Kỹ thuật & Công nghệ')
      expect(draft.content).toContain('Siêu hệ thống')
      expect(draft.content).toContain('Quá khứ')
      expect(draft.content).toContain('Hạ tầng kỹ thuật quá khứ')
      expect(draft.content).toContain('Hệ thống hạ tầng trước đây giới hạn công nghệ thế nào?')
      expect(draft.content).toContain('Mô tả hạ tầng quá khứ.')
      expect(draft.content).toContain('Ví dụ: Đường ray xe lửa khổ hẹp')
    })

    it('test_omits_examples_section_when_empty: examples_vi=[] thì content không chứa "Ví dụ:"', async () => {
      const mockDataWithoutExamples: TrizNineWindowsResponse = {
        ...MOCK_ENGINEERING_DATA,
        grid: MOCK_ENGINEERING_DATA.grid.map((c, i) => (i === 0 ? { ...c, examples_vi: [] } : c)),
      }
      mockedGetTrizNineWindows.mockResolvedValueOnce(mockDataWithoutExamples)
      const onSaveAsNote = jest.fn()
      renderWithClient(<TrizNineWindows onSaveAsNote={onSaveAsNote} />)

      await waitFor(() => {
        expect(screen.getAllByRole('article')).toHaveLength(9)
      })

      const saveButtons = screen.getAllByRole('button', { name: /lưu vào sổ tay/i })
      fireEvent.click(saveButtons[0])

      expect(onSaveAsNote).toHaveBeenCalledTimes(1)
      const draft: NoteDraft = onSaveAsNote.mock.calls[0][0]
      expect(draft.content).not.toContain('Ví dụ:')
    })

    it('test_omits_examples_section_when_missing: examples_vi undefined thì content không chứa "Ví dụ:"', async () => {
      const mockDataMissingExamples: TrizNineWindowsResponse = {
        ...MOCK_ENGINEERING_DATA,
        grid: MOCK_ENGINEERING_DATA.grid.map((c, i) => (i === 0 ? { ...c, examples_vi: undefined } : c)),
      }
      mockedGetTrizNineWindows.mockResolvedValueOnce(mockDataMissingExamples)
      const onSaveAsNote = jest.fn()
      renderWithClient(<TrizNineWindows onSaveAsNote={onSaveAsNote} />)

      await waitFor(() => {
        expect(screen.getAllByRole('article')).toHaveLength(9)
      })

      const saveButtons = screen.getAllByRole('button', { name: /lưu vào sổ tay/i })
      fireEvent.click(saveButtons[0])

      expect(onSaveAsNote).toHaveBeenCalledTimes(1)
      const draft: NoteDraft = onSaveAsNote.mock.calls[0][0]
      expect(draft.content).not.toContain('Ví dụ:')
    })

    it('test_save_button_has_unique_accessible_name: mỗi nút lưu có aria-label định danh riêng, không trùng lặp', async () => {
      mockedGetTrizNineWindows.mockResolvedValueOnce(MOCK_ENGINEERING_DATA)
      const onSaveAsNote = jest.fn()
      renderWithClient(<TrizNineWindows onSaveAsNote={onSaveAsNote} />)

      await waitFor(() => {
        expect(screen.getAllByRole('article')).toHaveLength(9)
      })

      const saveButtons = screen.getAllByRole('button', { name: /lưu vào sổ tay/i })
      expect(saveButtons).toHaveLength(9)

      const accessibleNames = saveButtons.map((btn) => btn.getAttribute('aria-label') || btn.textContent)
      accessibleNames.forEach((name) => {
        expect(name).toBeTruthy()
        expect(name).toMatch(/lưu vào sổ tay/i)
      })
      const uniqueNames = new Set(accessibleNames)
      expect(uniqueNames.size).toBe(9)
    })
  })
})
