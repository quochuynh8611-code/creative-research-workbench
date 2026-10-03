// Shared TypeScript types mirroring the backend domain models
// Source of Truth: docs/DOMAIN_SCHEMA.md, docs/API_CONTRACTS.md, backend endpoints

export type DomainType = 'technical' | 'business' | 'education' | 'personal' | 'research'
export type SessionStatus = 'active' | 'paused' | 'completed' | 'archived' | 'draft'
export type WorkflowStage =
  | 'idle'
  | 'intake'
  | 'structuring'
  | 'retrieval'
  | 'ideation'
  | 'evaluation'
  | 'synthesis'
  | 'completed'

export type ContradictionType = 'technical' | 'physical' | 'none' | 'unknown'
export type NoteType = 'insight' | 'hypothesis' | 'decision' | 'question' | 'action'
export type SolutionStatus = 'candidate' | 'accepted' | 'rejected'
export type TopicType = 'contradiction' | 'function' | 'evolution' | 'business' | 'case_study' | 'learning'

export interface ProblemFrame {
  id: string
  session_id: string
  raw_statement: string
  normalized_statement?: string | null
  contradiction_type: ContradictionType
  improving_parameter?: string | null
  worsening_parameter?: string | null
  domain?: string | null
  created_at?: string | null
}

export interface ProblemFrameCreateInput {
  raw_statement: string
  domain?: string | null
}

export interface ResearchSession {
  id: string
  title: string
  description?: string | null
  domain: DomainType | string
  status: SessionStatus
  workflow_state?: WorkflowStage
  tags: string[]
  created_at: string
  updated_at: string
  problem_frame?: ProblemFrame | null
  // UI compatibility aliases
  current_stage?: WorkflowStage
  problem_statement?: string
}

export interface SessionListResponse {
  data: ResearchSession[]
  meta: { total: number }
}

export interface SessionDetailResponse extends ResearchSession {}

export interface CreateSessionInput {
  title: string
  description?: string | null
  domain?: string
  tags?: string[]
}

export interface RecommendedMethod {
  id: number
  principle_id: number
  principle?: number
  title: string
  description: string
}

export interface NextStepResponse {
  session_id: string
  previous_state: string
  current_state: string
  workflow_state: string
  next_step: string
  recommended_methods: RecommendedMethod[]
}

export interface SearchRequest {
  query: string
  top_k?: number
  offset?: number
  limit?: number
  filters?: Record<string, any>
}

export interface SearchResultItem {
  chunk_id: string
  source_ref: string
  excerpt: string
  score: number
  metadata: Record<string, any>
}

export interface FacetCounts {
  topic?: Record<string, number>
  source_type?: Record<string, number>
  phase?: Record<string, number>
  golden?: Record<string, number>
}

export interface SearchResponse {
  results: SearchResultItem[]
  latency_ms: number
  total_hits?: number
  facet_counts?: FacetCounts
  offset?: number
  limit?: number
  has_more?: boolean
}

// Cross-Session Discovery Types (Phase 10.2)
export interface CrossSessionSharedParams {
  improving_parameter?: string
  worsening_parameter?: string
  contradiction_type?: string
  shared_principles?: number[]
}

export interface MatchedSessionItem {
  session_id: string
  title: string
  domain?: string | null
  status: string
  similarity_score: number
  match_reasons: string[]
  shared_parameters: CrossSessionSharedParams
  created_at?: string | null
}

export interface CrossSessionSearchResponse {
  source_session_id: string
  has_problem_frame: boolean
  reason?: string | null
  matched_sessions: MatchedSessionItem[]
  total_candidates_analyzed: number
  latency_ms: number
}


// UI Draft & Legacy types (kept for backward compatibility with existing components)
export interface ProblemIntakeDraft {
  goal: string
  constraints: string[]
  affected_entities: string[]
  failure_signals: string[]
  success_criteria: string[]
}

export interface Contradiction {
  id: string
  problem_frame_id: string
  type: 'technical' | 'physical'
  improving_parameter: string
  worsening_parameter: string
  context: string
}

export interface MethodSuggestion {
  id: string
  session_id: string
  method_name: string
  rationale: string
  preconditions: string[]
  expected_output: string
  cited_sources: SourceRef[]
  ranking_score: number
}

