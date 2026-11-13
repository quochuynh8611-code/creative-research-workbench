/**
 * api-error-message.ts
 *
 * Hàm thuần trích xuất thông báo lỗi an toàn (string) từ API errors (đặc biệt lỗi 422 từ FastAPI).
 *
 * Ràng buộc:
 *   - Nhận vào kiểu `unknown`.
 *   - Luôn trả về kiểu `string`, không bao giờ trả về object hay array để tránh React crash.
 *   - Nếu `detail` là chuỗi: trả về chuỗi đó.
 *   - Nếu `detail` là mảng: map an toàn thành chuỗi mô tả các trường bị lỗi.
 *   - Nếu không có `detail`: kiểm tra `err.message` (nếu là string), ngược lại trả về fallback tiếng Việt.
 *   - Không in/log secrets hoặc payload nhạy cảm.
 *   - Không phụ thuộc React / DOM.
 */

export function extractApiErrorMessage(
  err: unknown,
  fallbackMessage: string = 'Đã có lỗi xảy ra. Vui lòng thử lại.'
): string {
  if (!err) {
    return fallbackMessage
  }

  // Trực tiếp là string
  if (typeof err === 'string') {
    return err
  }

  if (typeof err === 'object') {
    const errObj = err as Record<string, unknown>
    const response = errObj.response as Record<string, unknown> | undefined
    const responseData = response?.data as Record<string, unknown> | undefined
    const detail = responseData?.detail ?? errObj.detail

    // 1. Trường hợp detail là chuỗi đơn giản
    if (typeof detail === 'string') {
      return detail
    }

    // 2. Trường hợp detail là mảng các lỗi validation từ FastAPI/Pydantic
    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) => {
          if (typeof item === 'string') return item
          if (item && typeof item === 'object') {
            const entry = item as Record<string, unknown>
            const msg = typeof entry.msg === 'string' ? entry.msg : ''
            const loc = Array.isArray(entry.loc)
              ? entry.loc.filter((segment) => typeof segment === 'string' && segment !== 'body')
              : []
            const field = loc.length > 0 ? String(loc[loc.length - 1]) : ''

            if (field && msg) {
              return `${field}: ${msg}`
            }
            if (msg) {
              return msg
            }
          }
          return ''
        })
        .filter(Boolean)

      if (messages.length > 0) {
        return messages.join('; ')
      }
    }

    // 3. Fallback sang err.message nếu là Error object
    if (typeof errObj.message === 'string' && errObj.message) {
      return errObj.message
    }
  }

  return fallbackMessage
}
