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
  filters?: Record<string, any>
}

export interface SearchResultItem {
  chunk_id: string
  source_ref: string
  excerpt: string
  score: number
  metadata: Record<string, any>
}

export interface SearchResponse {
  results: SearchResultItem[]
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

