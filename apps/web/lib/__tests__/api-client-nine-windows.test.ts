/**
 * api-client-nine-windows.test.ts — Contract Tests cho API Client TRIZ 9-Windows (Batch C2 — RED Phase)
 */

import { apiClient, getTrizNineWindows } from '../api-client'
import type { TrizNineWindowsResponse } from '../types'

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

describe('API Client — getTrizNineWindows (Batch C2 — RED Phase)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('1. getTrizNineWindows() mặc định gọi GET /api/v1/triz/nine-windows với params { lens: "engineering" }', async () => {
    const spy = jest.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: MOCK_NINE_WINDOWS_RESPONSE,
    })

    const result = await getTrizNineWindows()

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('/api/v1/triz/nine-windows', {
      params: { lens: 'engineering' },
    })
    expect(result).toEqual(MOCK_NINE_WINDOWS_RESPONSE)
    expect(result.lens).toBe('engineering')
  })

  it('2. getTrizNineWindows("business") gọi params { lens: "business" }', async () => {
    const businessResponse = {
      ...MOCK_NINE_WINDOWS_RESPONSE,
      lens: 'business' as const,
      lens_title: 'Lăng kính Kinh doanh & Thị trường',
    }
    const spy = jest.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: businessResponse,
    })

    const result = await getTrizNineWindows('business')

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('/api/v1/triz/nine-windows', {
      params: { lens: 'business' },
    })
    expect(result.lens).toBe('business')
  })

  it('3. getTrizNineWindows("everyday") gọi params { lens: "everyday" }', async () => {
    const everydayResponse = {
      ...MOCK_NINE_WINDOWS_RESPONSE,
      lens: 'everyday' as const,
      lens_title: 'Lăng kính Đời sống & Cá nhân',
    }
    const spy = jest.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: everydayResponse,
    })

    const result = await getTrizNineWindows('everyday')

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('/api/v1/triz/nine-windows', {
      params: { lens: 'everyday' },
    })
    expect(result.lens).toBe('everyday')
  })

  it('4. Trả về response.data đúng shape 9-windows contract', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: MOCK_NINE_WINDOWS_RESPONSE,
    })

    const result = await getTrizNineWindows('engineering')

    expect(result).toHaveProperty('lens')
    expect(result).toHaveProperty('lens_title')
    expect(result).toHaveProperty('grid')
    expect(result).toHaveProperty('meta')
    expect(result.grid).toHaveLength(9)
    expect(result.meta.total_windows).toBe(9)
  })

  it('5. Không gọi endpoint khác ngoài /api/v1/triz/nine-windows', async () => {
    const spy = jest.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: MOCK_NINE_WINDOWS_RESPONSE,
    })

    await getTrizNineWindows('engineering')

    const calledUrl = spy.mock.calls[0]?.[0]
    expect(calledUrl).toBe('/api/v1/triz/nine-windows')
    expect(calledUrl).not.toBe('/api/v1/triz/lookup')
    expect(calledUrl).not.toBe('/api/v1/triz/parameters')
  })

  it('6. Ném ngoại lệ khi request bị reject (Network error), không fallback trả dữ liệu ảo', async () => {
    const mockError = new Error('Network Error: Failed to fetch')
    jest.spyOn(apiClient, 'get').mockRejectedValueOnce(mockError)

    await expect(getTrizNineWindows('engineering')).rejects.toThrow('Network Error: Failed to fetch')
  })

  it('7. Ném ngoại lệ AxiosError 422 từ backend, bảo toàn cấu trúc lỗi', async () => {
    const axiosError422 = {
      isAxiosError: true,
      message: 'Request failed with status code 422',
      response: {
        status: 422,
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
    jest.spyOn(apiClient, 'get').mockRejectedValueOnce(axiosError422)

    await expect(getTrizNineWindows('invalid' as any)).rejects.toMatchObject({
      isAxiosError: true,
      response: { status: 422 },
    })
  })
})