export interface CandidateSolution {
  id: string
  session_id: string
  title: string
  mechanism: string
  status: SolutionStatus
  novelty_score?: number | null
  feasibility_score?: number | null
  risk_notes?: string | null
  created_at?: string | null
  updated_at?: string | null
  linked_methods?: string[]
  cited_sources?: SourceRef[]
}

export interface CandidateSolutionsResponse {
  data: CandidateSolution[]
  meta: { total: number; session_id?: string }
}

export interface CreateCandidateSolutionInput {
  title: string
  mechanism: string
  status?: SolutionStatus
  novelty_score?: number
  feasibility_score?: number
  risk_notes?: string | null
}

export interface UpdateCandidateSolutionInput {
  title?: string
  mechanism?: string
  status?: SolutionStatus
  novelty_score?: number
  feasibility_score?: number
  risk_notes?: string | null
}

export interface DeleteCandidateSolutionResponse {
  status: string
  id: string
  session_id: string
}

export interface SourceRef {
  chunk_id: string
  excerpt: string
  relevance_score: number
}

export interface ResearchNote {
  id: string
  session_id: string
  content: string
  note_type: NoteType
  source_chunk_id?: string | null
  created_at: string
}

export interface ResearchNotesResponse {
  data: ResearchNote[]
  meta: { total: number }
}

export interface CreateResearchNoteInput {
  content: string
  note_type?: NoteType
  source_chunk_id?: string | null
}

export interface DeleteResearchNoteResponse {
  status: string
  id: string
  session_id: string
}

export interface NoteDraft {
  content: string
  note_type: NoteType
  source_chunk_id?: string | null
}


export interface KnowledgeChunk {
  id: string
  source_file: string
  section_title: string
  content: string
  topic: TopicType
  tags: string[]
}

// ──────────────────────────────────────────────
// Canonical TRIZ Catalog & Matrix Types
// ──────────────────────────────────────────────

export interface TrizParameter {
  id: number
  code: string
  name_vi: string
  name_en: string
  description?: string
}

export interface TrizParametersResponse {
  data: TrizParameter[]
  meta: { total: number }
}

export interface TrizPrinciple {
  id: number
  principle_id: number
  name_vi: string
  name_en: string
  description: string
  explanation?: string
  examples?: string[]
}

export interface TrizPrinciplesResponse {
  data: TrizPrinciple[]
  meta: { total: number }
}

export interface TrizLookupQuery {
  improving: number
  worsening: number
}

export interface TrizLookupResponse {
  improving_parameter: TrizParameter
  worsening_parameter: TrizParameter
  is_diagonal: boolean
  principles: TrizPrinciple[]
  principles_count: number
}

// ──────────────────────────────────────────────
// Phase 10.1 Full TRIZ 39 Parameters Auto-mapping Types
// ──────────────────────────────────────────────

export interface TrizParameterMatch {
  id: number
  code: string
  name_vi: string
  name_en: string
  score: number
  matched_keywords: string[]
  description: string
}

export interface TrizAutoMapResponse {
  data: TrizParameterMatch[]
  meta: {
    total_candidates: number
    query_text: string
  }
}

// ──────────────────────────────────────────────
// Phase 6.2 AI Problem Structuring Types
// ──────────────────────────────────────────────

export interface AIProblemAnalysisRequest {
  raw_statement: string
  domain?: string
}

export interface AIProblemAnalysisData {
  normalized_statement: string
  domain: string | null
  contradiction_type: string
  improving_parameter: string | null
  worsening_parameter: string | null
  suggested_keywords: string[]
  reasoning: string | null
}

export interface AIProblemAnalysisMeta {
  provenance: 'ai_hypothesis' | 'rule_based_fallback'
  provider: string
  model: string
  prompt_version: string
  latency_ms: number
  fallback_reason: string | null
}

export interface AIProblemAnalysisResponse {
  data: AIProblemAnalysisData
  _meta: AIProblemAnalysisMeta
}

// ──────────────────────────────────────────────
// Phase 8 Knowledge Base Management Types
// ──────────────────────────────────────────────

