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

import * as apiClientModule from '../api-client'
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
  listResearchNotes,
  createResearchNote,
  deleteResearchNote,
  exportSessionJson,
  generateAIResearchReport,
  apiClient,
} from '../api-client'

import type {
  CreateSessionInput,
  CreateResearchNoteInput,
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

  // 12. List Research Notes
  it('12. listResearchNotes gọi GET /api/v1/sessions/{id}/notes và unwrap { data, meta }', async () => {
    const sessionId = 'd9b2d20b-0001-0000-0000-000000000001'
    const mockApiResponse = {
      data: {
        data: [
          {
            id: 'note-001',
            session_id: sessionId,
            content: 'Giả thuyết vật liệu xốp',
            note_type: 'hypothesis',
            created_at: '2026-10-01T10:00:00Z',
          },
        ],
        meta: { total: 1 },
      },
    }

    const spy = jest.spyOn(apiClient, 'get').mockResolvedValueOnce(mockApiResponse)

    const result = await listResearchNotes(sessionId)

    expect(spy).toHaveBeenCalledWith(`/api/v1/sessions/${sessionId}/notes`)
    expect(result.data).toHaveLength(1)
    expect(result.data[0].id).toBe('note-001')
    expect(result.meta.total).toBe(1)
  })

  // 13. Create Research Note
  it('13. createResearchNote gọi POST /api/v1/sessions/{id}/notes với payload đúng', async () => {
    const sessionId = 'd9b2d20b-0001-0000-0000-000000000001'
    const input: CreateResearchNoteInput = {
      content: 'Insight từ tài liệu nghiên cứu',
      note_type: 'insight',
    }
    const mockApiResponse = {
      data: {
        id: 'note-002',
        session_id: sessionId,
        content: input.content,
        note_type: input.note_type,
        created_at: '2026-10-01T10:05:00Z',
      },
    }

    const spy = jest.spyOn(apiClient, 'post').mockResolvedValueOnce(mockApiResponse)

    const result = await createResearchNote(sessionId, input)

    expect(spy).toHaveBeenCalledWith(`/api/v1/sessions/${sessionId}/notes`, input)
    expect(result.id).toBe('note-002')
    expect(result.content).toBe(input.content)
  })

  // 14. Delete Research Note
  it('14. deleteResearchNote gọi DELETE /api/v1/sessions/{id}/notes/{noteId}', async () => {
    const sessionId = 'd9b2d20b-0001-0000-0000-000000000001'
    const noteId = 'note-002'
    const mockApiResponse = {
      data: {
        status: 'deleted',
        id: noteId,
        session_id: sessionId,
      },
    }

    const spy = jest.spyOn(apiClient, 'delete').mockResolvedValueOnce(mockApiResponse)

    const result = await deleteResearchNote(sessionId, noteId)

    expect(spy).toHaveBeenCalledWith(`/api/v1/sessions/${sessionId}/notes/${noteId}`)
    expect(result.status).toBe('deleted')
  })

  // 15. List Candidate Solutions
  it('15. listCandidateSolutions gọi GET /api/v1/sessions/{id}/solutions và unwrap { data, meta }', async () => {
    const sessionId = 'd9b2d20b-0001-0000-0000-000000000001'
    const mockApiResponse = {
      data: {
        data: [
          {
            id: 'sol-001',
            session_id: sessionId,
            title: 'Màng ngăn composite',
            mechanism: 'Cơ chế tự phục hồi',
            status: 'candidate',
            novelty_score: 0.8,
            feasibility_score: 0.7,
            risk_notes: null,
            created_at: '2026-10-01T10:00:00Z',
            updated_at: '2026-10-01T10:00:00Z',
          },
        ],
        meta: { total: 1, session_id: sessionId },
      },
    }

    const spy = jest.spyOn(apiClient, 'get').mockResolvedValueOnce(mockApiResponse)

    const result = await apiClientModule.listCandidateSolutions(sessionId)

    expect(spy).toHaveBeenCalledWith(`/api/v1/sessions/${sessionId}/solutions`)
    expect(result.data).toHaveLength(1)
    expect(result.data[0].id).toBe('sol-001')
    expect(result.meta.total).toBe(1)
  })

  // 16. Create Candidate Solution
  it('16. createCandidateSolution gọi POST /api/v1/sessions/{id}/solutions với payload đúng', async () => {
    const sessionId = 'd9b2d20b-0001-0000-0000-000000000001'
    const input = {
      title: 'Màng nano polymer',
      mechanism: 'Ngăn dendrite lithium',
      novelty_score: 0.9,
    }
    const mockApiResponse = {
      data: {
        id: 'sol-002',
        session_id: sessionId,
        title: input.title,
        mechanism: input.mechanism,
        status: 'candidate',
        novelty_score: 0.9,
        feasibility_score: 0.0,
        risk_notes: null,
        created_at: '2026-10-01T10:10:00Z',
        updated_at: '2026-10-01T10:10:00Z',
      },
    }

    const spy = jest.spyOn(apiClient, 'post').mockResolvedValueOnce(mockApiResponse)

    const result = await apiClientModule.createCandidateSolution(sessionId, input)

    expect(spy).toHaveBeenCalledWith(`/api/v1/sessions/${sessionId}/solutions`, input)
    expect(result.id).toBe('sol-002')
    expect(result.title).toBe(input.title)
  })

  // 17. Update Candidate Solution
  it('17. updateCandidateSolution gọi PATCH /api/v1/sessions/{id}/solutions/{solId}', async () => {
    const sessionId = 'd9b2d20b-0001-0000-0000-000000000001'
    const solutionId = 'sol-002'
    const input = {
      status: 'accepted' as const,
      feasibility_score: 0.85,
    }
    const mockApiResponse = {
      data: {
        id: solutionId,
        session_id: sessionId,
        title: 'Màng nano polymer',
        mechanism: 'Ngăn dendrite lithium',
        status: 'accepted',
        novelty_score: 0.9,
        feasibility_score: 0.85,
        risk_notes: null,
        created_at: '2026-10-01T10:10:00Z',
        updated_at: '2026-10-01T10:15:00Z',
      },
    }

    const spy = jest.spyOn(apiClient, 'patch').mockResolvedValueOnce(mockApiResponse)

    const result = await apiClientModule.updateCandidateSolution(sessionId, solutionId, input)

    expect(spy).toHaveBeenCalledWith(`/api/v1/sessions/${sessionId}/solutions/${solutionId}`, input)
    expect(result.status).toBe('accepted')
    expect(result.feasibility_score).toBe(0.85)
  })

  // 18. Delete Candidate Solution
  it('18. deleteCandidateSolution gọi DELETE /api/v1/sessions/{id}/solutions/{solId}', async () => {
    const sessionId = 'd9b2d20b-0001-0000-0000-000000000001'
    const solutionId = 'sol-002'
    const mockApiResponse = {
      data: {
        status: 'deleted',
        id: solutionId,
        session_id: sessionId,
      },
    }

    const spy = jest.spyOn(apiClient, 'delete').mockResolvedValueOnce(mockApiResponse)

    const result = await apiClientModule.deleteCandidateSolution(sessionId, solutionId)

    expect(spy).toHaveBeenCalledWith(`/api/v1/sessions/${sessionId}/solutions/${solutionId}`)
    expect(result.status).toBe('deleted')
  })

  // 19. Analyze Problem With AI — Happy Path (ai_hypothesis)
  it('19. analyzeProblemWithAI gửi POST /api/v1/sessions/{id}/ai/analyze-problem và parse data + _meta', async () => {
    const sessionId = 'd9b2d20b-0001-0000-0000-000000000001'
    const input = {
      raw_statement: 'Cần tăng tốc độ xử lý dữ liệu nhưng không làm tăng nhiệt độ CPU',
      domain: 'computing',
    }

    const mockApiResponse = {
      data: {
        data: {
          normalized_statement: 'Tối ưu hóa tốc độ xử lý dữ liệu trong giới hạn phát nhiệt của CPU',
          domain: 'computing',
          contradiction_type: 'technical',
          improving_parameter: 'speed',
          worsening_parameter: 'temperature',
          suggested_keywords: ['thermal throttling', 'parallel computing', 'heat dissipation'],
          reasoning: 'Mâu thuẫn giữa tốc độ tính toán (speed) và nhiệt lượng sinh ra (temperature)',
        },
        _meta: {
          provenance: 'ai_hypothesis',
          provider: 'openai',
          model: 'gpt-4o-mini',
          prompt_version: '2026-10-01.v1',
          latency_ms: 245.5,
          fallback_reason: null,
        },
      },
    }

    const spy = jest.spyOn(apiClient, 'post').mockResolvedValueOnce(mockApiResponse)

    const result = await apiClientModule.analyzeProblemWithAI(sessionId, input)

    expect(spy).toHaveBeenCalledWith(`/api/v1/sessions/${sessionId}/ai/analyze-problem`, input)
    expect(result.data.normalized_statement).toBe(
      'Tối ưu hóa tốc độ xử lý dữ liệu trong giới hạn phát nhiệt của CPU'
    )
    expect(result.data.contradiction_type).toBe('technical')
    expect(result.data.suggested_keywords).toHaveLength(3)
    expect(result._meta.provenance).toBe('ai_hypothesis')
    expect(result._meta.latency_ms).toBe(245.5)
  })

  // 20. Analyze Problem With AI — Fallback Path (rule_based_fallback)
  it('20. analyzeProblemWithAI parse đúng response fallback rule_based_fallback', async () => {
    const sessionId = 'd9b2d20b-0001-0000-0000-000000000001'
    const input = {
      raw_statement: 'Bánh răng cần cứng để chịu lực nhưng mềm để giảm rung',
    }

    const mockApiResponse = {
      data: {
        data: {
          normalized_statement: 'Độ cứng bề mặt vs Độ giảm chấn',
          domain: null,
          contradiction_type: 'technical',
          improving_parameter: 'strength',
          worsening_parameter: 'vibration',
          suggested_keywords: [],
          reasoning: 'Trích xuất từ ma trận từ khóa quy tắc',
        },
        _meta: {
          provenance: 'rule_based_fallback',
          provider: 'rule_based',
          model: 'triz_rules_v1',
          prompt_version: 'none',
          latency_ms: 12.0,
          fallback_reason: 'llm_api_key_missing',
        },
      },
    }

    const spy = jest.spyOn(apiClient, 'post').mockResolvedValueOnce(mockApiResponse)

    const result = await apiClientModule.analyzeProblemWithAI(sessionId, input)

    expect(spy).toHaveBeenCalledWith(`/api/v1/sessions/${sessionId}/ai/analyze-problem`, input)
    expect(result._meta.provenance).toBe('rule_based_fallback')
    expect(result._meta.fallback_reason).toBe('llm_api_key_missing')
  })

  // 21. List Documents
  it('21. listDocuments unwrap đúng response { data, meta }', async () => {
    const mockApiResponse = {
      data: {
        data: [
          {
            id: 'doc-001',
            filename: 'ADR-001-architecture.md',
            filepath: 'docs/ADR-001-architecture.md',
            title: 'ADR-001 — Kiến trúc hệ thống',
            topic: 'architecture',
            source_type: 'decision-record',
            language: 'vi',
            tags: ['adr', 'triz'],
            phase: '1',
            status: 'canonical',
            golden: true,
            content_hash: 'hash_01',
            chunks_count: 4,
            created_at: '2026-10-01T10:00:00Z',
            updated_at: '2026-10-01T10:00:00Z',
          },
        ],
        meta: { total: 1, limit: 50, offset: 0 },
      },
    }

    const spy = jest.spyOn(apiClient, 'get').mockResolvedValueOnce(mockApiResponse)

    const result = await apiClientModule.listDocuments({ topic: 'architecture' })

    expect(spy).toHaveBeenCalledWith('/api/v1/documents', {
      params: { topic: 'architecture' },
    })
    expect(result.data).toHaveLength(1)
    expect(result.data[0].golden).toBe(true)
    expect(result.meta.total).toBe(1)
  })

  // 22. Get Document Detail
  it('22. getDocument unwrap chi tiết document kèm chunks', async () => {
    const docId = 'doc-001'
    const mockApiResponse = {
      data: {
        data: {
          id: docId,
          filename: 'doc-sample.md',
          filepath: 'docs/doc-sample.md',
          title: 'Tài liệu chi tiết',
          topic: 'testing',
          source_type: 'spec',
          language: 'vi',
          tags: ['test'],
          phase: '1',
          status: 'canonical',
          golden: false,
          content_hash: 'hash_02',
          chunks_count: 2,
          created_at: '2026-10-01T10:00:00Z',
          updated_at: '2026-10-01T10:00:00Z',
          chunks: [
            { id: 'c1', chunk_index: 0, token_count: 50, content: 'Đoạn 1' },
            { id: 'c2', chunk_index: 1, token_count: 60, content: 'Đoạn 2' },
          ],
        },
      },
    }

    const spy = jest.spyOn(apiClient, 'get').mockResolvedValueOnce(mockApiResponse)

    const result = await apiClientModule.getDocument(docId)

    expect(spy).toHaveBeenCalledWith(`/api/v1/documents/${docId}`)
    expect(result.id).toBe(docId)
    expect(result.chunks).toHaveLength(2)
  })

  // 23. Upload Document
  it('23. uploadDocument gửi FormData POST tới /api/v1/documents/upload', async () => {
    const fakeFile = new File(['# Title\nContent'], 'test-file.md', { type: 'text/markdown' })
    const mockApiResponse = {
      data: {
        data: {
          status: 'success',
          document_id: 'doc-new-01',
          filename: 'test-file.md',
          title: 'Title',
          chunks_created: 1,
          embeddings_created: 1,
        },
      },
    }

    const spy = jest.spyOn(apiClient, 'post').mockResolvedValueOnce(mockApiResponse)

    const result = await apiClientModule.uploadDocument(fakeFile)

    expect(spy).toHaveBeenCalledWith(
      '/api/v1/documents/upload',
      expect.any(FormData),
      expect.objectContaining({
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    )
    expect(result.status).toBe('success')
    expect(result.document_id).toBe('doc-new-01')
  })

  // 24. Delete Document
  it('24. deleteDocument gọi DELETE /api/v1/documents/{id}', async () => {
    const docId = 'doc-to-delete'
    const mockApiResponse = {
      data: {
        status: 'deleted',
        id: docId,
      },
    }

    const spy = jest.spyOn(apiClient, 'delete').mockResolvedValueOnce(mockApiResponse)

    const result = await apiClientModule.deleteDocument(docId)

    expect(spy).toHaveBeenCalledWith(`/api/v1/documents/${docId}`)
    expect(result.status).toBe('deleted')
  })

  // 25. Export Session JSON Snapshot (Phase 9A)
  it('25. exportSessionJson gọi GET /api/v1/sessions/{id}/export?format=json và unwrap data', async () => {
    const sessionId = 'ses-999'
    const mockSnapshot = {
      session: { id: sessionId, title: 'Test Session' },
      problem_frame: null,
      recommended_methods: [],
      research_notes: [],
      candidate_solutions: [],
    }

    const spy = jest.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: mockSnapshot })

    const result = await exportSessionJson(sessionId)

    expect(spy).toHaveBeenCalledWith(`/api/v1/sessions/${sessionId}/export`, {
      params: { format: 'json' },
    })
    expect(result.session.id).toBe(sessionId)
  })

  // 26. Generate AI Research Report (Phase 9A)
  it('26. generateAIResearchReport gọi POST /api/v1/sessions/{id}/ai/generate-report', async () => {
    const sessionId = 'ses-999'
    const mockReportData = {
      data: {
        session_id: sessionId,
        report_title: 'Báo cáo Nghiên cứu: Chiến lược TRIZ',
        executive_summary: 'Tóm tắt...',
        problem_background: 'Bối cảnh...',
        evidence_synthesis: 'Bằng chứng...',
        solution_assessment: 'Đánh giá...',
        action_plan: ['Bước 1', 'Bước 2'],
        markdown_content: '# BÁO CÁO NGHIÊN CỨU\n\n...',
        provenance: 'ai_synthesis' as const,
        provider: 'openai',
        model: 'gpt-4o-mini',
        prompt_version: '2026-10-02.v1',
        latency_ms: 1200.0,
      },
    }

    const spy = jest.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: mockReportData })

    const result = await generateAIResearchReport(sessionId)

    expect(spy).toHaveBeenCalledWith(`/api/v1/sessions/${sessionId}/ai/generate-report`)
    expect(result.report_title).toBe('Báo cáo Nghiên cứu: Chiến lược TRIZ')
    expect(result.provenance).toBe('ai_synthesis')
  })

  // 27. Import Session from JSON (Phase 9.3)
  it('27. importSession gọi POST /api/v1/sessions/import và trả về session data', async () => {
    const mockSnapshot = {
      session: { title: 'Imported Session' },
      problem_frame: null,
      recommended_methods: [],
      research_notes: [],
      candidate_solutions: [],
    }
    const mockResponse = {
      data: {
        id: 'new-ses-123',
        title: 'Imported Session',
        domain: 'technical',
        status: 'active',
        workflow_state: 'intake',
        tags: [],
        created_at: '2026-10-02T12:00:00Z',
        updated_at: '2026-10-02T12:00:00Z',
      },
      imported_elements: { problem_frame: false, notes_count: 0, solutions_count: 0 },
      message: 'Session imported successfully',
    }

    const spy = jest.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: mockResponse })

    const result = await apiClientModule.importSession(mockSnapshot as any)

    expect(spy).toHaveBeenCalledWith('/api/v1/sessions/import', mockSnapshot)
    expect(result.data.id).toBe('new-ses-123')
    expect(result.message).toBe('Session imported successfully')
  })

  // 28. Get Domain Templates (Phase 9.3)
  it('28. getSessionTemplates gọi GET /api/v1/sessions/templates và trả về danh sách template', async () => {
    const mockTemplates = [
      {
        id: 'engineering_composite_arm',
        title: 'Tối ưu hóa Trọng lượng & Độ bền Cơ học',
        domain: 'technical',
        description: 'Mẫu cơ khí',
        tags: ['engineering'],
        problem_frame: null,
      },
    ]

    const spy = jest.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: { data: mockTemplates } })

    const result = await apiClientModule.getSessionTemplates()

    expect(spy).toHaveBeenCalledWith('/api/v1/sessions/templates')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('engineering_composite_arm')
  })

  // 29. Create Session From Template (Phase 9.3)
  it('29. createSessionFromTemplate gọi POST /api/v1/sessions/from-template', async () => {
    const mockCreatedSession = {
      data: {
        id: 'new-tpl-ses',
        title: 'Nghiên cứu Cánh tay Robot',
        domain: 'technical',
        status: 'active',
        workflow_state: 'structuring',
        tags: ['engineering'],
        created_at: '2026-10-02T12:00:00Z',
        updated_at: '2026-10-02T12:00:00Z',
      },
    }

    const spy = jest.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: mockCreatedSession })

    const result = await apiClientModule.createSessionFromTemplate({
      template_id: 'engineering_composite_arm',
      title: 'Nghiên cứu Cánh tay Robot',
    })

    expect(spy).toHaveBeenCalledWith('/api/v1/sessions/from-template', {
      template_id: 'engineering_composite_arm',
      title: 'Nghiên cứu Cánh tay Robot',
    })
    expect(result.id).toBe('new-tpl-ses')
  })

  // 30. Auto-map TRIZ Parameters (Phase 10.1)
  it('30. mapTrizParameters gọi POST /api/v1/triz/auto-map với text và top_k', async () => {
    const mockMatches = {
      data: [
        {
          id: 14,
          code: 'strength',
          name_vi: 'Độ bền',
          name_en: 'Strength',
          score: 0.95,
          matched_keywords: ['độ bền'],
          description: 'Độ bền kết cấu',
        },
      ],
      meta: { total_candidates: 1, query_text: 'Tăng độ bền' },
    }

    const spy = jest.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: mockMatches })

    const result = await apiClientModule.mapTrizParameters('Tăng độ bền', 3)

    expect(spy).toHaveBeenCalledWith('/api/v1/triz/auto-map', {
      text: 'Tăng độ bền',
      top_k: 3,
    })
    expect(result).toHaveLength(1)
    expect(result[0].code).toBe('strength')
    expect(result[0].score).toBe(0.95)
  })
})
