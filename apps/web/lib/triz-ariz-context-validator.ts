/**
 * triz-ariz-context-validator.ts
 *
 * Hàm kiểm thực runtime tối thiểu (fail-closed) cho source_context thuộc variant
 * Thuật giải ARIZ 6 bước (triz_ariz) theo Batch C34 / ADR-015.
 */

import type { TrizArizSourceContext } from './types'

const CONTROL_CHAR_REGEX = /[\x00-\x1f\x7f-\x9f\u2028\u2029]/

const ALLOWED_KEYS = new Set([
  'schema_version',
  'source_type',
  'step_number',
  'step_name',
])

export type ValidationResult =
  | { ok: true; data: TrizArizSourceContext }
  | { ok: false; error: string }

export function validateTrizArizContext(input: unknown): ValidationResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Context phải là một đối tượng hợp lệ' }
  }

  const record = input as Record<string, unknown>
  const keys = Object.keys(record)

  if (keys.length !== 4) {
    return { ok: false, error: 'Context triz_ariz phải có đúng 4 trường bắt buộc' }
  }

  for (const k of keys) {
    if (!ALLOWED_KEYS.has(k)) {
      return { ok: false, error: `Phát hiện trường không hợp lệ trong context: "${k}"` }
    }
  }

  if (record.schema_version !== 1) {
    return { ok: false, error: 'schema_version phải có giá trị là 1' }
  }

  if (record.source_type !== 'triz_ariz') {
    return { ok: false, error: 'source_type phải là "triz_ariz"' }
  }

  const stepNumber = record.step_number
  if (typeof stepNumber !== 'number' || !Number.isInteger(stepNumber) || stepNumber < 1 || stepNumber > 6) {
    return { ok: false, error: 'step_number phải là số nguyên trong khoảng 1..6' }
  }

  const stepName = record.step_name
  if (typeof stepName !== 'string' || !stepName || stepName.trim() === '') {
    return { ok: false, error: 'step_name không được để trống hoặc chỉ chứa khoảng trắng' }
  }

  if (stepName.length > 100) {
    return { ok: false, error: 'step_name không được vượt quá 100 ký tự' }
  }

  if (CONTROL_CHAR_REGEX.test(stepName)) {
    return { ok: false, error: 'step_name chứa ký tự điều khiển không hợp lệ' }
  }

  return {
    ok: true,
    data: {
      schema_version: 1,
      source_type: 'triz_ariz',
      step_number: stepNumber,
      step_name: stepName,
    },
  }
}
