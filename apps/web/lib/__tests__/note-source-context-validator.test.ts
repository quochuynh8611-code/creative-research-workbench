import { validateNoteSourceContext } from '../note-source-context-validator'
import type { Triz9WindowsSourceContext, TrizMatrixSourceContext } from '../types'

describe('validateNoteSourceContext dispatcher (Batch C7c-2c)', () => {
  const VALID_9_WINDOWS: Triz9WindowsSourceContext = {
    schema_version: 1,
    source_type: 'triz_9_windows',
    lens: 'engineering',
    level: 'system',
    time: 'present',
    cell_label: 'Hệ thống kỹ thuật hiện tại',
  }

  const VALID_MATRIX: TrizMatrixSourceContext = {
    schema_version: 1,
    source_type: 'triz_matrix',
    principle_id: 10,
    improving_param_id: 1,
    worsening_param_id: 14,
    lens: 'business',
  }

  it('route thành công triz_9_windows', () => {
    const res = validateNoteSourceContext(VALID_9_WINDOWS)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.data.source_type).toBe('triz_9_windows')
    }
  })

  it('route thành công triz_matrix', () => {
    const res = validateNoteSourceContext(VALID_MATRIX)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.data.source_type).toBe('triz_matrix')
    }
  })

  it('bắt lỗi khi triz_9_windows không hợp lệ', () => {
    const invalid9W = { ...VALID_9_WINDOWS, cell_label: '' }
    const res = validateNoteSourceContext(invalid9W)
    expect(res.ok).toBe(false)
  })

  it('bắt lỗi khi triz_matrix không hợp lệ', () => {
    const invalidMatrix = { ...VALID_MATRIX, principle_id: 0 }
    const res = validateNoteSourceContext(invalidMatrix)
    expect(res.ok).toBe(false)
  })

  it('từ chối khi input không phải object hoặc null/undefined', () => {
    expect(validateNoteSourceContext(null).ok).toBe(false)
    expect(validateNoteSourceContext(undefined).ok).toBe(false)
    expect(validateNoteSourceContext('triz_matrix').ok).toBe(false)
    expect(validateNoteSourceContext(123).ok).toBe(false)
    expect(validateNoteSourceContext([]).ok).toBe(false)
  })

  it('từ chối khi thiếu trường source_type', () => {
    const noSourceType = { schema_version: 1, lens: 'business' }
    const res = validateNoteSourceContext(noSourceType)
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error).toMatch(/source_type/i)
    }
  })

  it('từ chối khi source_type không được hỗ trợ (unknown)', () => {
    const unknownType = { schema_version: 1, source_type: 'unsupported_source' }
    const res = validateNoteSourceContext(unknownType)
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error).toMatch(/không được hỗ trợ|nguồn không hợp lệ/i)
    }
  })
})
