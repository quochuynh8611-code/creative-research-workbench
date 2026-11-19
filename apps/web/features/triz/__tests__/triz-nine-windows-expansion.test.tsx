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

const mockedGetTrizNineWindows = apiClient.getTrizNineWindows as jest.MockedFunction<typeof apiClient.getTrizNineWindows>

function makeMockResponse(lens: string, title: string): TrizNineWindowsResponse {
  return {
    lens: lens as any,
    lens_title: title,
    grid: [
      {
        level: 'supersystem',
        time: 'past',
        label_vi: `${title} - Supersystem Past`,
        prompt_vi: 'Prompt test',
        description_vi: 'Description test',
      },
      {
        level: 'supersystem',
        time: 'present',
        label_vi: `${title} - Supersystem Present`,
        prompt_vi: 'Prompt test',
        description_vi: 'Description test',
      },
      {
        level: 'supersystem',
        time: 'future',
        label_vi: `${title} - Supersystem Future`,
        prompt_vi: 'Prompt test',
        description_vi: 'Description test',
      },
      {
        level: 'system',
        time: 'past',
        label_vi: `${title} - System Past`,
        prompt_vi: 'Prompt test',
        description_vi: 'Description test',
      },
      {
        level: 'system',
        time: 'present',
        label_vi: `${title} - System Present`,
        prompt_vi: 'Prompt test',
        description_vi: 'Description test',
      },
      {
        level: 'system',
        time: 'future',
        label_vi: `${title} - System Future`,
        prompt_vi: 'Prompt test',
        description_vi: 'Description test',
      },
      {
        level: 'subsystem',
        time: 'past',
        label_vi: `${title} - Subsystem Past`,
        prompt_vi: 'Prompt test',
        description_vi: 'Description test',
      },
      {
        level: 'subsystem',
        time: 'present',
        label_vi: `${title} - Subsystem Present`,
        prompt_vi: 'Prompt test',
        description_vi: 'Description test',
      },
      {
        level: 'subsystem',
        time: 'future',
        label_vi: `${title} - Subsystem Future`,
        prompt_vi: 'Prompt test',
        description_vi: 'Description test',
      },
    ],
    meta: {
      total_windows: 9,
      system_levels: ['supersystem', 'system', 'subsystem'],
      time_horizons: ['past', 'present', 'future'],
    },
  }
}

describe('TRIZ 9-Windows Multi-Lens Expansion — Batch C35', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    jest.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    mockedGetTrizNineWindows.mockImplementation(async (lens = 'engineering') => {
      return makeMockResponse(lens, `Lăng kính ${lens}`)
    })
  })

  function renderComponent(props = {}) {
    return render(
      <QueryClientProvider client={queryClient}>
        <TrizNineWindows {...props} />
      </QueryClientProvider>
    )
  }

  it('1. test_renders_all_6_lens_tabs: hiển thị đủ 6 tabs lăng kính chuẩn', async () => {
    renderComponent()

    expect(screen.getByRole('button', { name: 'Kỹ thuật' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kinh doanh' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Đời sống' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tư duy Hệ thống' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tư duy Thiết kế' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Khởi nghiệp Tinh gọn' })).toBeInTheDocument()
  })

  it('2. test_clicking_systems_thinking_tab_triggers_api_call', async () => {
    renderComponent()

    const tab = screen.getByRole('button', { name: 'Tư duy Hệ thống' })
    fireEvent.click(tab)

    await waitFor(() => {
      expect(mockedGetTrizNineWindows).toHaveBeenCalledWith('systems_thinking')
    })
  })

  it('3. test_clicking_design_thinking_tab_triggers_api_call', async () => {
    renderComponent()

    const tab = screen.getByRole('button', { name: 'Tư duy Thiết kế' })
    fireEvent.click(tab)

    await waitFor(() => {
      expect(mockedGetTrizNineWindows).toHaveBeenCalledWith('design_thinking')
    })
  })

  it('4. test_clicking_lean_startup_tab_triggers_api_call', async () => {
    renderComponent()

    const tab = screen.getByRole('button', { name: 'Khởi nghiệp Tinh gọn' })
    fireEvent.click(tab)

    await waitFor(() => {
      expect(mockedGetTrizNineWindows).toHaveBeenCalledWith('lean_startup')
    })
  })
})
