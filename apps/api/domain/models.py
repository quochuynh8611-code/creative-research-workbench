"""Core domain models for Creative Research Workbench."""
import uuid
from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class DomainType(str, Enum):
    TECHNICAL = "technical"
    BUSINESS = "business"
    EDUCATION = "education"
    PERSONAL = "personal"
    RESEARCH = "research"


class SessionStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"


class WorkflowStage(str, Enum):
    INTAKE = "intake"
    STRUCTURING = "structuring"
    RETRIEVAL = "retrieval"
    IDEATION = "ideation"
    EVALUATION = "evaluation"
    SYNTHESIS = "synthesis"


class ContradictionType(str, Enum):
    TECHNICAL = "technical"
    PHYSICAL = "physical"


class NoteType(str, Enum):
    INSIGHT = "insight"
    HYPOTHESIS = "hypothesis"
    DECISION = "decision"
    QUESTION = "question"
    ACTION = "action"


class TopicType(str, Enum):
    CONTRADICTION = "contradiction"
    FUNCTION = "function"
    EVOLUTION = "evolution"
    BUSINESS = "business"
    CASE_STUDY = "case_study"
    LEARNING = "learning"


class SolutionStatus(str, Enum):
    CANDIDATE = "candidate"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


# --- Value Objects ---

class SourceRef(BaseModel):
    chunk_id: uuid.UUID
    excerpt: str
    relevance_score: float = Field(ge=0.0, le=1.0)


class Contradiction(BaseModel):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    problem_frame_id: uuid.UUID
    type: ContradictionType
    improving_parameter: str
    worsening_parameter: str
    context: str


class FunctionNode(BaseModel):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    actor: str
    action: str
    object: str
    is_useful: bool = True
    is_harmful: bool = False


class CauseEffectNode(BaseModel):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    description: str
    parent_id: Optional[uuid.UUID] = None
    is_root: bool = False


# --- Aggregate Roots ---

class ProblemFrame(BaseModel):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    session_id: uuid.UUID
    goal: str
    constraints: list[str] = []
    affected_entities: list[str] = []
    failure_signals: list[str] = []
    success_criteria: list[str] = []
    contradictions: list[Contradiction] = []
    functions: list[FunctionNode] = []
    cause_effect_chain: list[CauseEffectNode] = []


class ResearchSession(BaseModel):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    title: str
    problem_statement: str = ""
    domain: DomainType
    status: SessionStatus = SessionStatus.DRAFT
    current_stage: WorkflowStage = WorkflowStage.INTAKE
    tags: list[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class MethodSuggestion(BaseModel):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    session_id: uuid.UUID
    method_name: str
    rationale: str
    preconditions: list[str] = []
    expected_output: str
    cited_sources: list[SourceRef] = []
    ranking_score: float = Field(default=0.0, ge=0.0, le=1.0)


class CandidateSolution(BaseModel):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    session_id: uuid.UUID
    title: str
    mechanism: str
    linked_methods: list[str] = []
    cited_sources: list[SourceRef] = []
    novelty_score: float = Field(default=0.0, ge=0.0, le=1.0)
    feasibility_score: float = Field(default=0.0, ge=0.0, le=1.0)
    risk_notes: str = ""
    status: SolutionStatus = SolutionStatus.CANDIDATE


class KnowledgeChunk(BaseModel):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    source_file: str
    section_title: str
    content: str
    topic: TopicType
    tags: list[str] = []
    # embedding stored separately in DB


class ResearchNote(BaseModel):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    session_id: uuid.UUID
    content: str
    note_type: NoteType
    created_at: datetime = Field(default_factory=datetime.utcnow)
