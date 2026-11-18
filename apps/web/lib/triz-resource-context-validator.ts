/**
 * triz-resource-context-validator.ts
 *
 * Hàm kiểm thực runtime tối thiểu (fail-closed) cho source_context thuộc variant
 * Phân tích nguồn lực TRIZ 5 nhóm (triz_resource) theo Batch C34 / ADR-015.
 */

import type { TrizResourceSourceContext } from './types'

const CONTROL_CHAR_REGEX = /[\x00-\x1f\x7f-\x9f\u2028\u2029]/

const ALLOWED_KEYS = new Set([
  'schema_version',
  'source_type',
  'resource_type',
  'resource_name',
])

const VALID_RESOURCE_TYPES = new Set([
  'substance',
  'field',
  'time',
  'space',
  'information',
])

export type ValidationResult =
  | { ok: true; data: TrizResourceSourceContext }
  | { ok: false; error: string }

export function validateTrizResourceContext(input: unknown): ValidationResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Context phải là một đối tượng hợp lệ' }
  }

  const record = input as Record<string, unknown>
  const keys = Object.keys(record)

  if (keys.length !== 4) {
    return { ok: false, error: 'Context triz_resource phải có đúng 4 trường bắt buộc' }
  }

  for (const k of keys) {
    if (!ALLOWED_KEYS.has(k)) {
      return { ok: false, error: `Phát hiện trường không hợp lệ trong context: "${k}"` }
    }
  }

  if (record.schema_version !== 1) {
    return { ok: false, error: 'schema_version phải có giá trị là 1' }
  }

  if (record.source_type !== 'triz_resource') {
    return { ok: false, error: 'source_type phải là "triz_resource"' }
  }

  const resourceType = record.resource_type
  if (typeof resourceType !== 'string' || !VALID_RESOURCE_TYPES.has(resourceType)) {
    return {
      ok: false,
      error: 'resource_type phải là một trong: "substance", "field", "time", "space", "information"',
    }
  }

  const resourceName = record.resource_name
  if (typeof resourceName !== 'string' || !resourceName || resourceName.trim() === '') {
    return { ok: false, error: 'resource_name không được để trống hoặc chỉ chứa khoảng trắng' }
  }
  if (resourceName.length > 100) {
    return { ok: false, error: 'resource_name không được vượt quá 100 ký tự' }
  }
  if (CONTROL_CHAR_REGEX.test(resourceName)) {
    return { ok: false, error: 'resource_name chứa ký tự điều khiển không hợp lệ' }
  }

  return {
    ok: true,
    data: {
      schema_version: 1,
      source_type: 'triz_resource',
      resource_type: resourceType as 'substance' | 'field' | 'time' | 'space' | 'information',
      resource_name: resourceName,
    },
  }
}