export interface DocumentChunkItem {
  id: string
  chunk_index: number
  token_count: number
  content: string
}

export interface DocumentItem {
  id: string
  filename: string
  filepath: string
  title: string
  topic: string | null
  source_type: string | null
  language: string | null
  tags: string[] | null
  phase: string | null
  status: 'canonical' | 'draft' | 'deprecated'
  golden: boolean
  content_hash: string
  chunks_count: number
  created_at: string
  updated_at: string
}

export interface DocumentDetail extends DocumentItem {
  chunks: DocumentChunkItem[]
}

export interface DocumentListResponse {
  data: DocumentItem[]
  meta: {
    total: number
    limit: number
    offset: number
  }
}

export interface DocumentDetailResponse {
  data: DocumentDetail
}

export interface DocumentUploadResponse {
  status: 'success' | 'already_exists'
  document_id: string
  filename: string
  title?: string
  chunks_created?: number
  embeddings_created?: number
  message?: string
  data?: {
    status: 'success' | 'already_exists'
    document_id: string
    filename: string
    title?: string
    chunks_created?: number
    embeddings_created?: number
    message?: string
  }
}

export interface DeleteDocumentResponse {
  status: string
  id: string
}

export interface DocumentFilterParams {
  q?: string
  topic?: string
  status?: string
  golden?: boolean
  limit?: number
  offset?: number
}

// ──────────────────────────────────────────────
// Phase 9A Export & AI Research Report Generator Types
// ──────────────────────────────────────────────

export interface SessionExportSnapshot {
  session: {
    id: string
    title: string
    description?: string | null
    status: string
    workflow_state: string
    created_at?: string | null
    updated_at?: string | null
  }
  problem_frame: ProblemFrame | null
  recommended_methods: RecommendedMethod[]
  research_notes: ResearchNote[]
  candidate_solutions: CandidateSolution[]
}

export interface AIResearchReport {
  session_id: string
  report_title: string
  executive_summary: string
  problem_background: string
  evidence_synthesis: string
  solution_assessment: string
  action_plan: string[]
  markdown_content: string
  provenance: 'ai_synthesis' | 'rule_based_fallback'
  provider?: string
  model?: string
  prompt_version?: string
  latency_ms?: number
  fallback_reason?: string | null
}

export interface AIResearchReportResponse {
  data: AIResearchReport
}

// ──────────────────────────────────────────────
// Phase 9.3 Session Import & Domain Templates Types
// ──────────────────────────────────────────────

export interface SessionTemplate {
  id: string
  title: string
  domain: string
  description: string
  tags: string[]
  workflow_state: string
  problem_frame?: {
    raw_statement: string
    normalized_statement?: string | null
    contradiction_type: string
    improving_parameter?: string | null
    worsening_parameter?: string | null
    domain: string
  }
}

export interface SessionTemplatesResponse {
  data: SessionTemplate[]
}

export type Session = ResearchSession

export interface CreateSessionFromTemplateInput {
  template_id: string
  custom_title?: string
  title?: string
}

export interface ImportSessionResponse {
  data: ResearchSession
  imported_elements: {
    problem_frame: boolean
    notes_count: number
    solutions_count: number
  }
  message?: string
}

// ──────────────────────────────────────────────
// Analytics Overview Types (Phase 11.1)
// ──────────────────────────────────────────────

export interface SessionAnalytics {
  total: number
  by_status: Record<string, number>
  by_workflow_state: Record<string, number>
  by_domain: Record<string, number>
}

export interface ContentAnalytics {
  total_problem_frames: number
  total_research_notes: number
  notes_by_type: Record<string, number>
  total_candidate_solutions: number
  solutions_by_status: Record<string, number>
}

export interface KnowledgeBaseAnalytics {
  total_documents: number
  golden_documents: number
  total_chunks: number
}

export interface TRIZAnalytics {
  total_contradictions: number
  by_contradiction_type: Record<string, number>
}

export interface AnalyticsOverviewData {
  sessions: SessionAnalytics
  content: ContentAnalytics
  knowledge_base: KnowledgeBaseAnalytics
  triz: TRIZAnalytics
}

export interface AnalyticsOverviewResponse {
  data: AnalyticsOverviewData
  generated_at: string
}
