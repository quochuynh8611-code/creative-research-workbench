/**
 * api-client.test.ts — Frontend Contract Tests cho Phase 5.2
 *
 * Specifications:
 *   - Endpoints:
 *       - GET  /api/v1/sessions
 *       - GET  /api/v1/sessions/{id}
 *       - POST /api/v1/sessions
 *       - POST /api/v1/sessions/{id}/problem-frame
 *       - POST /api/v1/sessions/{id}/next-step
 *       - POST /api/v1/search
 *   - Contracts: docs/API_CONTRACTS.md, docs/DOMAIN_SCHEMA.md
 */

import {
  listSessions,
  getSession,
  createSession,
  createProblemFrame,
  nextStep,
  searchKnowledge,
  archiveSession,
  restoreSession,
  getTrizParameters,
  getTrizPrinciples,
  lookupTrizMatrix,
  apiClient,
} from '../api-client'

import type {
  CreateSessionInput,
  ProblemFrameCreateInput,
  SearchRequest,
  TrizLookupQuery,
} from '../types'

jest.mock('../api-client', () => {
  const original = jest.requireActual('../api-client')
  return {
    ...original,
  }
})

describe('Frontend API Client Contract Tests (Phase 5.2)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // 1. List Sessions
  it('1. listSessions unwrap đúng response { data, meta }', async () => {
    const mockApiResponse = {
      data: {
        data: [
          {
            id: 'd9b2d20b-0001-0000-0000-000000000001',
            title: 'Tối ưu hóa giảm rung bánh răng',
            description: 'Phân tích TRIZ cho hệ thống truyền động',
            domain: 'research',
            status: 'active',
            workflow_state: 'idle',
            created_at: '2026-09-29T10:00:00Z',
            updated_at: '2026-09-29T10:00:00Z',
          },
        ],
        meta: { total: 1 },
      },
    }

    const spy = jest.spyOn(apiClient, 'get').mockResolvedValueOnce(mockApiResponse)

    const result = await listSessions({ status: 'active', limit: 10 })

    expect(spy).toHaveBeenCalledWith('/api/v1/sessions', {
      params: { status: 'active', limit: 10 },
    })
    expect(result.data).toHaveLength(1)
    expect(result.data[0].id).toBe('d9b2d20b-0001-0000-0000-000000000001')
    expect(result.data[0].workflow_state).toBe('idle')
    expect(result.meta.total).toBe(1)
  })

  // 2. Get Session
  it('2. getSession parse đúng problem_frame: object | null', async () => {
    const mockApiResponse = {
      data: {
        id: 'd9b2d20b-0001-0000-0000-000000000001',
        title: 'Tối ưu hóa giảm rung',
        description: null,
        domain: 'research',
        status: 'active',
        workflow_state: 'structuring',
        created_at: '2026-09-29T10:00:00Z',
        updated_at: '2026-09-29T10:00:00Z',
        problem_frame: {
          id: 'pf-0001',
          session_id: 'd9b2d20b-0001-0000-0000-000000000001',
          raw_statement: 'Tăng tốc độ nhưng giảm độ bền',
          normalized_statement: 'speed vs strength',
          contradiction_type: 'technical',
          improving_parameter: 'speed',
          worsening_parameter: 'strength',
          domain: 'research',
          created_at: '2026-09-29T10:05:00Z',
        },
      },
    }

    const spy = jest.spyOn(apiClient, 'get').mockResolvedValueOnce(mockApiResponse)

    const result = await getSession('d9b2d20b-0001-0000-0000-000000000001')

    expect(spy).toHaveBeenCalledWith('/api/v1/sessions/d9b2d20b-0001-0000-0000-000000000001')
    expect(result.id).toBe('d9b2d20b-0001-0000-0000-000000000001')
    expect(result.problem_frame).not.toBeNull()
    expect(result.problem_frame?.contradiction_type).toBe('technical')
    expect(result.problem_frame?.raw_statement).toBe('Tăng tốc độ nhưng giảm độ bền')
  })

  // 3. Create Session
  it('3. createSession gửi payload { title, description?, domain?, tags? }', async () => {
    const input: CreateSessionInput = {
      title: 'Nghiên cứu vật liệu mới',
      description: 'Khảo sát composite',
      domain: 'research',
      tags: ['triz', 'materials'],
    }

    const mockApiResponse = {
      data: {
        id: 'd9b2d20b-0001-0000-0000-000000000002',
        title: input.title,
        description: input.description,
        domain: input.domain,
        status: 'active',
        workflow_state: 'idle',
        created_at: '2026-09-29T10:00:00Z',
        updated_at: '2026-09-29T10:00:00Z',
      },
    }

    const spy = jest.spyOn(apiClient, 'post').mockResolvedValueOnce(mockApiResponse)

    const result = await createSession(input)

    expect(spy).toHaveBeenCalledWith('/api/v1/sessions', input)
    expect(result.id).toBe('d9b2d20b-0001-0000-0000-000000000002')
    expect(result.workflow_state).toBe('idle')
  })

  // 4. Create Problem Frame
  it('4. createProblemFrame gửi đúng field raw_statement', async () => {
    const sessionId = 'd9b2d20b-0001-0000-0000-000000000001'
    const input: ProblemFrameCreateInput = {
      raw_statement: 'Tăng nhiệt độ phản ứng làm giảm độ ổn định',
      domain: 'chemical',
    }

    const mockApiResponse = {
      data: {
        id: 'pf-0002',
        session_id: sessionId,
        raw_statement: input.raw_statement,
        normalized_statement: 'temperature vs stability',
        contradiction_type: 'technical',
        improving_parameter: 'temperature',
        worsening_parameter: 'stability',
        domain: 'chemical',
        created_at: '2026-09-29T10:00:00Z',
      },
    }

    const spy = jest.spyOn(apiClient, 'post').mockResolvedValueOnce(mockApiResponse)

    const result = await createProblemFrame(sessionId, input)

    expect(spy).toHaveBeenCalledWith(`/api/v1/sessions/${sessionId}/problem-frame`, input)
    expect(result.raw_statement).toBe('Tăng nhiệt độ phản ứng làm giảm độ ổn định')
    expect(result.contradiction_type).toBe('technical')
  })

  // 5. Next Step
  it('5. nextStep parse recommended_methods array', async () => {
    const sessionId = 'd9b2d20b-0001-0000-0000-000000000001'
    const mockApiResponse = {
      data: {
        session_id: sessionId,
        previous_state: 'structuring',
        current_state: 'retrieval',
        workflow_state: 'retrieval',
        next_step: 'retrieval',
        recommended_methods: [
          {
            id: 10,
            principle_id: 10,
            principle: 10,
            title: 'Preliminary action (Tác động sơ bộ)',
            description: 'Thực hiện tác động trước khi cần thiết',
          },
          {
            id: 35,
            principle_id: 35,
            principle: 35,
            title: 'Parameter changes (Chuyển đổi thông số)',
            description: 'Thay đổi trạng thái hoặc nồng độ',
          },
        ],
      },
    }

    const spy = jest.spyOn(apiClient, 'post').mockResolvedValueOnce(mockApiResponse)

    const result = await nextStep(sessionId)

    expect(spy).toHaveBeenCalledWith(`/api/v1/sessions/${sessionId}/next-step`)
    expect(result.current_state).toBe('retrieval')
    expect(result.recommended_methods).toHaveLength(2)
    expect(result.recommended_methods[0].principle_id).toBe(10)
  })

  // 6. Search Knowledge
  it('6. searchKnowledge dùng POST JSON body tới /api/v1/search', async () => {
    const searchReq: SearchRequest = {
      query: 'nguyên tắc tác động sơ bộ',
      top_k: 3,
      filters: { topic: ['architecture'] },
    }

    const mockApiResponse = {
      data: {
        results: [
          {
            chunk_id: 'chk-0001',
            source_ref: 'docs/ADR-001-architecture.md',
            excerpt: 'Kiến trúc Workflow Engine thay vì RAG thuần',
            score: 0.95,
            metadata: { topic: 'architecture' },
          },
        ],
        latency_ms: 12.5,
      },
    }

    const spy = jest.spyOn(apiClient, 'post').mockResolvedValueOnce(mockApiResponse)

    const result = await searchKnowledge(searchReq)

    expect(spy).toHaveBeenCalledWith('/api/v1/search', searchReq)
    expect(result.results).toHaveLength(1)
    expect(result.results[0].source_ref).toBe('docs/ADR-001-architecture.md')
    expect(result.latency_ms).toBe(12.5)
  })

  // 7. Archive Session
  it('7. archiveSession gọi POST /api/v1/sessions/{id}/archive', async () => {
    const sessionId = 'd9b2d20b-0001-0000-0000-000000000001'
    const mockApiResponse = {
      data: {
        id: sessionId,
        title: 'Tối ưu hóa giảm rung bánh răng',
        status: 'archived',
        workflow_state: 'idle',
        created_at: '2026-09-29T10:00:00Z',
        updated_at: '2026-09-30T10:00:00Z',
      },
    }

    const spy = jest.spyOn(apiClient, 'post').mockResolvedValueOnce(mockApiResponse)

    const result = await archiveSession(sessionId)

    expect(spy).toHaveBeenCalledWith(`/api/v1/sessions/${sessionId}/archive`)
    expect(result.id).toBe(sessionId)
    expect(result.status).toBe('archived')
  })

  // 8. Restore Session
  it('8. restoreSession gọi POST /api/v1/sessions/{id}/restore và trả về status active', async () => {
    const sessionId = 'd9b2d20b-0001-0000-0000-000000000001'
    const mockApiResponse = {
      data: {
        id: sessionId,
        title: 'Tối ưu hóa giảm rung bánh răng',
        status: 'active',
        workflow_state: 'idle',
        created_at: '2026-09-29T10:00:00Z',
        updated_at: '2026-09-30T10:05:00Z',
      },
    }

    const spy = jest.spyOn(apiClient, 'post').mockResolvedValueOnce(mockApiResponse)

    const result = await restoreSession(sessionId)

    expect(spy).toHaveBeenCalledWith(`/api/v1/sessions/${sessionId}/restore`)
    expect(result.id).toBe(sessionId)
    expect(result.status).toBe('active')
  })

  // 9. Get TRIZ Parameters
  it('9. getTrizParameters gọi GET /api/v1/triz/parameters và unwrap { data, meta }', async () => {
    const mockApiResponse = {
      data: {
        data: [
          {
            id: 1,
            code: 'weight_moving',
            name_vi: 'Trọng lượng vật thể di động',
            name_en: 'Weight of moving object',
            description: 'Khối lượng của vật thể chuyển động',
          },
        ],
        meta: { total: 39 },
      },
    }

    const spy = jest.spyOn(apiClient, 'get').mockResolvedValueOnce(mockApiResponse)

    const result = await getTrizParameters()

    expect(spy).toHaveBeenCalledWith('/api/v1/triz/parameters')
    expect(result.data).toHaveLength(1)
    expect(result.data[0].code).toBe('weight_moving')
    expect(result.meta.total).toBe(39)
  })

  // 10. Get TRIZ Principles
  it('10. getTrizPrinciples gọi GET /api/v1/triz/principles và unwrap { data, meta }', async () => {
    const mockApiResponse = {
      data: {
        data: [
          {
            id: 1,
            principle_id: 1,
            name_vi: 'Nguyên tắc Phân đoạn',
            name_en: 'Segmentation',
            description: 'Chia đối tượng thành các phần độc lập',
            explanation: 'Phân rã hệ thống thành các khối nhỏ',
            examples: ['Cửa cuốn xếp lớp'],
          },
        ],
        meta: { total: 40 },
      },
    }

    const spy = jest.spyOn(apiClient, 'get').mockResolvedValueOnce(mockApiResponse)

    const result = await getTrizPrinciples()

    expect(spy).toHaveBeenCalledWith('/api/v1/triz/principles')
    expect(result.data).toHaveLength(1)
    expect(result.data[0].principle_id).toBe(1)
    expect(result.meta.total).toBe(40)
  })

  // 11. Lookup TRIZ Matrix
  it('11. lookupTrizMatrix gọi GET /api/v1/triz/lookup với params { improving, worsening }', async () => {
    const query: TrizLookupQuery = { improving: 17, worsening: 14 }
    const mockApiResponse = {
      data: {
        improving_parameter: {
          id: 17,
          code: 'temperature',
          name_vi: 'Nhiệt độ',
          name_en: 'Temperature',
        },
        worsening_parameter: {
          id: 14,
          code: 'strength',
          name_vi: 'Độ bền / Độ cứng',
          name_en: 'Strength',
        },
        is_diagonal: false,
        principles: [
          {
            id: 35,
            principle_id: 35,
            name_vi: 'Chuyển đổi thông số',
            name_en: 'Parameter changes',
            description: 'Thay đổi trạng thái vật lý',
          },
        ],
        principles_count: 1,
      },
    }

    const spy = jest.spyOn(apiClient, 'get').mockResolvedValueOnce(mockApiResponse)

    const result = await lookupTrizMatrix(query)

    expect(spy).toHaveBeenCalledWith('/api/v1/triz/lookup', {
      params: query,
    })
    expect(result.is_diagonal).toBe(false)
    expect(result.improving_parameter.id).toBe(17)
    expect(result.worsening_parameter.id).toBe(14)
    expect(result.principles).toHaveLength(1)
    expect(result.principles_count).toBe(1)
  })
})

