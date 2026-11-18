/**
 * triz-evolution-context-validator.ts
 *
 * Hàm kiểm thực runtime tối thiểu (fail-closed) cho source_context thuộc variant
 * Quy luật tiến hóa kỹ thuật Altshuller (triz_evolution) theo Batch C34 / ADR-015.
 */

import type { TrizEvolutionSourceContext } from './types'

const CONTROL_CHAR_REGEX = /[\x00-\x1f\x7f-\x9f\u2028\u2029]/

const ALLOWED_KEYS = new Set([
  'schema_version',
  'source_type',
  'trend_id',
  'trend_name',
])

export type ValidationResult =
  | { ok: true; data: TrizEvolutionSourceContext }
  | { ok: false; error: string }

export function validateTrizEvolutionContext(input: unknown): ValidationResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Context phải là một đối tượng hợp lệ' }
  }

  const record = input as Record<string, unknown>
  const keys = Object.keys(record)

  if (keys.length !== 4) {
    return { ok: false, error: 'Context triz_evolution phải có đúng 4 trường bắt buộc' }
  }

  for (const k of keys) {
    if (!ALLOWED_KEYS.has(k)) {
      return { ok: false, error: `Phát hiện trường không hợp lệ trong context: "${k}"` }
    }
  }

  if (record.schema_version !== 1) {
    return { ok: false, error: 'schema_version phải có giá trị là 1' }
  }

  if (record.source_type !== 'triz_evolution') {
    return { ok: false, error: 'source_type phải là "triz_evolution"' }
  }

  const trendId = record.trend_id
  if (typeof trendId !== 'string' || !trendId || trendId.trim() === '') {
    return { ok: false, error: 'trend_id không được để trống hoặc chỉ chứa khoảng trắng' }
  }
  if (trendId.length > 100) {
    return { ok: false, error: 'trend_id không được vượt quá 100 ký tự' }
  }
  if (CONTROL_CHAR_REGEX.test(trendId)) {
    return { ok: false, error: 'trend_id chứa ký tự điều khiển không hợp lệ' }
  }

  const trendName = record.trend_name
  if (typeof trendName !== 'string' || !trendName || trendName.trim() === '') {
    return { ok: false, error: 'trend_name không được để trống hoặc chỉ chứa khoảng trắng' }
  }
  if (trendName.length > 100) {
    return { ok: false, error: 'trend_name không được vượt quá 100 ký tự' }
  }
  if (CONTROL_CHAR_REGEX.test(trendName)) {
    return { ok: false, error: 'trend_name chứa ký tự điều khiển không hợp lệ' }
  }

  return {
    ok: true,
    data: {
      schema_version: 1,
      source_type: 'triz_evolution',
      trend_id: trendId,
      trend_name: trendName,
    },
  }
}
