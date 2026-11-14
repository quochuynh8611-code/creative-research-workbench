/**
 * principle-suggestion-context-validator.ts
 *
 * Hàm kiểm thực runtime tối thiểu (fail-closed) cho source_context thuộc variant
 * Gợi ý Nguyên tắc Sáng chế (principle_suggestion) theo Batch C7c-2d-2 / ADR-014 & ADR-016.
 *
 * Ràng buộc:
 *   - Thuần túy validation, không phụ thuộc React / DOM / network.
 *   - Fail-closed: từ chối mọi trường hợp không khớp hợp đồng.
 *   - Không tự ý trim(), Number(), truncate hay làm biến đổi dữ liệu đầu vào.
 *   - Cấm trường lạ (extra keys): chỉ chấp nhận đúng 4 khóa hợp lệ.
 *   - Giới hạn nguyên ngặt (StrictInt):
 *       - principle_id: 1..40 (số nguyên)
 *       - Từ chối boolean, chuỗi số ("35"), float (35.0), NaN, Infinity.
 *   - method_id:
 *       - Chuỗi ký tự độ dài 1..100 Unicode code points.
 *       - Cấm ký tự điều khiển ASCII < 32, \n, \r, \t, \0, 0x7F-0x9F.
 *       - Cấm ngắt dòng Unicode U+2028, U+2029.
 *       - Cấm rỗng hoặc chỉ toàn khoảng trắng.
 */

import type { PrincipleSuggestionSourceContext } from './types'

const CONTROL_CHAR_REGEX = /[\x00-\x1f\x7f-\x9f\u2028\u2029]/

const ALLOWED_KEYS = new Set([
  'schema_version',
  'source_type',
  'principle_id',
  'method_id',
])

export type ValidationResult =
  | { ok: true; data: PrincipleSuggestionSourceContext }
  | { ok: false; error: string }

export function validatePrincipleSuggestionContext(input: unknown): ValidationResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Context phải là một đối tượng hợp lệ' }
  }

  const record = input as Record<string, unknown>
  const keys = Object.keys(record)

  // 1. Kiểm tra không có trường lạ và không thiếu trường (đúng 4 trường)
  if (keys.length !== 4) {
    return { ok: false, error: 'Context phải có đúng 4 trường bắt buộc' }
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
  if (record.source_type !== 'principle_suggestion') {
    return { ok: false, error: 'source_type phải là "principle_suggestion"' }
  }

  // 4. principle_id (StrictInt 1..40)
  if (
    typeof record.principle_id !== 'number' ||
    !Number.isInteger(record.principle_id) ||
    record.principle_id < 1 ||
    record.principle_id > 40
  ) {
    return { ok: false, error: 'principle_id phải là số nguyên trong khoảng 1 đến 40' }
  }

  // 5. method_id (Free-text 1..100 code points, cấm control characters)
  if (typeof record.method_id !== 'string') {
    return { ok: false, error: 'method_id phải là chuỗi ký tự' }
  }

  // Kiểm tra ký tự điều khiển trên chuỗi gốc (cấm \n, \r, \t, NUL, U+2028, U+2029)
  if (CONTROL_CHAR_REGEX.test(record.method_id)) {
    return {
      ok: false,
      error: 'method_id không được chứa ký tự điều khiển hoặc ngắt dòng (newline, tab, U+2028, U+2029)',
    }
  }

  // Kiểm tra rỗng hoặc chỉ toàn khoảng trắng
  if (!record.method_id.trim()) {
    return { ok: false, error: 'method_id không được rỗng hoặc chỉ chứa khoảng trắng' }
  }

  // Kiểm tra độ dài theo Unicode code points
  const codePointLength = Array.from(record.method_id).length
  if (codePointLength > 100) {
    return { ok: false, error: 'method_id không được vượt quá 100 ký tự' }
  }

  return {
    ok: true,
    data: {
      schema_version: 1,
      source_type: 'principle_suggestion',
      principle_id: record.principle_id,
      method_id: record.method_id,
    },
  }
}
