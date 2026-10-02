import {
  buildSearchExplorerUrl,
  parseSearchExplorerParams,
  buildSearchPayload,
} from '../search-utils'
import type { SearchExplorerState } from '../search-utils'

describe('Search Utils Tests (Phase 10.3 Increment 2)', () => {
  describe('buildSearchExplorerUrl', () => {
    it('1. Serialize state cơ bản chỉ có query', () => {
      const url = buildSearchExplorerUrl({ query: 'mâu thuẫn kỹ thuật' })
      expect(url).toBe('/search?q=m%C3%A2u+thu%E1%BA%ABn+k%E1%BB%B9+thu%E1%BA%ADt')
    })

    it('2. Serialize đầy đủ query, topic, source_type, golden, phase, top_k', () => {
      const state: SearchExplorerState = {
        query: 'triz',
        topic: 'contradiction',
        source_type: 'golden_kb',
        golden: true,
        phase: 'solution',
        top_k: 20,
      }
      const url = buildSearchExplorerUrl(state)
      expect(url).toContain('/search?')
      expect(url).toContain('q=triz')
      expect(url).toContain('topic=contradiction')
      expect(url).toContain('source_type=golden_kb')
      expect(url).toContain('golden=true')
      expect(url).toContain('phase=solution')
      expect(url).toContain('top_k=20')
    })

    it('3. Bỏ qua các field falsy hoặc chuỗi rỗng', () => {
      const url = buildSearchExplorerUrl({
        query: 'composite',
        topic: '',
        golden: false,
        source_type: '',
      })
      expect(url).toBe('/search?q=composite')
    })
  })

  describe('parseSearchExplorerParams', () => {
    it('4. Parse URLSearchParams với các kiểu dữ liệu string, boolean, number', () => {
      const params = new URLSearchParams(
        'q=pin+lithium&golden=true&top_k=50&topic=case_study&phase=problem_definition'
      )
      const parsed = parseSearchExplorerParams(params)

      expect(parsed.query).toBe('pin lithium')
      expect(parsed.golden).toBe(true)
      expect(parsed.top_k).toBe(50)
      expect(parsed.topic).toBe('case_study')
      expect(parsed.phase).toBe('problem_definition')
    })

    it('5. Parse object parameters (ví dụ từ searchParams của Next.js page)', () => {
      const paramsObj = {
        q: 'vật liệu siêu nhẹ',
        golden: '1',
        source_type: 'research_paper',
      }
      const parsed = parseSearchExplorerParams(paramsObj)

      expect(parsed.query).toBe('vật liệu siêu nhẹ')
      expect(parsed.golden).toBe(true)
      expect(parsed.source_type).toBe('research_paper')
      expect(parsed.top_k).toBe(10) // default
    })

    it('6. Fallback về giá trị mặc định khi params rỗng', () => {
      const parsed = parseSearchExplorerParams(new URLSearchParams(''))
      expect(parsed.query).toBe('')
      expect(parsed.golden).toBe(false)
      expect(parsed.top_k).toBe(10)
      expect(parsed.topic).toBe('')
    })
  })

  describe('buildSearchPayload', () => {
    it('7. Tạo payload SearchRequest chuẩn hóa với active filters', () => {
      const state: SearchExplorerState = {
        query: 'máy bay không người lái',
        topic: 'contradiction',
        golden: true,
        source_type: 'case_study',
        top_k: 20,
      }

      const payload = buildSearchPayload(state)

      expect(payload).toEqual({
        query: 'máy bay không người lái',
        top_k: 20,
        filters: {
          topic: 'contradiction',
          golden: true,
          source_type: 'case_study',
        },
      })
    })

    it('8. Không đính kèm filters rỗng khi không có filter nào active', () => {
      const state: SearchExplorerState = {
        query: 'triz',
        top_k: 10,
        golden: false,
      }

      const payload = buildSearchPayload(state)

      expect(payload).toEqual({
        query: 'triz',
        top_k: 10,
      })
    })

    it('9. buildSearchPayload không bao gồm session_id trong payload gửi backend', () => {
      const state: SearchExplorerState = {
        query: 'triz',
        session_id: 'd9b2d20b-0001-0000-0000-000000000001',
        topic: 'contradiction',
      }

      const payload = buildSearchPayload(state)

      expect(payload).toEqual({
        query: 'triz',
        top_k: 10,
        filters: {
          topic: 'contradiction',
        },
      })
      expect((payload as any).session_id).toBeUndefined()
    })
  })

  describe('Session ID Integration (Phase 10.3 Increment 3)', () => {
    it('10. buildSearchExplorerUrl serialize session_id chính xác', () => {
      const url = buildSearchExplorerUrl({
        query: 'động cơ điện',
        session_id: 'd9b2d20b-0001-0000-0000-000000000001',
      })
      expect(url).toBe(
        '/search?q=%C4%91%E1%BB%99ng+c%C6%A1+%C4%91i%E1%BB%87n&session_id=d9b2d20b-0001-0000-0000-000000000001'
      )
    })

    it('11. parseSearchExplorerParams parse session_id từ URLSearchParams và Record params', () => {
      const parsed1 = parseSearchExplorerParams(
        new URLSearchParams('q=triz&session_id=d9b2d20b-0001-0000-0000-000000000001')
      )
      expect(parsed1.session_id).toBe('d9b2d20b-0001-0000-0000-000000000001')

      const parsed2 = parseSearchExplorerParams({
        q: 'triz',
        sessionId: 'd9b2d20b-0001-0000-0000-000000000002',
      })
      expect(parsed2.session_id).toBe('d9b2d20b-0001-0000-0000-000000000002')
    })
  })
})
