/**
 * triz-matrix-context-validator.ts
 *
 * Hàm kiểm thực runtime tối thiểu (fail-closed) cho source_context thuộc variant
 * Tra cứu Ma trận TRIZ (triz_matrix) theo Batch C7c-2c / ADR-014.
 *
 * Ràng buộc:
 *   - Thuần túy validation, không phụ thuộc React / DOM / network.
 *   - Fail-closed: từ chối mọi trường hợp không khớp hợp đồng.
 *   - Không tự ý trim(), Number(), truncate hay làm biến đổi dữ liệu đầu vào.
 *   - Cấm trường lạ (extra keys): chỉ chấp nhận đúng 6 khóa hợp lệ.
 *   - Giới hạn nguyên ngặt (StrictInt):
 *       - principle_id: 1..40 (số nguyên)
 *       - improving_param_id: 1..39 (số nguyên)
 *       - worsening_param_id: 1..39 (số nguyên)
 *       - Từ chối boolean, chuỗi số ("1"), float (1.0), NaN, Infinity.
 *   - lens: 'engineering' | 'business' | 'everyday'.
 */

import type { TrizMatrixSourceContext } from './types'

const ALLOWED_KEYS = new Set([
  'schema_version',
  'source_type',
  'principle_id',
  'improving_param_id',
  'worsening_param_id',
  'lens',
])

const VALID_LENSES = new Set(['engineering', 'business', 'everyday'])

export type ValidationResult =
  | { ok: true; data: TrizMatrixSourceContext }
  | { ok: false; error: string }

export function validateTrizMatrixContext(input: unknown): ValidationResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Context phải là một đối tượng hợp lệ' }
  }

  const record = input as Record<string, unknown>
  const keys = Object.keys(record)

  // 1. Kiểm tra không có trường lạ và không thiếu trường (đúng 6 trường)
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
  if (record.source_type !== 'triz_matrix') {
    return { ok: false, error: 'source_type phải là "triz_matrix"' }
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

  // 5. improving_param_id (StrictInt 1..39)
  if (
    typeof record.improving_param_id !== 'number' ||
    !Number.isInteger(record.improving_param_id) ||
    record.improving_param_id < 1 ||
    record.improving_param_id > 39
  ) {
    return { ok: false, error: 'improving_param_id phải là số nguyên trong khoảng 1 đến 39' }
  }

  // 6. worsening_param_id (StrictInt 1..39)
  if (
    typeof record.worsening_param_id !== 'number' ||
    !Number.isInteger(record.worsening_param_id) ||
    record.worsening_param_id < 1 ||
    record.worsening_param_id > 39
  ) {
    return { ok: false, error: 'worsening_param_id phải là số nguyên trong khoảng 1 đến 39' }
  }

  // 7. lens
  if (typeof record.lens !== 'string' || !VALID_LENSES.has(record.lens)) {
    return { ok: false, error: 'lens phải là "engineering", "business" hoặc "everyday"' }
  }

  return {
    ok: true,
    data: {
      schema_version: 1,
      source_type: 'triz_matrix',
      principle_id: record.principle_id,
      improving_param_id: record.improving_param_id,
      worsening_param_id: record.worsening_param_id,
      lens: record.lens as 'engineering' | 'business' | 'everyday',
    },
  }
}
