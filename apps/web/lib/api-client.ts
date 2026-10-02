import axios from 'axios'
import type {
  AIProblemAnalysisRequest,
  AIProblemAnalysisResponse,
  CandidateSolution,
  CandidateSolutionsResponse,
  CreateCandidateSolutionInput,
  CreateSessionInput,
  CreateResearchNoteInput,
  DeleteCandidateSolutionResponse,
  DeleteResearchNoteResponse,
  NextStepResponse,
  ProblemFrame,
  ProblemFrameCreateInput,
  ResearchNote,
  ResearchNotesResponse,
  ResearchSession,
  SearchRequest,
  SearchResponse,
  SessionListResponse,
  TrizLookupQuery,
  TrizLookupResponse,
  TrizParametersResponse,
  TrizPrinciplesResponse,
  UpdateCandidateSolutionInput,
} from './types'

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('[API Error]', error?.response?.data ?? error.message)
    return Promise.reject(error)
  }
)

/**
 * 1. Liệt kê danh sách research sessions từ backend.
 */
export async function listSessions(params?: {
  status?: string
  domain?: string
  q?: string
  limit?: number
}): Promise<SessionListResponse> {
  const response = await apiClient.get<SessionListResponse>('/api/v1/sessions', {
    params,
  })
  return response.data
}

/**
 * 2. Lấy chi tiết một session kèm ProblemFrame mới nhất.
 */
export async function getSession(sessionId: string): Promise<ResearchSession> {
  const response = await apiClient.get<{ data?: ResearchSession } & ResearchSession>(
    `/api/v1/sessions/${sessionId}`
  )
  return response.data.data ?? response.data
}

/**
 * 3. Tạo research session mới và persist vào database.
 */
export async function createSession(input: CreateSessionInput): Promise<ResearchSession> {
  const response = await apiClient.post<{ data?: ResearchSession } & ResearchSession>(
    '/api/v1/sessions',
    input
  )
  return response.data.data ?? response.data
}

/**
 * 4. Tạo hoặc cập nhật TRIZ ProblemFrame cho session.
 */
export async function createProblemFrame(
  sessionId: string,
  input: ProblemFrameCreateInput
): Promise<ProblemFrame> {
  const response = await apiClient.post<{ data?: ProblemFrame } & ProblemFrame>(
    `/api/v1/sessions/${sessionId}/problem-frame`,
    input
  )
  return response.data.data ?? response.data
}

/**
 * 5. Chuyển bước FSM tiếp theo và nhận gợi ý nguyên tắc sáng tạo TRIZ.
 */
export async function nextStep(sessionId: string): Promise<NextStepResponse> {
  const response = await apiClient.post<{ data?: NextStepResponse } & NextStepResponse>(
    `/api/v1/sessions/${sessionId}/next-step`
  )
  return response.data.data ?? response.data
}

/**
 * 6. Tìm kiếm kết hợp (Hybrid Search: Full-text + Vector) trong Knowledge Base.
 */
export async function searchKnowledge(input: SearchRequest): Promise<SearchResponse> {
  const response = await apiClient.post<{ data?: SearchResponse } & SearchResponse>(
    '/api/v1/search',
    input
  )
  return response.data.data ?? response.data
}

/**
 * 7. Lưu trữ an toàn (soft-delete / archive) một research session.
 */
export async function archiveSession(sessionId: string): Promise<ResearchSession> {
  const response = await apiClient.post<{ data?: ResearchSession } & ResearchSession>(
    `/api/v1/sessions/${sessionId}/archive`
  )
  return response.data.data ?? response.data
}

/**
 * 8. Khôi phục một research session đã lưu trữ về trạng thái active.
 */
export async function restoreSession(sessionId: string): Promise<ResearchSession> {
  const response = await apiClient.post<{ data?: ResearchSession } & ResearchSession>(
    `/api/v1/sessions/${sessionId}/restore`
  )
  return response.data.data ?? response.data
}

/**
 * 9. Lấy danh mục 39 thông số kỹ thuật TRIZ song ngữ (Altshuller 1985).
 */
export async function getTrizParameters(): Promise<TrizParametersResponse> {
  const response = await apiClient.get<TrizParametersResponse>('/api/v1/triz/parameters')
  return response.data
}

