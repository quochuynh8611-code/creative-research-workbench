/**
 * candidate-solution-context-validator.ts
 *
 * Hàm kiểm thực runtime tối thiểu (fail-closed) cho source_context thuộc variant
 * Giải pháp Sáng tạo Ứng viên (candidate_solution) theo Batch C7c-2f / ADR-014.
 *
 * Ràng buộc:
 *   - Thuần túy validation, không phụ thuộc React / DOM / network.
 *   - Fail-closed: từ chối mọi trường hợp không khớp hợp đồng.
 *   - Không tự ý trim(), Number(), truncate hay làm biến đổi dữ liệu đầu vào.
 *   - Cấm trường lạ (extra keys): chỉ chấp nhận các khóa cho phép.
 *   - Bắt buộc: schema_version === 1, source_type === 'candidate_solution',
 *     solution_id (UUID), solution_status ('candidate' | 'accepted' | 'rejected').
 *   - Tùy chọn: principle_used.
 *       - null hoặc undefined: hợp lệ, kết quả trả về OMIT trường này.
 *       - number: phải là số nguyên StrictInt 1..40, cấm boolean, float, NaN, Infinity.
 *       - string: 1..100 Unicode code points, cấm rỗng/whitespace-only,
 *         cấm ký tự điều khiển ASCII < 32, \n, \r, \t, \0, 0x7F-0x9F, U+2028, U+2029.
 */

import type { CandidateSolutionSourceContext } from './types'

const CONTROL_CHAR_REGEX = /[\x00-\x1f\x7f-\x9f\u2028\u2029]/
// Chấp nhận UUID chuẩn (8-4-4-4-12 hex) theo RFC 4122
const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

const ALLOWED_KEYS = new Set([
  'schema_version',
  'source_type',
  'solution_id',
  'solution_status',
  'principle_used',
])

const VALID_STATUSES = new Set(['candidate', 'accepted', 'rejected'])

export type ValidationResult =
  | { ok: true; data: CandidateSolutionSourceContext }
  | { ok: false; error: string }

export function validateCandidateSolutionContext(input: unknown): ValidationResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Context phải là một đối tượng hợp lệ' }
  }

  const record = input as Record<string, unknown>
  const keys = Object.keys(record)

  // 1. Kiểm tra không có trường lạ
  for (const k of keys) {
    if (!ALLOWED_KEYS.has(k)) {
      return { ok: false, error: `Trường không cho phép trong context: ${k}` }
    }
  }

  // 2. Kiểm tra các trường bắt buộc
  if (!('schema_version' in record)) {
    return { ok: false, error: 'Thiếu trường bắt buộc: schema_version' }
  }
  if (!('source_type' in record)) {
    return { ok: false, error: 'Thiếu trường bắt buộc: source_type' }
  }
  if (!('solution_id' in record)) {
    return { ok: false, error: 'Thiếu trường bắt buộc: solution_id' }
  }
  if (!('solution_status' in record)) {
    return { ok: false, error: 'Thiếu trường bắt buộc: solution_status' }
  }

  // 3. schema_version
  if (typeof record.schema_version !== 'number' || record.schema_version !== 1) {
    return { ok: false, error: 'schema_version phải là số 1' }
  }

  // 4. source_type
  if (record.source_type !== 'candidate_solution') {
    return { ok: false, error: 'source_type phải là "candidate_solution"' }
  }

  // 5. solution_id (UUID)
  if (typeof record.solution_id !== 'string' || !UUID_REGEX.test(record.solution_id)) {
    return { ok: false, error: 'solution_id phải là chuỗi định dạng UUID hợp lệ' }
  }

  // 6. solution_status
  if (
    typeof record.solution_status !== 'string' ||
    !VALID_STATUSES.has(record.solution_status)
  ) {
    return {
      ok: false,
      error: 'solution_status phải là một trong các giá trị: candidate, accepted, rejected',
    }
  }

  // 7. principle_used (Optional)
  let validatedPrincipleUsed: number | string | undefined = undefined

  if (record.principle_used !== undefined && record.principle_used !== null) {
    const pu = record.principle_used

    if (typeof pu === 'boolean') {
      return { ok: false, error: 'principle_used không được là boolean' }
    }

    if (typeof pu === 'number') {
      if (!Number.isInteger(pu) || Number.isNaN(pu) || !Number.isFinite(pu)) {
        return { ok: false, error: 'principle_used dạng số phải là số nguyên' }
      }
      if (pu < 1 || pu > 40) {
        return { ok: false, error: 'principle_used dạng số phải nằm trong khoảng 1..40' }
      }
      validatedPrincipleUsed = pu
    } else if (typeof pu === 'string') {
      if (CONTROL_CHAR_REGEX.test(pu)) {
        return {
          ok: false,
          error: 'principle_used không được chứa ký tự điều khiển hoặc ngắt dòng (newline, tab, U+2028, U+2029)',
        }
      }
      if (!pu.trim()) {
        return { ok: false, error: 'principle_used không được rỗng hoặc chỉ chứa khoảng trắng' }
      }
      const codePointLength = Array.from(pu).length
      if (codePointLength > 100) {
        return { ok: false, error: 'principle_used không được vượt quá 100 ký tự' }
      }
      validatedPrincipleUsed = pu
    } else {
      return {
        ok: false,
        error: 'principle_used phải là số nguyên 1..40 hoặc chuỗi ký tự không quá 100 ký tự',
      }
    }
  }

  const data: CandidateSolutionSourceContext = {
    schema_version: 1,
    source_type: 'candidate_solution',
    solution_id: record.solution_id,
    solution_status: record.solution_status as 'candidate' | 'accepted' | 'rejected',
  }

  if (validatedPrincipleUsed !== undefined) {
    data.principle_used = validatedPrincipleUsed
  }

  return { ok: true, data }
}
