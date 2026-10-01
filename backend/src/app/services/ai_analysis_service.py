"""
ai_analysis_service.py — AI Problem Analysis Service & AI Trust Contract (Phase 6.2).

Nhiệm vụ:
  1. Nhận raw statement từ người dùng.
  2. Gọi LLMClient (OpenAI / Gemini / Mock) để thực hiện phân tích bài toán chuyên sâu.
  3. Validate chặt chẽ dữ liệu đầu ra:
     - contradiction_type phải thuộc {"technical", "physical", "none", "unknown"}.
     - improving_parameter và worsening_parameter nếu không thuộc universe 39 TRIZ parameters thì đặt là None (không tự ý suy đoán).
  4. Graceful Fallback: Nếu LLM lỗi (timeout, quota 429, invalid JSON, exception), tự động fallback sang Rule-Based analysis.
  5. Đảm bảo AI Trust Contract:
     - Hoàn toàn KHÔNG ghi đè (zero auto-overwrite) xuống cơ sở dữ liệu (ProblemFrame / Contradiction).
     - Không tự ý thay đổi FSM workflow state.
     - Trả về provenance rõ ràng: "ai_hypothesis" hoặc "rule_based_fallback" kèm latency_ms và fallback_reason.

Ref: docs/PROFESSIONAL_UPGRADE_ROADMAP.md (Phase 6.2), docs/PHASE_6_7_EXECUTION_SPEC.md
"""
from __future__ import annotations

import logging
import time
import uuid
from typing import Any, Optional
from pydantic import BaseModel, Field

from app.domain.models import ContradictionType
from app.services.llm_client import (
    LLMAnalysisOutput,
    LLMClient,
    get_llm_client,
)
from app.services.problem_structuring_service import (
    ProblemStructuringService,
    _PARAM_TO_ID_MAP,
)

logger = logging.getLogger(__name__)

PROMPT_VERSION: str = "2026-10-01.v1"
VALID_TRIZ_PARAMETERS: set[str] = set(_PARAM_TO_ID_MAP.keys())


# ──────────────────────────────────────────────
# Response & Result Schemas
# ──────────────────────────────────────────────

class AIProblemAnalysisResult(BaseModel):
    """Kết quả phân tích bài toán từ AI Service."""
    normalized_statement: str
    domain: Optional[str] = None
    contradiction_type: str = "technical"
    improving_parameter: Optional[str] = None
    worsening_parameter: Optional[str] = None
    suggested_keywords: list[str] = Field(default_factory=list)
    reasoning: str = ""
    provenance: str = "ai_hypothesis"  # "ai_hypothesis" | "rule_based_fallback"
    provider: str = "mock"
    model: str = "mock-model"
    prompt_version: str = PROMPT_VERSION
    latency_ms: float = 0.0
    fallback_reason: Optional[str] = None


# ──────────────────────────────────────────────
# Service Class
# ──────────────────────────────────────────────

class AIAnalysisService:
    """Service điều phối phân tích bài toán AI với AI Trust Contract & Graceful Fallback."""

    def __init__(
        self,
        llm_client: Optional[LLMClient] = None,
        rule_service: Optional[ProblemStructuringService] = None,
    ) -> None:
        self.llm_client = llm_client or get_llm_client()
        self.rule_service = rule_service or ProblemStructuringService()

    def analyze_problem(
        self,
        raw_statement: str,
        domain: Optional[str] = None,
    ) -> AIProblemAnalysisResult:
        """
        Thực hiện phân tích bài toán với LLM, kiểm tra an toàn và fallback nếu cần.
        Hàm này là pure query logic, tuyệt đối không mutate database.
        """
        start_time = time.perf_counter()
        clean_statement = (raw_statement or "").strip()
        clean_domain = (domain or "").strip() or None

        provider = getattr(self.llm_client, "provider_name", "unknown")
        model = getattr(self.llm_client, "model_name", "unknown")

        # 1. Thử gọi LLM Client
        try:
            raw_output: LLMAnalysisOutput = self.llm_client.analyze(
                raw_statement=clean_statement,
                domain=clean_domain,
            )

            # Validate contradiction_type enum
            valid_contradiction_types = {"technical", "physical", "none", "unknown"}
            c_type = (raw_output.contradiction_type or "unknown").strip().lower()
            if c_type not in valid_contradiction_types:
                c_type = "unknown"

            # Validate & Sanitize TRIZ parameters (Strict constraint: Not in 39 -> set None)
            improving = raw_output.improving_parameter
            if improving:
                improving = improving.strip().lower()
                if improving not in VALID_TRIZ_PARAMETERS:
                    improving = None

            worsening = raw_output.worsening_parameter
            if worsening:
                worsening = worsening.strip().lower()
                if worsening not in VALID_TRIZ_PARAMETERS:
                    worsening = None

            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

            return AIProblemAnalysisResult(
                normalized_statement=raw_output.normalized_statement,
                domain=raw_output.domain or clean_domain,
                contradiction_type=c_type,
                improving_parameter=improving,
                worsening_parameter=worsening,
                suggested_keywords=raw_output.suggested_keywords or [],
                reasoning=raw_output.reasoning or "",
                provenance="ai_hypothesis",
                provider=provider,
                model=model,
                prompt_version=PROMPT_VERSION,
                latency_ms=elapsed_ms,
                fallback_reason=None,
            )

        except Exception as e:
            logger.warning(
                f"AIAnalysisService LLM execution failed ({provider}/{model}): {e}. "
                f"Falling back to Rule-Based ProblemStructuringService."
            )
            return self._fallback_to_rule_based(
                clean_statement,
                clean_domain,
                start_time,
                fallback_reason=str(e),
                provider=provider,
                model=model,
            )

    def _fallback_to_rule_based(
        self,
        raw_statement: str,
        domain: Optional[str],
        start_time: float,
        fallback_reason: str,
        provider: str,
        model: str,
    ) -> AIProblemAnalysisResult:
        """Xử lý fallback sang rule-based khi LLM gặp sự cố."""
        c_type_enum, improving, worsening = self.rule_service._extract_parameters_and_type(raw_statement)
        c_type = (
            c_type_enum.value
            if isinstance(c_type_enum, ContradictionType)
            else str(c_type_enum)
        )

        normalized = self.rule_service._normalize_statement(
            raw_statement=raw_statement,
            domain=domain,
            contradiction_type=c_type_enum,
            improving_param=improving,
            worsening_param=worsening,
        )

        # Trích xuất từ khóa đơn giản từ parameters
        keywords: list[str] = []
        if improving:
            keywords.append(improving)
        if worsening:
            keywords.append(worsening)
        if not keywords:
            keywords.append("nghiên cứu")

        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

        return AIProblemAnalysisResult(
            normalized_statement=normalized,
            domain=domain,
            contradiction_type=c_type,
            improving_parameter=improving,
            worsening_parameter=worsening,
            suggested_keywords=keywords,
            reasoning=f"Dự phòng Rule-Based do lỗi: {fallback_reason}",
            provenance="rule_based_fallback",
            provider=provider,
            model=model,
            prompt_version=PROMPT_VERSION,
            latency_ms=elapsed_ms,
            fallback_reason=fallback_reason,
        )
