/**
 * triz-9-windows-context-validator.ts
 *
 * Hàm kiểm thực runtime tối thiểu (fail-closed) cho source_context thuộc variant
 * Sơ đồ 9 Màn hình TRIZ (triz_9_windows) theo Batch C7c-2a / ADR-015.
 *
 * Ràng buộc:
 *   - Thuần túy validation, không phụ thuộc React / DOM / network.
 *   - Fail-closed: từ chối mọi trường hợp không khớp hợp đồng.
 *   - Không tự ý trim(), Number(), truncate hay làm biến đổi dữ liệu đầu vào.
 *   - Cấm trường lạ (extra keys): chỉ chấp nhận đúng 6 khóa hợp lệ.
 *   - Cấm ký tự điều khiển ASCII < 32, NUL, \n, \r, \t và ký tự ngắt dòng Unicode U+2028, U+2029.
 *   - cell_label tối đa 100 Unicode code points.
 */

import type { Triz9WindowsSourceContext } from './types'

const CONTROL_CHAR_REGEX = /[\x00-\x1f\x7f-\x9f\u2028\u2029]/

const ALLOWED_KEYS = new Set([
  'schema_version',
  'source_type',
  'lens',
  'level',
  'time',
  'cell_label',
])

const VALID_LENSES = new Set(['engineering', 'business', 'everyday'])
const VALID_LEVELS = new Set(['supersystem', 'system', 'subsystem'])
const VALID_TIMES = new Set(['past', 'present', 'future'])

export type ValidationResult =
  | { ok: true; data: Triz9WindowsSourceContext }
  | { ok: false; error: string }

export function validateTriz9WindowsContext(input: unknown): ValidationResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Context phải là một đối tượng hợp lệ' }
  }

  const record = input as Record<string, unknown>
  const keys = Object.keys(record)

  // 1. Kiểm tra không có trường lạ và không thiếu trường
  if (keys.length !== 6) {
    return { ok: false, error: 'Context phải có đúng 6 trường bắt buộc' }
  }

  for (const k of keys) {
    if (!ALLOWED_KEYS.has(k)) {
      return { ok: false, error: `Trường không cho phép trong context: ${k}` }
    }
  }

  // 2. schema_version
  if (typeof record.schema_version !== 'number' || record.schema_version !== 1) {
    return { ok: false, error: 'schema_version phải là số 1' }
  }

  // 3. source_type
  if (record.source_type !== 'triz_9_windows') {
    return { ok: false, error: 'source_type phải là "triz_9_windows"' }
  }

  // 4. lens
  if (typeof record.lens !== 'string' || !VALID_LENSES.has(record.lens)) {
    return { ok: false, error: 'lens phải là "engineering", "business" hoặc "everyday"' }
  }

  // 5. level
  if (typeof record.level !== 'string' || !VALID_LEVELS.has(record.level)) {
    return { ok: false, error: 'level phải là "supersystem", "system" hoặc "subsystem"' }
  }

  // 6. time
  if (typeof record.time !== 'string' || !VALID_TIMES.has(record.time)) {
    return { ok: false, error: 'time phải là "past", "present" hoặc "future"' }
  }

  // 7. cell_label
  if (typeof record.cell_label !== 'string') {
    return { ok: false, error: 'cell_label phải là chuỗi ký tự' }
  }

  // Kiểm tra ký tự điều khiển trên chuỗi gốc (cấm \n, \r, \t, NUL, U+2028, U+2029)
  if (CONTROL_CHAR_REGEX.test(record.cell_label)) {
    return {
      ok: false,
      error: 'cell_label không được chứa ký tự điều khiển hoặc ngắt dòng (newline, tab, U+2028, U+2029)',
    }
  }

  // Kiểm tra rỗng hoặc chỉ toàn khoảng trắng
  if (!record.cell_label.trim()) {
    return { ok: false, error: 'cell_label không được rỗng hoặc chỉ chứa khoảng trắng' }
  }

  // Kiểm tra độ dài theo Unicode code points
  const codePointLength = Array.from(record.cell_label).length
  if (codePointLength > 100) {
    return { ok: false, error: 'cell_label không được vượt quá 100 ký tự' }
  }

  return {
    ok: true,
    data: {
      schema_version: 1,
      source_type: 'triz_9_windows',
      lens: record.lens as 'engineering' | 'business' | 'everyday',
      level: record.level as 'supersystem' | 'system' | 'subsystem',
      time: record.time as 'past' | 'present' | 'future',
      cell_label: record.cell_label,
    },
  }
}
