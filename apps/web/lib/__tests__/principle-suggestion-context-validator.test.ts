import { validatePrincipleSuggestionContext } from '../principle-suggestion-context-validator'
import type { PrincipleSuggestionSourceContext } from '../types'

describe('Batch C7c-2d-2: validatePrincipleSuggestionContext Unit Tests', () => {
  const VALID_CONTEXT: PrincipleSuggestionSourceContext = {
    schema_version: 1,
    source_type: 'principle_suggestion',
    principle_id: 35,
    method_id: 'triz-principle-35',
  }

  describe('1. Happy Paths', () => {
    it('chấp nhận context hợp lệ chuẩn', () => {
      const result = validatePrincipleSuggestionContext(VALID_CONTEXT)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data).toEqual(VALID_CONTEXT)
      }
    })

    it('chấp nhận biên principle_id = 1 và principle_id = 40', () => {
      expect(
        validatePrincipleSuggestionContext({
          ...VALID_CONTEXT,
          principle_id: 1,
          method_id: 'triz-principle-1',
        }).ok
      ).toBe(true)

      expect(
        validatePrincipleSuggestionContext({
          ...VALID_CONTEXT,
          principle_id: 40,
          method_id: 'triz-principle-40',
        }).ok
      ).toBe(true)
    })

    it('chấp nhận chuỗi method_id chứa tiếng Việt Unicode hợp lệ', () => {
      const result = validatePrincipleSuggestionContext({
        ...VALID_CONTEXT,
        method_id: 'phuong-phap-chuyen-doi-thong-so-35',
      })
      expect(result.ok).toBe(true)
    })

    it('bảo toàn nguyên vẹn chuỗi gốc của method_id mà không làm biến đổi', () => {
      const rawMethodId = 'triz-principle-35'
      const result = validatePrincipleSuggestionContext({
        ...VALID_CONTEXT,
        method_id: rawMethodId,
      })
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.method_id).toBe(rawMethodId)
      }
    })
  })

  describe('2. Kiểm tra Root Input (Null, Array, Primitive)', () => {
    it('từ chối null, undefined, số, chuỗi, boolean', () => {
      expect(validatePrincipleSuggestionContext(null).ok).toBe(false)
      expect(validatePrincipleSuggestionContext(undefined).ok).toBe(false)
      expect(validatePrincipleSuggestionContext(123).ok).toBe(false)
      expect(validatePrincipleSuggestionContext('string').ok).toBe(false)
      expect(validatePrincipleSuggestionContext(true).ok).toBe(false)
    })

    it('từ chối mảng (Array)', () => {
      expect(validatePrincipleSuggestionContext([]).ok).toBe(false)
      expect(validatePrincipleSuggestionContext([VALID_CONTEXT]).ok).toBe(false)
    })
  })

  describe('3. Ràng buộc trường: Thiếu trường hoặc Thừa trường (Extra keys)', () => {
    it.each(['schema_version', 'source_type', 'principle_id', 'method_id'])(
      'từ chối khi thiếu trường bắt buộc: %s',
      (field) => {
        const copy = { ...VALID_CONTEXT } as Record<string, unknown>
        delete copy[field]
        const result = validatePrincipleSuggestionContext(copy)
        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error).toMatch(/bắt buộc|thiếu/i)
        }
      }
    )

    it('từ chối khi có trường lạ ngoài 4 khóa cho phép', () => {
      const extraContext = {
        ...VALID_CONTEXT,
        extra_key: 'not_allowed',
      }
      const result = validatePrincipleSuggestionContext(extraContext)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toMatch(/không cho phép|bắt buộc|extra/i)
      }
    })

    it('từ chối khi cố ý chèn source_chunk_id hoặc title vào context', () => {
      expect(
        validatePrincipleSuggestionContext({
          ...VALID_CONTEXT,
          source_chunk_id: 'some-chunk-id',
        }).ok
      ).toBe(false)

      expect(
        validatePrincipleSuggestionContext({
          ...VALID_CONTEXT,
          title: 'Parameter Changes',
        }).ok
      ).toBe(false)
    })
  })

  describe('4. schema_version & source_type', () => {
    it('từ chối khi schema_version !== 1', () => {
      expect(validatePrincipleSuggestionContext({ ...VALID_CONTEXT, schema_version: 2 }).ok).toBe(false)
      expect(validatePrincipleSuggestionContext({ ...VALID_CONTEXT, schema_version: 0 }).ok).toBe(false)
      expect(validatePrincipleSuggestionContext({ ...VALID_CONTEXT, schema_version: '1' }).ok).toBe(false)
      expect(validatePrincipleSuggestionContext({ ...VALID_CONTEXT, schema_version: null }).ok).toBe(false)
    })

    it('từ chối khi source_type !== "principle_suggestion"', () => {
      expect(validatePrincipleSuggestionContext({ ...VALID_CONTEXT, source_type: 'triz_matrix' }).ok).toBe(false)
      expect(validatePrincipleSuggestionContext({ ...VALID_CONTEXT, source_type: 'unknown' }).ok).toBe(false)
      expect(validatePrincipleSuggestionContext({ ...VALID_CONTEXT, source_type: '' }).ok).toBe(false)
    })
  })

  describe('5. Ràng buộc StrictInt principle_id (1..40)', () => {
    it('từ chối principle_id ngoài dải: 0 và 41', () => {
      expect(validatePrincipleSuggestionContext({ ...VALID_CONTEXT, principle_id: 0 }).ok).toBe(false)
      expect(validatePrincipleSuggestionContext({ ...VALID_CONTEXT, principle_id: 41 }).ok).toBe(false)
      expect(validatePrincipleSuggestionContext({ ...VALID_CONTEXT, principle_id: -1 }).ok).toBe(false)
    })

    it('từ chối principle_id không phải số nguyên: float, chuỗi số, boolean, NaN, Infinity', () => {
      expect(validatePrincipleSuggestionContext({ ...VALID_CONTEXT, principle_id: 1.5 }).ok).toBe(false)
      expect(validatePrincipleSuggestionContext({ ...VALID_CONTEXT, principle_id: '35' }).ok).toBe(false)
      expect(validatePrincipleSuggestionContext({ ...VALID_CONTEXT, principle_id: true }).ok).toBe(false)
      expect(validatePrincipleSuggestionContext({ ...VALID_CONTEXT, principle_id: false }).ok).toBe(false)
      expect(validatePrincipleSuggestionContext({ ...VALID_CONTEXT, principle_id: NaN }).ok).toBe(false)
      expect(validatePrincipleSuggestionContext({ ...VALID_CONTEXT, principle_id: Infinity }).ok).toBe(false)
    })
  })

  describe('6. Ràng buộc method_id (Free-text 1..100 code points, cấm control characters)', () => {
    it('từ chối khi method_id không phải chuỗi', () => {
      expect(validatePrincipleSuggestionContext({ ...VALID_CONTEXT, method_id: 35 }).ok).toBe(false)
      expect(validatePrincipleSuggestionContext({ ...VALID_CONTEXT, method_id: null }).ok).toBe(false)
      expect(validatePrincipleSuggestionContext({ ...VALID_CONTEXT, method_id: undefined }).ok).toBe(false)
      expect(validatePrincipleSuggestionContext({ ...VALID_CONTEXT, method_id: true }).ok).toBe(false)
    })

    it('từ chối khi method_id là chuỗi rỗng hoặc chỉ chứa khoảng trắng', () => {
      expect(validatePrincipleSuggestionContext({ ...VALID_CONTEXT, method_id: '' }).ok).toBe(false)
      expect(validatePrincipleSuggestionContext({ ...VALID_CONTEXT, method_id: '   ' }).ok).toBe(false)
      expect(validatePrincipleSuggestionContext({ ...VALID_CONTEXT, method_id: '\t' }).ok).toBe(false)
    })

    it('từ chối khi method_id chứa ký tự điều khiển ASCII: \\n, \\r, \\t, \\0', () => {
      expect(validatePrincipleSuggestionContext({ ...VALID_CONTEXT, method_id: 'method\n01' }).ok).toBe(false)
      expect(validatePrincipleSuggestionContext({ ...VALID_CONTEXT, method_id: 'method\r01' }).ok).toBe(false)
      expect(validatePrincipleSuggestionContext({ ...VALID_CONTEXT, method_id: 'method\t01' }).ok).toBe(false)
      expect(validatePrincipleSuggestionContext({ ...VALID_CONTEXT, method_id: 'method\x0001' }).ok).toBe(false)
      expect(validatePrincipleSuggestionContext({ ...VALID_CONTEXT, method_id: 'method\x1b01' }).ok).toBe(false)
    })

    it('từ chối khi ký tự điều khiển nằm ở rìa chuỗi (không tự ý strip)', () => {
      expect(validatePrincipleSuggestionContext({ ...VALID_CONTEXT, method_id: '\nmethod-01' }).ok).toBe(false)
      expect(validatePrincipleSuggestionContext({ ...VALID_CONTEXT, method_id: 'method-01\n' }).ok).toBe(false)
      expect(validatePrincipleSuggestionContext({ ...VALID_CONTEXT, method_id: '\tmethod-01' }).ok).toBe(false)
    })

    it('từ chối khi method_id chứa ngắt dòng Unicode U+2028 và U+2029', () => {
      expect(validatePrincipleSuggestionContext({ ...VALID_CONTEXT, method_id: 'method\u202801' }).ok).toBe(false)
      expect(validatePrincipleSuggestionContext({ ...VALID_CONTEXT, method_id: 'method\u202901' }).ok).toBe(false)
    })

    it('từ chối khi độ dài method_id vượt quá 100 code points', () => {
      const longMethodId = 'a'.repeat(101)
      expect(validatePrincipleSuggestionContext({ ...VALID_CONTEXT, method_id: longMethodId }).ok).toBe(false)

      const exact100 = 'a'.repeat(100)
      expect(validatePrincipleSuggestionContext({ ...VALID_CONTEXT, method_id: exact100 }).ok).toBe(true)
    })
  })
})
