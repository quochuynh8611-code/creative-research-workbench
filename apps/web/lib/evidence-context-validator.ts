/**
 * evidence-context-validator.ts
 *
 * Hàm kiểm thực runtime tối thiểu (fail-closed) cho source_context thuộc variant
 * Bằng chứng Tri thức (evidence) theo Batch C7c-2e / ADR-014.
 *
 * Ràng buộc:
 *   - Thuần túy validation, không phụ thuộc React / DOM / network.
 *   - Fail-closed: từ chối mọi trường hợp không khớp hợp đồng.
 *   - Không tự ý trim(), truncate hay làm biến đổi dữ liệu đầu vào.
 *   - Cấm trường lạ (extra keys): chỉ chấp nhận đúng 3 khóa hợp lệ.
 *   - Tuyệt đối cấm chunk_id, source_chunk_id, score, hay title trong context.
 *   - source_ref:
 *       - Chuỗi ký tự độ dài 1..255 Unicode code points.
 *       - Cấm ký tự điều khiển ASCII < 32, \n, \r, \t, \0, 0x7F-0x9F.
 *       - Cấm ngắt dòng Unicode U+2028, U+2029.
 *       - Cấm rỗng hoặc chỉ toàn khoảng trắng.
 */

import type { EvidenceSourceContext } from './types'

const CONTROL_CHAR_REGEX = /[\x00-\x1f\x7f-\x9f\u2028\u2029]/

const ALLOWED_KEYS = new Set([
  'schema_version',
  'source_type',
  'source_ref',
])

export type ValidationResult =
  | { ok: true; data: EvidenceSourceContext }
  | { ok: false; error: string }

export function validateEvidenceContext(input: unknown): ValidationResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Context phải là một đối tượng hợp lệ' }
  }

  const record = input as Record<string, unknown>
  const keys = Object.keys(record)

  // 1. Kiểm tra không có trường lạ và không thiếu trường (đúng 3 trường)
  if (keys.length !== 3) {
    return { ok: false, error: 'Context phải có đúng 3 trường bắt buộc' }
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
  if (record.source_type !== 'evidence') {
    return { ok: false, error: 'source_type phải là "evidence"' }
  }

  // 4. source_ref (Free-text 1..255 code points, cấm control characters)
  if (typeof record.source_ref !== 'string') {
    return { ok: false, error: 'source_ref phải là chuỗi ký tự' }
  }

  // Kiểm tra ký tự điều khiển trên chuỗi gốc (cấm \n, \r, \t, NUL, U+2028, U+2029)
  if (CONTROL_CHAR_REGEX.test(record.source_ref)) {
    return {
      ok: false,
      error: 'source_ref không được chứa ký tự điều khiển hoặc ngắt dòng (newline, tab, U+2028, U+2029)',
    }
  }

  // Kiểm tra rỗng hoặc chỉ toàn khoảng trắng
  if (!record.source_ref.trim()) {
    return { ok: false, error: 'source_ref không được rỗng hoặc chỉ chứa khoảng trắng' }
  }

  // Kiểm tra độ dài theo Unicode code points
  const codePointLength = Array.from(record.source_ref).length
  if (codePointLength > 255) {
    return { ok: false, error: 'source_ref không được vượt quá 255 ký tự' }
  }

  return {
    ok: true,
    data: {
      schema_version: 1,
      source_type: 'evidence',
      source_ref: record.source_ref,
    },
  }
}
