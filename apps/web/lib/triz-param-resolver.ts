/**
 * triz-param-resolver.ts — Tiện ích giải quyết thông số TRIZ 39 và ánh xạ legacy alias.
 * Ref: docs/ADR-001-architecture.md, backend/src/app/services/problem_structuring_service.py
 */

export const LEGACY_PARAM_ALIASES: Record<string, number> = {
  loss_of_money: 22,
  duration_action: 25,
  energy_consumption: 22,
  loss_of_energy: 22,
  loss_of_time: 25,
  manufacturing_precision: 29,
  accuracy: 29,
  adaptability: 35,
  flexibility: 35,
}

export interface TrizParamCandidate {
  id: number
  code: string
  name_vi: string
  name_en: string
  everyday_label?: string
}

/**
 * Phân giải giá trị tham số (id, mã code canonical, alias cũ, hoặc tên song ngữ) thành TRIZ Parameter ID (1-39).
 * Trả về null nếu không hợp lệ hoặc không tìm thấy. Tuyệt đối không tự ý chọn tham số mặc định.
 */
export function resolveParamId(
  param: string | number | null | undefined,
  params?: TrizParamCandidate[]
): number | null {
  if (param === null || param === undefined || param === '') return null

  // 1. Nếu là number integer trong khoảng 1..39
  if (typeof param === 'number') {
    return Number.isInteger(param) && param >= 1 && param <= 39 ? param : null
  }

  const str = String(param).trim()
  if (!str) return null

  // 2. Nếu là chuỗi số nguyên "1".."39"
  const numeric = parseInt(str, 10)
  if (!isNaN(numeric) && String(numeric) === str && numeric >= 1 && numeric <= 39) {
    return numeric
  }

  const lower = str.toLowerCase()

  // 3. Kiểm tra từ điển alias legacy (loss_of_money -> 22, duration_action -> 25, ...)
  if (lower in LEGACY_PARAM_ALIASES) {
    return LEGACY_PARAM_ALIASES[lower]
  }

  // 4. Nếu có danh mục params, so khớp theo code, name_vi, name_en
  if (params && params.length > 0) {
    const found = params.find(
      (p) =>
        p.code.toLowerCase() === lower ||
        p.name_vi.toLowerCase() === lower ||
        p.name_en.toLowerCase() === lower ||
        p.name_vi.toLowerCase().includes(lower) ||
        lower.includes(p.name_vi.toLowerCase()) ||
        p.code.toLowerCase().replace(/_/g, ' ') === lower
    )
    if (found) return found.id
  }

  return null
}
