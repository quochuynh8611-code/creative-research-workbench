/**
 * note-source-context-validator.ts
 *
 * Hàm điều phối (dispatcher) kiểm thực runtime cho source_context của ResearchNote.
 * Hỗ trợ phân nhánh an toàn theo discriminator `source_type`:
 *   - 'triz_9_windows': validateTriz9WindowsContext
 *   - 'triz_matrix': validateTrizMatrixContext
 *   - 'principle_suggestion': validatePrincipleSuggestionContext
 *   - 'evidence': validateEvidenceContext
 *   - 'candidate_solution': validateCandidateSolutionContext
 *   - 'triz_ariz': validateTrizArizContext
 *   - 'triz_evolution': validateTrizEvolutionContext
 *   - 'triz_resource': validateTrizResourceContext
 *   - các nguồn khác / unknown: fail-closed với thông báo lỗi chuỗi an toàn.
 */

import type { NoteSourceContext } from './types'
import { validateTriz9WindowsContext } from './triz-9-windows-context-validator'
import { validateTrizMatrixContext } from './triz-matrix-context-validator'
import { validatePrincipleSuggestionContext } from './principle-suggestion-context-validator'
import { validateEvidenceContext } from './evidence-context-validator'
import { validateCandidateSolutionContext } from './candidate-solution-context-validator'
import { validateTrizArizContext } from './triz-ariz-context-validator'
import { validateTrizEvolutionContext } from './triz-evolution-context-validator'
import { validateTrizResourceContext } from './triz-resource-context-validator'

export type NoteSourceContextValidationResult =
  | { ok: true; data: NoteSourceContext }
  | { ok: false; error: string }

export function validateNoteSourceContext(input: unknown): NoteSourceContextValidationResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Context phải là một đối tượng hợp lệ' }
  }

  const record = input as Record<string, unknown>
  const sourceType = record.source_type

  if (typeof sourceType !== 'string' || !sourceType) {
    return { ok: false, error: 'Context thiếu trường source_type bắt buộc' }
  }

  if (sourceType === 'triz_9_windows') {
    return validateTriz9WindowsContext(input)
  }

  if (sourceType === 'triz_matrix') {
    return validateTrizMatrixContext(input)
  }

  if (sourceType === 'principle_suggestion') {
    return validatePrincipleSuggestionContext(input)
  }

  if (sourceType === 'evidence') {
    return validateEvidenceContext(input)
  }

  if (sourceType === 'candidate_solution') {
    return validateCandidateSolutionContext(input)
  }

  if (sourceType === 'triz_ariz') {
    return validateTrizArizContext(input)
  }

  if (sourceType === 'triz_evolution') {
    return validateTrizEvolutionContext(input)
  }

  if (sourceType === 'triz_resource') {
    return validateTrizResourceContext(input)
  }

  return {
    ok: false,
    error: `source_type "${sourceType}" không được hỗ trợ hoặc không hợp lệ`,
  }
}
