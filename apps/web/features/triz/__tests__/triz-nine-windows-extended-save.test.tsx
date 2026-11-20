/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TrizNineWindows } from '../triz-nine-windows'
import { NoteSourceBadge } from '@/features/notebook/components/note-source-badge'
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

const EXTENDED_LENS_CASES: Array<{
  lens: 'systems_thinking' | 'design_thinking' | 'lean_startup'
  lens_title: string
  label_vi: string
}> = [
  {
    lens: 'systems_thinking',
    lens_title: 'Lăng kính Tư duy Hệ thống',
    label_vi: 'Vòng lặp phản hồi tăng cường',
  },
  {
    lens: 'design_thinking',
    lens_title: 'Lăng kính Tư duy Thiết kế',
    label_vi: 'Bản đồ thấu cảm người dùng',
  },
  {
    lens: 'lean_startup',
    lens_title: 'Lăng kính Khởi nghiệp Tinh gọn',
    label_vi: 'Vòng lặp Build-Measure-Learn',
  },
]

describe('Lô 3: TrizNineWindows Extended Lens Save Action (C38-GAP-03)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  EXTENDED_LENS_CASES.forEach(({ lens, lens_title, label_vi }) => {
    it(`3.2.1 Lưu ô thuộc lăng kính "${lens}" thành công, gọi onSaveAsNote với source_context chuẩn và không có alert lỗi`, async () => {
      const mockGrid: TrizNineWindowsResponse = {
        lens,
        lens_title,
        meta: {
          total_windows: 9,
          system_levels: ['supersystem', 'system', 'subsystem'],
          time_horizons: ['past', 'present', 'future'],
        },
        grid: [
          {
            level: 'system',
            time: 'present',
            label_vi,
            label_en: `${lens} System Present`,
            prompt_vi: `Gợi mở cho ${label_vi}`,
            description_vi: `Mô tả cho ${label_vi}`,
            examples_vi: [`Ví dụ cho ${label_vi}`],
          },
        ],
      }
      mockedGetTrizNineWindows.mockResolvedValueOnce(mockGrid)

      const onSaveAsNote = jest.fn()
      renderWithClient(<TrizNineWindows initialLens={lens} onSaveAsNote={onSaveAsNote} />)

      await waitFor(() => {
        expect(screen.getByText(label_vi)).toBeInTheDocument()
      })

      const saveBtn = screen.getByRole('button', { name: /lưu vào sổ tay/i })
      fireEvent.click(saveBtn)

      // Tuyệt đối không hiển thị thông báo lỗi
      expect(screen.queryByRole('alert')).toBeNull()

      // onSaveAsNote được gọi với đúng source_context
      expect(onSaveAsNote).toHaveBeenCalledTimes(1)
      const draft = onSaveAsNote.mock.calls[0][0]
      expect(draft.source_context).toMatchObject({
        schema_version: 1,
        source_type: 'triz_9_windows',
        lens,
        level: 'system',
        time: 'present',
        cell_label: label_vi,
      })

      // NoteSourceBadge render đúng nhãn "Lưới 9 màn hình" và tooltip tương ứng
      const { container } = render(<NoteSourceBadge sourceContext={draft.source_context} />)
      expect(screen.getByText('Lưới 9 màn hình')).toBeInTheDocument()
      expect(container.querySelector(`[title="Lưới 9 màn hình: ${label_vi}"]`)).toBeInTheDocument()
    })
  })

  it('3.2.2 Khi dữ liệu ô có ký tự điều khiển ngắt dòng, cellError hiển thị thông báo lỗi và chặn onSaveAsNote', async () => {
    const corruptedGrid: TrizNineWindowsResponse = {
      lens: 'systems_thinking',
      lens_title: 'Lăng kính Tư duy Hệ thống',
      meta: {
        total_windows: 9,
        system_levels: ['supersystem', 'system', 'subsystem'],
        time_horizons: ['past', 'present', 'future'],
      },
      grid: [
        {
          level: 'system',
          time: 'present',
          label_vi: 'Ô bị lỗi\nngắt dòng',
          label_en: 'Corrupted Cell',
          prompt_vi: 'Prompt',
          description_vi: 'Description',
        },
      ],
    }
    mockedGetTrizNineWindows.mockResolvedValueOnce(corruptedGrid)

    const onSaveAsNote = jest.fn()
    renderWithClient(<TrizNineWindows initialLens="systems_thinking" onSaveAsNote={onSaveAsNote} />)

    await waitFor(() => {
      expect(screen.getByText(/Ô bị lỗi/i)).toBeInTheDocument()
    })

    const saveBtn = screen.getByRole('button', { name: /lưu vào sổ tay/i })
    fireEvent.click(saveBtn)

    // Hiển thị alert lỗi
    await waitFor(() => {
      const alert = screen.getByRole('alert')
      expect(alert).toBeInTheDocument()
      expect(alert).toHaveTextContent(/Dữ liệu ô không hợp lệ/i)
    })

    // onSaveAsNote KHÔNG được gọi
    expect(onSaveAsNote).not.toHaveBeenCalled()
  })
})
