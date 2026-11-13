import { validateTrizMatrixContext } from '../triz-matrix-context-validator'
import type { TrizMatrixSourceContext } from '../types'

describe('validateTrizMatrixContext (Batch C7c-2c)', () => {
  const VALID_CONTEXT: TrizMatrixSourceContext = {
    schema_version: 1,
    source_type: 'triz_matrix',
    principle_id: 10,
    improving_param_id: 1,
    worsening_param_id: 14,
    lens: 'business',
  }

  describe('Happy path', () => {
    it('chấp nhận context hợp lệ với lens business', () => {
      const res = validateTrizMatrixContext(VALID_CONTEXT)
      expect(res.ok).toBe(true)
      if (res.ok) {
        expect(res.data).toEqual(VALID_CONTEXT)
      }
    })

    it('chấp nhận context hợp lệ với lens engineering', () => {
      const input = { ...VALID_CONTEXT, lens: 'engineering' }
      const res = validateTrizMatrixContext(input)
      expect(res.ok).toBe(true)
      if (res.ok) {
        expect(res.data.lens).toBe('engineering')
      }
    })

    it('chấp nhận context hợp lệ với lens everyday', () => {
      const input = { ...VALID_CONTEXT, lens: 'everyday' }
      const res = validateTrizMatrixContext(input)
      expect(res.ok).toBe(true)
      if (res.ok) {
        expect(res.data.lens).toBe('everyday')
      }
    })

    it('chấp nhận biên principle_id = 1 và 40', () => {
      expect(validateTrizMatrixContext({ ...VALID_CONTEXT, principle_id: 1 }).ok).toBe(true)
      expect(validateTrizMatrixContext({ ...VALID_CONTEXT, principle_id: 40 }).ok).toBe(true)
    })

    it('chấp nhận biên improving_param_id = 1 và 39', () => {
      expect(validateTrizMatrixContext({ ...VALID_CONTEXT, improving_param_id: 1 }).ok).toBe(true)
      expect(validateTrizMatrixContext({ ...VALID_CONTEXT, improving_param_id: 39 }).ok).toBe(true)
    })

    it('chấp nhận biên worsening_param_id = 1 và 39', () => {
      expect(validateTrizMatrixContext({ ...VALID_CONTEXT, worsening_param_id: 1 }).ok).toBe(true)
      expect(validateTrizMatrixContext({ ...VALID_CONTEXT, worsening_param_id: 39 }).ok).toBe(true)
    })
  })

  describe('Cấu trúc & Trường lạ/thiếu', () => {
    it('từ chối null, undefined, boolean, string, array', () => {
      expect(validateTrizMatrixContext(null).ok).toBe(false)
      expect(validateTrizMatrixContext(undefined).ok).toBe(false)
      expect(validateTrizMatrixContext(false).ok).toBe(false)
      expect(validateTrizMatrixContext('string').ok).toBe(false)
      expect(validateTrizMatrixContext([]).ok).toBe(false)
      expect(validateTrizMatrixContext(123).ok).toBe(false)
    })

    it('từ chối khi thiếu từng field', () => {
      const fields: Array<keyof TrizMatrixSourceContext> = [
        'schema_version',
        'source_type',
        'principle_id',
        'improving_param_id',
        'worsening_param_id',
        'lens',
      ]
      for (const field of fields) {
        const copy: any = { ...VALID_CONTEXT }
        delete copy[field]
        const res = validateTrizMatrixContext(copy)
        expect(res.ok).toBe(false)
      }
    })

    it('từ chối khi thừa trường lạ (extra="forbid")', () => {
      const withExtra = { ...VALID_CONTEXT, extra_prop: 'hacker' }
      const res = validateTrizMatrixContext(withExtra)
      expect(res.ok).toBe(false)
      if (!res.ok) {
        expect(res.error).toMatch(/trường không cho phép|đúng 6 trường/i)
      }
    })

    it('từ chối khi có source_chunk_id trong context', () => {
      const withChunk = { ...VALID_CONTEXT, source_chunk_id: '123' }
      const res = validateTrizMatrixContext(withChunk)
      expect(res.ok).toBe(false)
    })
  })

  describe('schema_version & source_type', () => {
    it('từ chối schema_version khác 1', () => {
      expect(validateTrizMatrixContext({ ...VALID_CONTEXT, schema_version: 2 }).ok).toBe(false)
      expect(validateTrizMatrixContext({ ...VALID_CONTEXT, schema_version: '1' }).ok).toBe(false)
    })

    it('từ chối source_type khác triz_matrix', () => {
      expect(validateTrizMatrixContext({ ...VALID_CONTEXT, source_type: 'triz_9_windows' }).ok).toBe(false)
      expect(validateTrizMatrixContext({ ...VALID_CONTEXT, source_type: 'other' }).ok).toBe(false)
    })
  })

  describe('Kiểm tra nguyên ngặt principle_id (1..40)', () => {
    it('từ chối principle_id = 0 hoặc 41', () => {
      expect(validateTrizMatrixContext({ ...VALID_CONTEXT, principle_id: 0 }).ok).toBe(false)
      expect(validateTrizMatrixContext({ ...VALID_CONTEXT, principle_id: 41 }).ok).toBe(false)
    })

    it('từ chối float, string số, boolean, NaN, Infinity', () => {
      expect(validateTrizMatrixContext({ ...VALID_CONTEXT, principle_id: 10.5 }).ok).toBe(false)
      expect(validateTrizMatrixContext({ ...VALID_CONTEXT, principle_id: '10' }).ok).toBe(false)
      expect(validateTrizMatrixContext({ ...VALID_CONTEXT, principle_id: true }).ok).toBe(false)
      expect(validateTrizMatrixContext({ ...VALID_CONTEXT, principle_id: NaN }).ok).toBe(false)
      expect(validateTrizMatrixContext({ ...VALID_CONTEXT, principle_id: Infinity }).ok).toBe(false)
    })
  })

  describe('Kiểm tra nguyên ngặt improving_param_id & worsening_param_id (1..39)', () => {
    it('từ chối improving_param_id = 0 hoặc 40', () => {
      expect(validateTrizMatrixContext({ ...VALID_CONTEXT, improving_param_id: 0 }).ok).toBe(false)
      expect(validateTrizMatrixContext({ ...VALID_CONTEXT, improving_param_id: 40 }).ok).toBe(false)
    })

    it('từ chối worsening_param_id = 0 hoặc 40', () => {
      expect(validateTrizMatrixContext({ ...VALID_CONTEXT, worsening_param_id: 0 }).ok).toBe(false)
      expect(validateTrizMatrixContext({ ...VALID_CONTEXT, worsening_param_id: 40 }).ok).toBe(false)
    })

    it('từ chối float, string số, boolean, NaN, Infinity cho param_ids', () => {
      expect(validateTrizMatrixContext({ ...VALID_CONTEXT, improving_param_id: 1.5 }).ok).toBe(false)
      expect(validateTrizMatrixContext({ ...VALID_CONTEXT, improving_param_id: '1' }).ok).toBe(false)
      expect(validateTrizMatrixContext({ ...VALID_CONTEXT, improving_param_id: true }).ok).toBe(false)
      expect(validateTrizMatrixContext({ ...VALID_CONTEXT, improving_param_id: NaN }).ok).toBe(false)

      expect(validateTrizMatrixContext({ ...VALID_CONTEXT, worsening_param_id: 14.5 }).ok).toBe(false)
      expect(validateTrizMatrixContext({ ...VALID_CONTEXT, worsening_param_id: '14' }).ok).toBe(false)
      expect(validateTrizMatrixContext({ ...VALID_CONTEXT, worsening_param_id: false }).ok).toBe(false)
      expect(validateTrizMatrixContext({ ...VALID_CONTEXT, worsening_param_id: NaN }).ok).toBe(false)
    })
  })

  describe('Kiểm tra lens enum', () => {
    it('từ chối lens không hợp lệ', () => {
      expect(validateTrizMatrixContext({ ...VALID_CONTEXT, lens: 'medical' }).ok).toBe(false)
      expect(validateTrizMatrixContext({ ...VALID_CONTEXT, lens: '' }).ok).toBe(false)
      expect(validateTrizMatrixContext({ ...VALID_CONTEXT, lens: 123 }).ok).toBe(false)
    })
  })
})
