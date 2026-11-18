"""
ai_coach_service.py — AI Solution Coach Service & TRIZ Heuristic Fallback (Batch C31).

Nhiệm vụ cốt lõi:
  1. Thu thập ngữ cảnh phiên nghiên cứu có giới hạn (ProblemFrame, Top Solutions, Top Notes, TRIZ Principles).
  2. Điều phối sinh gợi ý phân tích & giải pháp qua LLMClient (OpenAI / Ollama / Mock).
  3. Kỷ luật Grounding cứng: Bắt buộc mỗi gợi ý có source_grounding hợp lệ (contradiction, principle, evidence, note). Loại bỏ các gợi ý không có căn cứ.
  4. Giới hạn tối đa 5 suggestions cho mỗi phiên phân tích.
  5. Dual-Layer Fallback: Khi LLM lỗi (timeout > 10s, 429, malformed JSON, network down), tự động chuyển sang RuleBasedCoach (TRIZ Heuristic Generator).
  6. Zero Database Mutation: Toàn bộ quá trình là Read-only / Pure query preview.
"""
from __future__ import annotations

import datetime
import logging
import time
import uuid
from typing import Any, Literal, Optional
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.domain.models import CandidateSolution, ProblemFrame, ResearchNote, ResearchSession
from app.services.llm_client import LLMClient, get_llm_client
from app.services.method_recommender import MethodRecommender

logger = logging.getLogger(__name__)

MAX_SUGGESTIONS: int = 5
VALID_GROUNDING_TYPES: set[str] = {"contradiction", "principle", "evidence", "note"}
VALID_CATEGORIES: set[str] = {
    "possible_cause",
    "contradiction_direction",
    "relevant_principle",
    "clarifying_question",
    "solution_candidate",
}


# ──────────────────────────────────────────────
# Data Models
# ──────────────────────────────────────────────

class GroundingInfo(BaseModel):
    """Căn cứ lý luận hoặc nguồn gốc của gợi ý."""
    source_type: Literal["contradiction", "principle", "evidence", "note"]
    source_reference: str


class CoachSuggestion(BaseModel):
    """Một gợi ý phân tích / giải pháp từ AI Coach."""
    id: str = Field(default_factory=lambda: f"sug-{uuid.uuid4().hex[:8]}")
    category: str = "possible_cause"  # possible_cause | contradiction_direction | relevant_principle | clarifying_question | solution_candidate
    title: str
    description: str
    source_grounding: GroundingInfo
    actionable_payload: Optional[dict[str, Any]] = None


class AICoachResult(BaseModel):
    """Kết quả tổng thể trả về từ AI Coach Service."""
    session_id: str
    summary: str
    suggestions: list[CoachSuggestion] = Field(default_factory=list)
    provenance: str = "ai_coach"  # "ai_coach" | "rule_based_fallback" | "mock_coach"
    provider: str = "mock"
    model: str = "mock-model"
    latency_ms: float = 0.0
    fallback_reason: Optional[str] = None
    generated_at: str = Field(
        default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
    )


# ──────────────────────────────────────────────
# Rule-Based TRIZ Heuristic Coach (Deterministic Fallback)
# ──────────────────────────────────────────────

