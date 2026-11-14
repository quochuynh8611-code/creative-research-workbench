import { validateCandidateSolutionContext } from '@/lib/candidate-solution-context-validator'
import type { CandidateSolutionSourceContext } from '@/lib/types'

describe('Batch C7c-2f: validateCandidateSolutionContext Unit Tests', () => {
  const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'

  const BASE_VALID_CONTEXT: CandidateSolutionSourceContext = {
    schema_version: 1,
    source_type: 'candidate_solution',
    solution_id: VALID_UUID,
    solution_status: 'accepted',
  }

  describe('1. Happy Paths', () => {
    it('chấp nhận context hợp lệ chuẩn 4 trường, không có principle_used', () => {
      const result = validateCandidateSolutionContext(BASE_VALID_CONTEXT)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data).toEqual(BASE_VALID_CONTEXT)
      }
    })

    it('chấp nhận context hợp lệ với principle_used là số nguyên biên: 1 và 40', () => {
      const resMin = validateCandidateSolutionContext({
        ...BASE_VALID_CONTEXT,
        principle_used: 1,
      })
      expect(resMin.ok).toBe(true)
      if (resMin.ok) {
        expect(resMin.data.principle_used).toBe(1)
      }

      const resMax = validateCandidateSolutionContext({
        ...BASE_VALID_CONTEXT,
        principle_used: 40,
      })
      expect(resMax.ok).toBe(true)
      if (resMax.ok) {
        expect(resMax.data.principle_used).toBe(40)
      }
    })

    it('chấp nhận context hợp lệ với principle_used là chuỗi hợp lệ <= 100 code points', () => {
      const validStr = 'Nguyên tắc 35: Chuyển đổi trạng thái lý - hóa của vật thể'
      const result = validateCandidateSolutionContext({
        ...BASE_VALID_CONTEXT,
        principle_used: validStr,
      })
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.principle_used).toBe(validStr)
      }
    })

    it('chấp nhận context hợp lệ khi principle_used là null', () => {
      const result = validateCandidateSolutionContext({
        ...BASE_VALID_CONTEXT,
        principle_used: null,
      })
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.principle_used).toBeUndefined()
      }
    })

    it('chấp nhận context hợp lệ với cả 3 trạng thái solution_status: candidate, accepted, rejected', () => {
      for (const status of ['candidate', 'accepted', 'rejected'] as const) {
        const result = validateCandidateSolutionContext({
          ...BASE_VALID_CONTEXT,
          solution_status: status,
        })
        expect(result.ok).toBe(true)
      }
    })
  })

  describe('2. Kiểm tra Root Input (Null, Array, Primitive)', () => {
    it('từ chối null, undefined, số, chuỗi, boolean', () => {
      expect(validateCandidateSolutionContext(null).ok).toBe(false)
      expect(validateCandidateSolutionContext(undefined).ok).toBe(false)
      expect(validateCandidateSolutionContext(123).ok).toBe(false)
      expect(validateCandidateSolutionContext('candidate_solution').ok).toBe(false)
      expect(validateCandidateSolutionContext(true).ok).toBe(false)
    })

    it('từ chối mảng (Array)', () => {
      expect(validateCandidateSolutionContext([]).ok).toBe(false)
      expect(validateCandidateSolutionContext([BASE_VALID_CONTEXT]).ok).toBe(false)
    })
  })

  describe('3. Ràng buộc trường bắt buộc và cấm trường lạ (Extra Keys)', () => {
    it.each(['schema_version', 'source_type', 'solution_id', 'solution_status'])(
      'từ chối khi thiếu trường bắt buộc: %s',
      (field) => {
        const copy = { ...BASE_VALID_CONTEXT } as Record<string, unknown>
        delete copy[field]
        const result = validateCandidateSolutionContext(copy)
        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error).toMatch(/bắt buộc|thiếu/i)
        }
      }
    )

    it('từ chối các extra keys liên quan đến giải pháp và tri thức: title, mechanism, risk_notes, novelty_score, feasibility_score, source_chunk_id, chunk_id, score', () => {
      const disallowedKeys = [
        'title',
        'mechanism',
        'risk_notes',
        'novelty_score',
        'feasibility_score',
        'source_chunk_id',
        'chunk_id',
        'score',
      ]
      for (const extraKey of disallowedKeys) {
        const extraContext = {
          ...BASE_VALID_CONTEXT,
          [extraKey]: 'some_value',
        }
        const result = validateCandidateSolutionContext(extraContext)
        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error).toMatch(/không cho phép|bắt buộc|extra/i)
        }
      }
    })
  })

  describe('4. Ràng buộc schema_version & source_type', () => {
    it('từ chối schema_version !== 1, kể cả dạng chuỗi "1"', () => {
      expect(
        validateCandidateSolutionContext({
          ...BASE_VALID_CONTEXT,
          schema_version: 2,
        }).ok
      ).toBe(false)

      expect(
        validateCandidateSolutionContext({
          ...BASE_VALID_CONTEXT,
          schema_version: '1',
        }).ok
      ).toBe(false)
    })

    it('từ chối source_type !== "candidate_solution"', () => {
      expect(
        validateCandidateSolutionContext({
          ...BASE_VALID_CONTEXT,
          source_type: 'triz_matrix',
        }).ok
      ).toBe(false)

      expect(
        validateCandidateSolutionContext({
          ...BASE_VALID_CONTEXT,
          source_type: 'solution',
        }).ok
      ).toBe(false)
    })
  })

  describe('5. Ràng buộc solution_id (UUID)', () => {
    it('từ chối solution_id không phải UUID, rỗng, null, số', () => {
      expect(
        validateCandidateSolutionContext({
          ...BASE_VALID_CONTEXT,
          solution_id: 'not-a-uuid',
        }).ok
      ).toBe(false)

      expect(
        validateCandidateSolutionContext({
          ...BASE_VALID_CONTEXT,
          solution_id: 'sol-001',
        }).ok
      ).toBe(false)

      expect(
        validateCandidateSolutionContext({
          ...BASE_VALID_CONTEXT,
          solution_id: 'sol-12345',
        }).ok
      ).toBe(false)

      expect(
        validateCandidateSolutionContext({
          ...BASE_VALID_CONTEXT,
          solution_id: '',
        }).ok
      ).toBe(false)

      expect(
        validateCandidateSolutionContext({
          ...BASE_VALID_CONTEXT,
          solution_id: null,
        }).ok
      ).toBe(false)

      expect(
        validateCandidateSolutionContext({
          ...BASE_VALID_CONTEXT,
          solution_id: 12345,
        }).ok
      ).toBe(false)
    })
  })

  describe('6. Ràng buộc solution_status', () => {
    it('từ chối solution_status nằm ngoài 3 enum candidate, accepted, rejected', () => {
      for (const invalidStatus of ['pending', 'draft', 'in_progress', 'approved', '']) {
        expect(
          validateCandidateSolutionContext({
            ...BASE_VALID_CONTEXT,
            solution_status: invalidStatus,
          }).ok
        ).toBe(false)
      }
    })
  })

  describe('7. Ràng buộc principle_used', () => {
    it('từ chối principle_used có kiểu boolean, float, NaN, Infinity, object', () => {
      expect(
        validateCandidateSolutionContext({
          ...BASE_VALID_CONTEXT,
          principle_used: true,
        }).ok
      ).toBe(false)

      expect(
        validateCandidateSolutionContext({
          ...BASE_VALID_CONTEXT,
          principle_used: false,
        }).ok
      ).toBe(false)

      expect(
        validateCandidateSolutionContext({
          ...BASE_VALID_CONTEXT,
          principle_used: 10.5,
        }).ok
      ).toBe(false)

      expect(
        validateCandidateSolutionContext({
          ...BASE_VALID_CONTEXT,
          principle_used: NaN,
        }).ok
      ).toBe(false)

      expect(
        validateCandidateSolutionContext({
          ...BASE_VALID_CONTEXT,
          principle_used: Infinity,
        }).ok
      ).toBe(false)

      expect(
        validateCandidateSolutionContext({
          ...BASE_VALID_CONTEXT,
          principle_used: { id: 10 },
        }).ok
      ).toBe(false)
    })

    it('từ chối principle_used là số nguyên ngoài khoảng 1..40 (0 và 41)', () => {
      expect(
        validateCandidateSolutionContext({
          ...BASE_VALID_CONTEXT,
          principle_used: 0,
        }).ok
      ).toBe(false)

      expect(
        validateCandidateSolutionContext({
          ...BASE_VALID_CONTEXT,
          principle_used: 41,
        }).ok
      ).toBe(false)

      expect(
        validateCandidateSolutionContext({
          ...BASE_VALID_CONTEXT,
          principle_used: -1,
        }).ok
      ).toBe(false)
    })

    it('từ chối principle_used dạng chuỗi rỗng, whitespace-only, hoặc chứa ký tự điều khiển/ngắt dòng', () => {
      const invalidStrings = [
        '',
        '   ',
        ' \t \n ',
        'Nguyên tắc\n35',
        'Nguyên tắc\r35',
        'Nguyên tắc\t35',
        'Nguyên tắc\0 35',
        'Nguyên tắc\x1b 35',
        'Nguyên tắc\u202835',
        'Nguyên tắc\u202935',
      ]
      for (const invalidStr of invalidStrings) {
        const result = validateCandidateSolutionContext({
          ...BASE_VALID_CONTEXT,
          principle_used: invalidStr,
        })
        expect(result.ok).toBe(false)
      }
    })

    it('từ chối principle_used dạng chuỗi dài vượt quá 100 code points', () => {
      const str101 = 'a'.repeat(101)
      expect(
        validateCandidateSolutionContext({
          ...BASE_VALID_CONTEXT,
          principle_used: str101,
        }).ok
      ).toBe(false)

      const str100 = 'a'.repeat(100)
      expect(
        validateCandidateSolutionContext({
          ...BASE_VALID_CONTEXT,
          principle_used: str100,
        }).ok
      ).toBe(true)
    })

    it('bảo toàn chuỗi principle_used gốc, không tự ý trim khoảng trắng hợp lệ', () => {
      const rawVal = '  Nguyên tắc 35: Chuyển đổi trạng thái  '
      const result = validateCandidateSolutionContext({
        ...BASE_VALID_CONTEXT,
        principle_used: rawVal,
      })
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.principle_used).toBe(rawVal)
      }
    })
  })
})
