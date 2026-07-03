// Shared TypeScript types mirroring the backend domain models

export type DomainType = 'technical' | 'business' | 'education' | 'personal' | 'research'
export type SessionStatus = 'draft' | 'active' | 'archived'
export type WorkflowStage = 'intake' | 'structuring' | 'retrieval' | 'ideation' | 'evaluation' | 'synthesis'
export type NoteType = 'insight' | 'hypothesis' | 'decision' | 'question' | 'action'
export type SolutionStatus = 'candidate' | 'accepted' | 'rejected'
export type TopicType = 'contradiction' | 'function' | 'evolution' | 'business' | 'case_study' | 'learning'

export interface ResearchSession {
  id: string
  title: string
  problem_statement: string
  domain: DomainType
  status: SessionStatus
  current_stage: WorkflowStage
  tags: string[]
  created_at: string
  updated_at: string
}

export interface ProblemFrame {
  id: string
  session_id: string
  goal: string
  constraints: string[]
  affected_entities: string[]
  failure_signals: string[]
  success_criteria: string[]
  contradictions: Contradiction[]
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
  linked_methods: string[]
  cited_sources: SourceRef[]
  novelty_score: number
  feasibility_score: number
  risk_notes: string
  status: SolutionStatus
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
  created_at: string
}

export interface KnowledgeChunk {
  id: string
  source_file: string
  section_title: string
  content: string
  topic: TopicType
  tags: string[]
}
