/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TrizNineWindows } from '../triz-nine-windows'
import * as apiClient from '@/lib/api-client'
import type { TrizNineWindowsResponse } from '@/lib/types'

jest.mock('@/lib/api-client', () => ({
  getTrizNineWindows: jest.fn(),
}))

const mockedGetTrizNineWindows = apiClient.getTrizNineWindows as jest.MockedFunction<
  typeof apiClient.getTrizNineWindows
>

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = createTestQueryClient()
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

const MOCK_ENGINEERING_GRID: TrizNineWindowsResponse = {
  lens: 'engineering',
  lens_title: 'Lăng kính Kỹ thuật & Công nghệ',
  meta: {
    total_windows: 9,
    system_levels: ['supersystem', 'system', 'subsystem'],
    time_horizons: ['past', 'present', 'future'],
  },
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
      examples_vi: ['Mạch điện tử hữu cơ có thể tự tiêu hủy'],
    },
  ],
}

const MOCK_BUSINESS_GRID: TrizNineWindowsResponse = {
  lens: 'business',
  lens_title: 'Lăng kính Kinh doanh & Thị trường',
  meta: MOCK_ENGINEERING_GRID.meta,
  grid: MOCK_ENGINEERING_GRID.grid.map((c) => ({
    ...c,
    label_vi: `Thị trường ${c.level} - ${c.time}`,
  })),
}

const MOCK_EVERYDAY_GRID: TrizNineWindowsResponse = {
  lens: 'everyday',
  lens_title: 'Lăng kính Đời sống Thường nhật',
  meta: MOCK_ENGINEERING_GRID.meta,
  grid: MOCK_ENGINEERING_GRID.grid.map((c) => ({
    ...c,
    label_vi: `Đời sống ${c.level} - ${c.time}`,
  })),
}

