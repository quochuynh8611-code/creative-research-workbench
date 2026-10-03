"""
analytics.py — REST API endpoint cho Phase 11.1: Session Analytics & Research Intelligence Overview
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.v1.endpoints.sessions import get_db
from app.services.analytics_service import AnalyticsService

router = APIRouter()


class SessionAnalytics(BaseModel):
    total: int = 0
    by_status: dict[str, int] = Field(default_factory=dict)
    by_workflow_state: dict[str, int] = Field(default_factory=dict)
    by_domain: dict[str, int] = Field(default_factory=dict)


class ContentAnalytics(BaseModel):
    total_problem_frames: int = 0
    total_research_notes: int = 0
    notes_by_type: dict[str, int] = Field(default_factory=dict)
    total_candidate_solutions: int = 0
    solutions_by_status: dict[str, int] = Field(default_factory=dict)


class KnowledgeBaseAnalytics(BaseModel):
    total_documents: int = 0
    golden_documents: int = 0
    total_chunks: int = 0


class TRIZAnalytics(BaseModel):
    # Semantic distinction:
    # - total_contradictions: Đếm số lượng record trong bảng Contradiction
    # - by_contradiction_type: Phân bố loại mâu thuẫn từ ProblemFrame (technical, physical)
    total_contradictions: int = 0
    by_contradiction_type: dict[str, int] = Field(default_factory=dict)


class AnalyticsOverviewData(BaseModel):
    sessions: SessionAnalytics
    content: ContentAnalytics
    knowledge_base: KnowledgeBaseAnalytics
    triz: TRIZAnalytics


class AnalyticsOverviewResponse(BaseModel):
    data: AnalyticsOverviewData
    generated_at: str


@router.get("/overview", response_model=AnalyticsOverviewResponse)
def get_analytics_overview(
    db: Session = Depends(get_db),
) -> AnalyticsOverviewResponse:
    """
    Trả về tổng quan chỉ số nghiên cứu và tri thức (pure read-only).
    """
    service = AnalyticsService(bind=db)
    raw_data = service.get_overview()

    return AnalyticsOverviewResponse(
        data=AnalyticsOverviewData(
            sessions=SessionAnalytics(**raw_data["sessions"]),
            content=ContentAnalytics(**raw_data["content"]),
            knowledge_base=KnowledgeBaseAnalytics(**raw_data["knowledge_base"]),
            triz=TRIZAnalytics(**raw_data["triz"]),
        ),
        generated_at=datetime.now(timezone.utc).isoformat(),
    )