class RuleBasedCoach:
    """
    Bộ tạo gợi ý giải pháp TRIZ Heuristic thuần quy tắc (Rule-Based).
    Được kích hoạt khi LLM lỗi hoặc offline, đảm bảo hệ thống luôn cung cấp giá trị.
    Ghi nhận provenance: 'rule_based_fallback'.
    """

    def generate_suggestions(self, context_data: dict[str, Any]) -> dict[str, Any]:
        session_title = context_data.get("session_title", "Phiên nghiên cứu")
        frame = context_data.get("problem_frame") or {}
        improving = frame.get("improving_parameter") or "speed"
        worsening = frame.get("worsening_parameter") or "cost"
        principles = context_data.get("recommended_principles") or []

        if not principles:
            principles = [
                {"principle_id": 1, "name": "Phân nhỏ (Segmentation)", "description": "Chia đối tượng thành các phần độc lập"},
                {"principle_id": 10, "name": "Hành động sơ bộ (Prior Action)", "description": "Thực hiện trước các thay đổi cần thiết"},
            ]

        top_p = principles[0]
        p_name = top_p.get("name", "Phân nhỏ (Segmentation)")
        p_id = top_p.get("principle_id", 1)

        summary = (
            f"Rule-Based Coach nhận định bài toán '{session_title}' đang giải quyết mâu thuẫn giữa "
            f"'{improving}' và '{worsening}' dựa trên 40 Nguyên tắc Sáng tạo TRIZ."
        )

        suggestions = [
            {
                "category": "possible_cause",
                "title": f"Mâu thuẫn kỹ thuật giữa {improving} và {worsening}",
                "description": (
                    f"Khi nỗ lực cải thiện thông số '{improving}', hệ thống gặp lực cản "
                    f"làm tổn thất hoặc suy giảm thông số '{worsening}' do cách tiếp cận truyền thống."
                ),
                "source_grounding": {
                    "source_type": "contradiction",
                    "source_reference": f"Mâu thuẫn kỹ thuật: {improving} vs {worsening}"
                },
                "actionable_payload": None,
            },
            {
                "category": "relevant_principle",
                "title": f"Áp dụng Nguyên tắc #{p_id}: {p_name}",
                "description": (
                    f"Ma trận mâu thuẫn Altshuller khuyến nghị áp dụng Nguyên tắc #{p_id} ({p_name}) "
                    f"để tách biệt mâu thuẫn giữa {improving} và {worsening} mà không cần đánh đổi."
                ),
                "source_grounding": {
                    "source_type": "principle",
                    "source_reference": f"Nguyên tắc sáng tạo TRIZ #{p_id}: {p_name}"
                },
                "actionable_payload": None,
            },
            {
                "category": "solution_candidate",
                "title": f"Giải pháp Module hóa dựa trên {p_name}",
                "description": (
                    f"Cấu trúc lại đối tượng hoặc quy trình theo nguyên tắc {p_name}: chia nhỏ luồng xử lý "
                    f"thành các phân đoạn độc lập để tăng {improving} đồng thời kiểm soát {worsening}."
                ),
                "source_grounding": {
                    "source_type": "principle",
                    "source_reference": f"Nguyên tắc sáng tạo TRIZ #{p_id}: {p_name}"
                },
                "actionable_payload": {
                    "title": f"Giải pháp Module hóa ({p_name})",
                    "mechanism": f"Phân tách cấu trúc hệ thống thành các module chuyên biệt nhằm nâng cao {improving} mà không làm suy giảm {worsening}."
                },
            },
            {
                "category": "clarifying_question",
                "title": f"Kiểm chứng giả định đánh đổi giữa {improving} và {worsening}",
                "description": (
                    f"Có thể phân tách mâu thuẫn trong không gian hoặc thời gian để {worsening} "
                    f"không bị ảnh hưởng ở thời điểm {improving} hoạt động không?"
                ),
                "source_grounding": {
                    "source_type": "contradiction",
                    "source_reference": f"Mâu thuẫn tham số: {improving} vs {worsening}"
                },
                "actionable_payload": {
                    "content": f"Câu hỏi làm rõ: Thử nghiệm phân tách mâu thuẫn giữa {improving} và {worsening} theo thời gian hoặc không gian.",
                    "note_type": "hypothesis"
                },
            },
        ]

        return {
            "summary": summary,
            "suggestions": suggestions,
        }


# ──────────────────────────────────────────────
# AI Coach Service (Main Orchestrator)
# ──────────────────────────────────────────────