describe('Pilot C7c-2a: TrizNineWindows source_context Transmission', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // Nhóm 1: Cell save tạo đúng context đủ schema_version, lens, level, time, cell_label
  it('Nhóm 1: click lưu một cell tạo đúng source_context với đủ các trường chuẩn backend schema', async () => {
    mockedGetTrizNineWindows.mockResolvedValueOnce(MOCK_ENGINEERING_GRID)
    const onSaveAsNote = jest.fn()
    renderWithClient(<TrizNineWindows onSaveAsNote={onSaveAsNote} initialLens="engineering" />)

    await waitFor(() => {
      expect(screen.getAllByRole('article')).toHaveLength(9)
    })

    const saveButtons = screen.getAllByRole('button', { name: /lưu vào sổ tay/i })
    // Nhấn lưu ô đầu tiên: supersystem / past
    fireEvent.click(saveButtons[0])

    expect(onSaveAsNote).toHaveBeenCalledTimes(1)
    const draft = onSaveAsNote.mock.calls[0][0]

    // Assertion mới C7c-2a: phải có source_context hợp lệ
    expect(draft).toHaveProperty('source_context')
    expect(draft.source_context).toEqual({
      schema_version: 1,
      source_type: 'triz_9_windows',
      lens: 'engineering',
      level: 'supersystem',
      time: 'past',
      cell_label: 'Hạ tầng kỹ thuật quá khứ',
    })
  })

  // Nhóm 2: Context khớp lens business/everyday/engineering đang hiển thị
  it('Nhóm 2a: context phản ánh đúng lens "business" khi người dùng đang xem lăng kính kinh doanh', async () => {
    mockedGetTrizNineWindows.mockResolvedValueOnce(MOCK_BUSINESS_GRID)
    const onSaveAsNote = jest.fn()
    renderWithClient(<TrizNineWindows onSaveAsNote={onSaveAsNote} initialLens="business" />)

    await waitFor(() => {
      expect(screen.getAllByRole('article')).toHaveLength(9)
    })

    const saveButtons = screen.getAllByRole('button', { name: /lưu vào sổ tay/i })
    // Nhấn lưu ô thứ 4: system / past
    fireEvent.click(saveButtons[3])

    expect(onSaveAsNote).toHaveBeenCalledTimes(1)
    const draft = onSaveAsNote.mock.calls[0][0]
    expect(draft.source_context).toEqual({
      schema_version: 1,
      source_type: 'triz_9_windows',
      lens: 'business',
      level: 'system',
      time: 'past',
      cell_label: 'Thị trường system - past',
    })
  })

  it('Nhóm 2b: context phản ánh đúng lens "everyday" khi người dùng chuyển sang lăng kính đời sống', async () => {
    mockedGetTrizNineWindows.mockResolvedValueOnce(MOCK_EVERYDAY_GRID)
    const onSaveAsNote = jest.fn()
    renderWithClient(<TrizNineWindows onSaveAsNote={onSaveAsNote} initialLens="everyday" />)

    await waitFor(() => {
      expect(screen.getAllByRole('article')).toHaveLength(9)
    })

    const saveButtons = screen.getAllByRole('button', { name: /lưu vào sổ tay/i })
    // Nhấn lưu ô thứ 5: system / present
    fireEvent.click(saveButtons[4])

    expect(onSaveAsNote).toHaveBeenCalledTimes(1)
    const draft = onSaveAsNote.mock.calls[0][0]
    expect(draft.source_context).toEqual({
      schema_version: 1,
      source_type: 'triz_9_windows',
      lens: 'everyday',
      level: 'system',
      time: 'present',
      cell_label: 'Đời sống system - present',
    })
  })

  // Nhóm 3: Đổi lens / pending request không ghép cell cũ với lens mới
  it('Nhóm 3: khi bấm đổi lens và request mới đang pending, lens trong context phải khớp với dữ liệu thực tế đang hiển thị', async () => {
    mockedGetTrizNineWindows.mockResolvedValueOnce(MOCK_ENGINEERING_GRID)
    const onSaveAsNote = jest.fn()
    renderWithClient(<TrizNineWindows onSaveAsNote={onSaveAsNote} initialLens="engineering" />)

    await waitFor(() => {
      expect(screen.getAllByRole('article')).toHaveLength(9)
    })

    // Mock API call tiếp theo cho lens 'business' nhưng treo chưa resolve
    let resolveBusiness: (val: any) => void
    const pendingPromise = new Promise((resolve) => {
      resolveBusiness = resolve
    })
    mockedGetTrizNineWindows.mockReturnValueOnce(pendingPromise as any)

    // Bấm nút chuyển sang lens Kinh doanh
    const businessLensBtn = screen.getByRole('button', { name: 'Kinh doanh' })
    fireEvent.click(businessLensBtn)

    // Trong lúc pending, nếu người dùng bấm lưu ô cũ vẫn đang hiện trên màn hình
    const saveButtons = screen.getAllByRole('button', { name: /lưu vào sổ tay/i })
    fireEvent.click(saveButtons[0])

    expect(onSaveAsNote).toHaveBeenCalledTimes(1)
    const draft = onSaveAsNote.mock.calls[0][0]
    // Context BẮT BUỘC phải là lens của cell đang hiển thị (engineering), KHÔNG ĐƯỢC ghép nhầm 'business'
    expect(draft.source_context.lens).toBe('engineering')

    // Giải phóng pending promise để dọn sạch
    resolveBusiness!(MOCK_BUSINESS_GRID)
  })

  // Nhóm 4: content, note_type: 'insight', source_chunk_id: null giữ nguyên format baseline
  it('Nhóm 4: bảo toàn 100% format content, note_type và source_chunk_id theo hợp đồng baseline', async () => {
    mockedGetTrizNineWindows.mockResolvedValueOnce(MOCK_ENGINEERING_GRID)
    const onSaveAsNote = jest.fn()
    renderWithClient(<TrizNineWindows onSaveAsNote={onSaveAsNote} initialLens="engineering" />)

    await waitFor(() => {
      expect(screen.getAllByRole('article')).toHaveLength(9)
    })

    const saveButtons = screen.getAllByRole('button', { name: /lưu vào sổ tay/i })
    fireEvent.click(saveButtons[0])

    expect(onSaveAsNote).toHaveBeenCalledTimes(1)
    const draft = onSaveAsNote.mock.calls[0][0]
    expect(draft.note_type).toBe('insight')
    expect(draft.source_chunk_id).toBeNull()
    expect(draft.content).toContain('[TRIZ 9-Windows: Lăng kính Kỹ thuật & Công nghệ • Siêu hệ thống - Quá khứ: Hạ tầng kỹ thuật quá khứ]')
    expect(draft.content).toContain('Câu hỏi gợi mở: Hệ thống hạ tầng trước đây giới hạn công nghệ thế nào?')
    expect(draft.content).toContain('Đặc điểm: Mô tả hạ tầng quá khứ.')
    expect(draft.content).toContain('Ví dụ: Đường ray xe lửa khổ hẹp')
  })

  // Nhóm 5: Invalid context ở cell nguồn bị chặn, hiển thị lỗi, không gọi callback, không chuyển tab
  it('Nhóm 5: cell chứa nhãn vi phạm (chỉ khoảng trắng hoặc chứa ký tự điều khiển) bị chặn không phát draft và báo lỗi', async () => {
    const invalidGrid: TrizNineWindowsResponse = {
      ...MOCK_ENGINEERING_GRID,
      grid: MOCK_ENGINEERING_GRID.grid.map((cell, idx) =>
        idx === 0
          ? {
              ...cell,
              label_vi: '   \n  \t  ', // Chỉ whitespace và control char
            }
          : cell
      ),
    }

    mockedGetTrizNineWindows.mockResolvedValueOnce(invalidGrid)
    const onSaveAsNote = jest.fn()
    renderWithClient(<TrizNineWindows onSaveAsNote={onSaveAsNote} initialLens="engineering" />)

    await waitFor(() => {
      expect(screen.getAllByRole('article')).toHaveLength(9)
    })

    const saveButtons = screen.getAllByRole('button', { name: /lưu vào sổ tay/i })
    // Bấm lưu cell 0 (cell bị lỗi)
    fireEvent.click(saveButtons[0])

    // Callback không được gọi vì dữ liệu không hợp lệ
    expect(onSaveAsNote).not.toHaveBeenCalled()

    // Phải hiển thị thông báo lỗi accessible trên giao diện
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/dữ liệu ô không hợp lệ/i)
  })
})