/**
 * 10. Lấy danh mục 40 nguyên tắc sáng tạo TRIZ kèm metadata giải thích & ví dụ.
 */
export async function getTrizPrinciples(): Promise<TrizPrinciplesResponse> {
  const response = await apiClient.get<TrizPrinciplesResponse>('/api/v1/triz/principles')
  return response.data
}

/**
 * 11. Tra cứu ma trận mâu thuẫn kỹ thuật Altshuller 39x39 một cách tất định.
 */
export async function lookupTrizMatrix(params: TrizLookupQuery): Promise<TrizLookupResponse> {
  const response = await apiClient.get<TrizLookupResponse>('/api/v1/triz/lookup', {
    params,
  })
  return response.data
}

/**
 * 12. Lấy danh sách Research Notes của một session.
 */
export async function listResearchNotes(sessionId: string): Promise<ResearchNotesResponse> {
  const response = await apiClient.get<ResearchNotesResponse>(`/api/v1/sessions/${sessionId}/notes`)
  return response.data
}

/**
 * 13. Tạo mới một Research Note trong session.
 */
export async function createResearchNote(
  sessionId: string,
  input: CreateResearchNoteInput
): Promise<ResearchNote> {
  const response = await apiClient.post<{ data?: ResearchNote } & ResearchNote>(
    `/api/v1/sessions/${sessionId}/notes`,
    input
  )
  return response.data.data ?? response.data
}

/**
 * 14. Xóa một Research Note theo id trong session.
 */
export async function deleteResearchNote(
  sessionId: string,
  noteId: string
): Promise<DeleteResearchNoteResponse> {
  const response = await apiClient.delete<DeleteResearchNoteResponse>(
    `/api/v1/sessions/${sessionId}/notes/${noteId}`
  )
  return response.data
}

/**
 * 15. Xuất nội dung research session ra file Markdown (.md).
 */
export async function exportSessionMarkdown(sessionId: string): Promise<Blob> {
  const response = await apiClient.get<Blob>(`/api/v1/sessions/${sessionId}/export`, {
    params: { format: 'md' },
    responseType: 'blob',
  })
  return response.data
}

/**
 * 16. Lấy danh sách Candidate Solutions của một session.
 */
export async function listCandidateSolutions(sessionId: string): Promise<CandidateSolutionsResponse> {
  const response = await apiClient.get<CandidateSolutionsResponse>(
    `/api/v1/sessions/${sessionId}/solutions`
  )
  return response.data
}

/**
 * 17. Tạo mới một Candidate Solution trong session.
 */
export async function createCandidateSolution(
  sessionId: string,
  input: CreateCandidateSolutionInput
): Promise<CandidateSolution> {
  const response = await apiClient.post<{ data?: CandidateSolution } & CandidateSolution>(
    `/api/v1/sessions/${sessionId}/solutions`,
    input
  )
  return response.data.data ?? response.data
}

/**
 * 18. Cập nhật trạng thái hoặc điểm số của Candidate Solution.
 */
export async function updateCandidateSolution(
  sessionId: string,
  solutionId: string,
  input: UpdateCandidateSolutionInput
): Promise<CandidateSolution> {
  const response = await apiClient.patch<{ data?: CandidateSolution } & CandidateSolution>(
    `/api/v1/sessions/${sessionId}/solutions/${solutionId}`,
    input
  )
  return response.data.data ?? response.data
}

/**
 * 19. Xóa một Candidate Solution theo id trong session.
 */
export async function deleteCandidateSolution(
  sessionId: string,
  solutionId: string
): Promise<DeleteCandidateSolutionResponse> {
  const response = await apiClient.delete<DeleteCandidateSolutionResponse>(
    `/api/v1/sessions/${sessionId}/solutions/${solutionId}`
  )
  return response.data
}

/**
 * 20. Phân tích bài toán bằng AI/LLM (Phase 6.2 — Ephemeral Suggestion Layer).
 */
export async function analyzeProblemWithAI(
  sessionId: string,
  input: AIProblemAnalysisRequest
): Promise<AIProblemAnalysisResponse> {
  const response = await apiClient.post<AIProblemAnalysisResponse>(
    `/api/v1/sessions/${sessionId}/ai/analyze-problem`,
    input
  )
  return response.data
}

