import { validateEvidenceContext } from '../evidence-context-validator'
import type { EvidenceSourceContext } from '../types'

describe('Batch C7c-2e: validateEvidenceContext Unit Tests', () => {
  const VALID_CONTEXT: EvidenceSourceContext = {
    schema_version: 1,
    source_type: 'evidence',
    source_ref: 'docs/ADR-001-architecture.md',
  }

  describe('1. Happy Paths', () => {
    it('chấp nhận context hợp lệ chuẩn', () => {
      const result = validateEvidenceContext(VALID_CONTEXT)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data).toEqual(VALID_CONTEXT)
      }
    })

    it('chấp nhận chuỗi source_ref chứa tiếng Việt Unicode hợp lệ', () => {
      const result = validateEvidenceContext({
        ...VALID_CONTEXT,
        source_ref: 'Tạp chí Khoa học Đất & Lúa Gạo Miền Tây — Số 42, Trang 108',
      })
      expect(result.ok).toBe(true)
    })

    it('bảo toàn nguyên vẹn chuỗi gốc của source_ref mà không làm biến đổi hoặc trim', () => {
      const rawRef = 'Tài liệu Kỹ thuật TRIZ Tập 1 - Trang 42'
      const result = validateEvidenceContext({
        ...VALID_CONTEXT,
        source_ref: rawRef,
      })
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.source_ref).toBe(rawRef)
      }
    })

    it('chấp nhận chuỗi source_ref có độ dài chính xác 255 Unicode code points', () => {
      const exact255 = 'a'.repeat(255)
      const result = validateEvidenceContext({
        ...VALID_CONTEXT,
        source_ref: exact255,
      })
      expect(result.ok).toBe(true)
    })
  })

  describe('2. Kiểm tra Root Input (Null, Array, Primitive)', () => {
    it('từ chối null, undefined, số, chuỗi, boolean', () => {
      expect(validateEvidenceContext(null).ok).toBe(false)
      expect(validateEvidenceContext(undefined).ok).toBe(false)
      expect(validateEvidenceContext(123).ok).toBe(false)
      expect(validateEvidenceContext('string').ok).toBe(false)
      expect(validateEvidenceContext(true).ok).toBe(false)
    })

    it('từ chối mảng (Array)', () => {
      expect(validateEvidenceContext([]).ok).toBe(false)
      expect(validateEvidenceContext([VALID_CONTEXT]).ok).toBe(false)
    })
  })

  describe('3. Ràng buộc trường: Thiếu trường hoặc Thừa trường (Extra keys)', () => {
    it.each(['schema_version', 'source_type', 'source_ref'])(
      'từ chối khi thiếu trường bắt buộc: %s',
      (field) => {
        const copy = { ...VALID_CONTEXT } as Record<string, unknown>
        delete copy[field]
        const result = validateEvidenceContext(copy)
        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error).toMatch(/bắt buộc|thiếu/i)
        }
      }
    )

    it('từ chối khi có trường lạ ngoài 3 khóa cho phép', () => {
      const extraContext = {
        ...VALID_CONTEXT,
        extra_key: 'not_allowed',
      }
      const result = validateEvidenceContext(extraContext)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toMatch(/không cho phép|bắt buộc|extra/i)
      }
    })

    it('từ chối khi cố ý chèn source_chunk_id hoặc chunk_id vào context', () => {
      expect(
        validateEvidenceContext({
          ...VALID_CONTEXT,
          source_chunk_id: 'chk-001',
        }).ok
      ).toBe(false)

      expect(
        validateEvidenceContext({
          ...VALID_CONTEXT,
          chunk_id: 'chk-001',
        }).ok
      ).toBe(false)
    })

    it('từ chối khi cố ý chèn score hoặc title vào context', () => {
      expect(
        validateEvidenceContext({
          ...VALID_CONTEXT,
          score: 0.89,
        }).ok
      ).toBe(false)

      expect(
        validateEvidenceContext({
          ...VALID_CONTEXT,
          title: 'Document Title',
        }).ok
      ).toBe(false)
    })
  })

  describe('4. schema_version & source_type', () => {
    it('từ chối khi schema_version !== 1', () => {
      expect(validateEvidenceContext({ ...VALID_CONTEXT, schema_version: 2 }).ok).toBe(false)
      expect(validateEvidenceContext({ ...VALID_CONTEXT, schema_version: 0 }).ok).toBe(false)
      expect(validateEvidenceContext({ ...VALID_CONTEXT, schema_version: '1' }).ok).toBe(false)
      expect(validateEvidenceContext({ ...VALID_CONTEXT, schema_version: null }).ok).toBe(false)
    })

    it('từ chối khi source_type !== "evidence"', () => {
      expect(validateEvidenceContext({ ...VALID_CONTEXT, source_type: 'triz_matrix' }).ok).toBe(false)
      expect(validateEvidenceContext({ ...VALID_CONTEXT, source_type: 'principle_suggestion' }).ok).toBe(false)
      expect(validateEvidenceContext({ ...VALID_CONTEXT, source_type: 'unknown' }).ok).toBe(false)
      expect(validateEvidenceContext({ ...VALID_CONTEXT, source_type: '' }).ok).toBe(false)
    })
  })

  describe('5. Ràng buộc source_ref (1..255 code points, cấm control characters, cấm whitespace-only)', () => {
    it('từ chối khi source_ref không phải chuỗi', () => {
      expect(validateEvidenceContext({ ...VALID_CONTEXT, source_ref: 123 }).ok).toBe(false)
      expect(validateEvidenceContext({ ...VALID_CONTEXT, source_ref: null }).ok).toBe(false)
      expect(validateEvidenceContext({ ...VALID_CONTEXT, source_ref: undefined }).ok).toBe(false)
      expect(validateEvidenceContext({ ...VALID_CONTEXT, source_ref: true }).ok).toBe(false)
    })

    it('từ chối khi source_ref là chuỗi rỗng hoặc chỉ chứa khoảng trắng', () => {
      expect(validateEvidenceContext({ ...VALID_CONTEXT, source_ref: '' }).ok).toBe(false)
      expect(validateEvidenceContext({ ...VALID_CONTEXT, source_ref: '   ' }).ok).toBe(false)
      expect(validateEvidenceContext({ ...VALID_CONTEXT, source_ref: '\t' }).ok).toBe(false)
    })

    it('từ chối khi source_ref chứa ký tự điều khiển ASCII: \\n, \\r, \\t, \\0, \\x1b', () => {
      expect(validateEvidenceContext({ ...VALID_CONTEXT, source_ref: 'doc\n01' }).ok).toBe(false)
      expect(validateEvidenceContext({ ...VALID_CONTEXT, source_ref: 'doc\r01' }).ok).toBe(false)
      expect(validateEvidenceContext({ ...VALID_CONTEXT, source_ref: 'doc\t01' }).ok).toBe(false)
      expect(validateEvidenceContext({ ...VALID_CONTEXT, source_ref: 'doc\x0001' }).ok).toBe(false)
      expect(validateEvidenceContext({ ...VALID_CONTEXT, source_ref: 'doc\x1b01' }).ok).toBe(false)
    })

    it('từ chối khi ký tự điều khiển nằm ở rìa chuỗi (không tự ý strip)', () => {
      expect(validateEvidenceContext({ ...VALID_CONTEXT, source_ref: '\ndoc-01' }).ok).toBe(false)
      expect(validateEvidenceContext({ ...VALID_CONTEXT, source_ref: 'doc-01\n' }).ok).toBe(false)
      expect(validateEvidenceContext({ ...VALID_CONTEXT, source_ref: '\tdoc-01' }).ok).toBe(false)
      expect(validateEvidenceContext({ ...VALID_CONTEXT, source_ref: 'doc-01\r' }).ok).toBe(false)
    })

    it('từ chối khi source_ref chứa ngắt dòng Unicode U+2028 và U+2029', () => {
      expect(validateEvidenceContext({ ...VALID_CONTEXT, source_ref: 'doc\u202801' }).ok).toBe(false)
      expect(validateEvidenceContext({ ...VALID_CONTEXT, source_ref: 'doc\u202901' }).ok).toBe(false)
    })

    it('từ chối khi độ dài source_ref vượt quá 255 code points', () => {
      const longRef256 = 'a'.repeat(256)
      expect(validateEvidenceContext({ ...VALID_CONTEXT, source_ref: longRef256 }).ok).toBe(false)
    })
  })
})