class AICoachService:
    """Service điều phối AI Solution Coach với Hard Grounding và Fallback Resilience."""

    def __init__(
        self,
        llm_client: Optional[LLMClient] = None,
    ) -> None:
        self.llm_client = llm_client or get_llm_client()
        self.rule_coach = RuleBasedCoach()

    def get_coach_suggestions(
        self,
        session_id: uuid.UUID,
        db: Session,
    ) -> AICoachResult:
        """
        Thu thập ngữ cảnh phiên nghiên cứu, gọi Coach và trả về danh sách gợi ý an toàn.
        Đảm bảo Pure Query (zero DB mutation) và Hard Grounding.
        """
        start_time = time.perf_counter()

        # 1. Xác thực session tồn tại
        session_record = db.query(ResearchSession).filter_by(id=session_id).first()
        if not session_record:
            raise ValueError(f"ResearchSession with id '{session_id}' not found.")

        # 2. Thu thập ngữ cảnh có giới hạn (Bounded Input Context)
        latest_frame = (
            db.query(ProblemFrame)
            .filter_by(session_id=session_id)
            .order_by(ProblemFrame.created_at.desc())
            .first()
        )

        existing_solutions = (
            db.query(CandidateSolution)
            .filter_by(session_id=session_id)
            .order_by(CandidateSolution.created_at.desc())
            .limit(3)
            .all()
        )

        existing_notes = (
            db.query(ResearchNote)
            .filter_by(session_id=session_id)
            .order_by(ResearchNote.created_at.desc())
            .limit(3)
            .all()
        )

        frame_dict = {}
        recommended_principles = []
        if latest_frame:
            frame_dict = {
                "raw_statement": latest_frame.raw_statement,
                "normalized_statement": latest_frame.normalized_statement,
                "contradiction_type": latest_frame.contradiction_type,
                "improving_parameter": latest_frame.improving_parameter,
                "worsening_parameter": latest_frame.worsening_parameter,
            }
            if latest_frame.improving_parameter and latest_frame.worsening_parameter:
                try:
                    recommender = MethodRecommender(bind=db)
                    recs = recommender.recommend_methods(session_id)
                    recommended_principles = [
                        {
                            "principle_id": r.get("method_id") or r.get("principle_id", 1),
                            "name": r.get("title") or r.get("name", ""),
                            "description": r.get("description", ""),
                        }
                        for r in recs[:4]
                    ]
                except Exception as e:
                    logger.warning(f"Error fetching recommended principles: {e}")

        context_data = {
            "session_id": str(session_id),
            "session_title": session_record.title,
            "domain": session_record.domain or "general",
            "problem_frame": frame_dict,
            "recommended_principles": recommended_principles,
            "existing_solutions": [{"title": s.title, "mechanism": s.mechanism} for s in existing_solutions],
            "existing_notes": [{"content": n.content, "type": n.note_type} for n in existing_notes],
        }

        # 3. Phân định chiến lược sinh gợi ý
        provider = getattr(self.llm_client, "provider_name", "unknown")
        model = getattr(self.llm_client, "model_name", "unknown")
        provenance = "ai_coach"
        fallback_reason: Optional[str] = None
        raw_output: dict[str, Any] = {}

        try:
            raw_output = self.llm_client.generate_coach_suggestions(context_data)
        except Exception as exc:
            logger.warning(
                "LLM coach generation failed (%s). Activating RuleBasedCoach fallback.", exc
            )
            raw_output = self.rule_coach.generate_suggestions(context_data)
            provenance = "rule_based_fallback"
            provider = "rule_based"
            model = "triz-heuristic-engine"
            fallback_reason = str(exc)

        # 4. Kỷ luật Hard Grounding & Validation
        raw_suggestions = raw_output.get("suggestions", [])
        validated_suggestions: list[CoachSuggestion] = []

        for item in raw_suggestions:
            if not isinstance(item, dict):
                continue

            grounding_raw = item.get("source_grounding")
            if not isinstance(grounding_raw, dict):
                logger.debug("Discarding suggestion without source_grounding dict: %s", item.get("title"))
                continue

            s_type = grounding_raw.get("source_type")
            s_ref = str(grounding_raw.get("source_reference") or "").strip()

            # Rule: source_type must be in VALID_GROUNDING_TYPES and source_reference non-empty
            if s_type not in VALID_GROUNDING_TYPES or not s_ref:
                logger.debug(
                    "Hard grounding violated (type='%s', ref='%s'). Discarding suggestion.",
                    s_type, s_ref
                )
                continue

            category = str(item.get("category", "possible_cause"))
            if category not in VALID_CATEGORIES:
                category = "possible_cause"

            title = str(item.get("title") or "").strip()
            description = str(item.get("description") or "").strip()
            if not title or not description:
                continue

            actionable_payload = item.get("actionable_payload")
            if actionable_payload is not None and not isinstance(actionable_payload, dict):
                actionable_payload = None

            validated_suggestions.append(
                CoachSuggestion(
                    id=str(item.get("id") or f"sug-{uuid.uuid4().hex[:8]}"),
                    category=category,
                    title=title,
                    description=description,
                    source_grounding=GroundingInfo(
                        source_type=s_type,
                        source_reference=s_ref,
                    ),
                    actionable_payload=actionable_payload,
                )
            )

        # Nếu sau khi lọc mà danh sách rỗng, kích hoạt RuleBasedCoach
        if not validated_suggestions and provenance != "rule_based_fallback":
            logger.warning("No valid grounded suggestions from AI. Falling back to RuleBasedCoach.")
            rule_output = self.rule_coach.generate_suggestions(context_data)
            provenance = "rule_based_fallback"
            provider = "rule_based"
            model = "triz-heuristic-engine"
            fallback_reason = "No valid grounded suggestions returned by primary LLM"
            for item in rule_output.get("suggestions", []):
                grounding_raw = item["source_grounding"]
                validated_suggestions.append(
                    CoachSuggestion(
                        category=item["category"],
                        title=item["title"],
                        description=item["description"],
                        source_grounding=GroundingInfo(
                            source_type=grounding_raw["source_type"],
                            source_reference=grounding_raw["source_reference"],
                        ),
                        actionable_payload=item.get("actionable_payload"),
                    )
                )

        # Giới hạn tối đa 5 suggestions
        capped_suggestions = validated_suggestions[:MAX_SUGGESTIONS]

        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        summary = str(raw_output.get("summary") or "AI Solution Coach hoàn thành phân tích phiên nghiên cứu.")

        # Ghi nhận Telemetry vào Metrics Collector (Batch C32)
        try:
            from app.core.metrics import metrics_collector
            metrics_collector.record_coach_call(
                provenance=provenance,
                latency_ms=latency_ms,
                fallback_reason=fallback_reason,
            )
        except Exception as metric_err:
            logger.debug("Failed to record coach metrics: %s", metric_err)

        return AICoachResult(
            session_id=str(session_id),
            summary=summary,
            suggestions=capped_suggestions,
            provenance=provenance,
            provider=provider,
            model=model,
            latency_ms=latency_ms,
            fallback_reason=fallback_reason,
        )
