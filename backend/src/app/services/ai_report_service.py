"""
ai_report_service.py — AI Research Report Generator & Synthesis Service (Phase 9A).

Nhiệm vụ:
  1. Thu thập toàn diện dữ liệu phiên nghiên cứu (ProblemFrame, TRIZ principles, ResearchNotes, CandidateSolutions).
  2. Gọi LLMClient (OpenAI / Gemini / Mock) để tạo báo cáo tổng hợp chuyên sâu (Executive Summary, Synthesis, Assessment, Action Plan).
  3. Validate cấu trúc kết quả chặt chẽ.
  4. Graceful Fallback: Nếu LLM lỗi (timeout, 429 quota, exception), tự động fallback sang Rule/Template-based synthesis.
  5. Đảm bảo AI Trust Contract:
     - Hoàn toàn KHÔNG ghi đè / tạo mới / xóa dữ liệu trong cơ sở dữ liệu.
     - KHÔNG thay đổi workflow_state hay chuyển đổi FSM.
     - Trả về provenance rõ ràng ("ai_synthesis" hoặc "rule_based_fallback") kèm metadata.

Ref: docs/ADR/ADR-005-phase-9a-export-and-synthesis.md, docs/PHASE_9A_EXPORT_AND_SYNTHESIS_EXECUTION_SPEC.md
"""
from __future__ import annotations

import logging
import time
import uuid
from typing import Any, Optional
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.domain.models import ResearchSession
from app.services.llm_client import LLMClient, get_llm_client
from app.services.session_export_service import export_session_as_json

logger = logging.getLogger(__name__)

PROMPT_VERSION: str = "2026-10-02.v1"


# ──────────────────────────────────────────────
# Response & Result Schemas
# ──────────────────────────────────────────────

class AIResearchReportResult(BaseModel):
    """Cấu trúc dữ liệu báo cáo nghiên cứu tổng hợp (Phase 9A)."""
    session_id: str
    report_title: str
    executive_summary: str
    problem_background: str
    evidence_synthesis: str
    solution_assessment: str
    action_plan: list[str] = Field(default_factory=list)
    markdown_content: str
    provenance: str = "ai_synthesis"  # "ai_synthesis" | "rule_based_fallback"
    provider: str = "mock"
    model: str = "mock-model"
    prompt_version: str = PROMPT_VERSION
    latency_ms: float = 0.0
    fallback_reason: Optional[str] = None


# ──────────────────────────────────────────────
# Service Class
# ──────────────────────────────────────────────

class AIReportService:
    """Service sinh báo cáo nghiên cứu tổng hợp AI với AI Trust Contract & Graceful Fallback."""

    def __init__(
        self,
        llm_client: Optional[LLMClient] = None,
    ) -> None:
        self.llm_client = llm_client or get_llm_client()

    def generate_report(
        self,
        session_id: uuid.UUID,
        db: Session,
    ) -> AIResearchReportResult:
        """
        Sinh báo cáo nghiên cứu tổng hợp cho một ResearchSession.
        Hàm này là pure-read / pure-query logic, tuyệt đối không mutate database.
        """
        start_time = time.perf_counter()

        # 1. Truy vấn session từ database
        session_record = db.query(ResearchSession).filter_by(id=session_id).first()
        if not session_record:
            raise ValueError(f"ResearchSession with id '{session_id}' not found.")

        # 2. Lấy dữ liệu snapshot session
        session_data = export_session_as_json(session_record, db)

        provider = getattr(self.llm_client, "provider_name", "unknown")
        model = getattr(self.llm_client, "model_name", "unknown")

        # 3. Thử gọi LLM Client
        try:
            if not hasattr(self.llm_client, "generate_report"):
                raise NotImplementedError(f"LLMClient '{provider}' does not support generate_report.")

            raw_output = self.llm_client.generate_report(session_data)

            report_title = (
                raw_output.get("report_title")
                or f"Báo cáo Nghiên cứu: {session_record.title}"
            ).strip()
            exec_summary = (raw_output.get("executive_summary") or "").strip()
            problem_bg = (raw_output.get("problem_background") or "").strip()
            evidence_syn = (raw_output.get("evidence_synthesis") or "").strip()
            sol_assess = (raw_output.get("solution_assessment") or "").strip()
            raw_actions = raw_output.get("action_plan", [])
            action_plan = [str(a).strip() for a in raw_actions if str(a).strip()]

            markdown_content = (raw_output.get("markdown_content") or "").strip()
            if not markdown_content:
                markdown_content = self._build_markdown_document(
                    report_title=report_title,
                    session_id=str(session_id),
                    executive_summary=exec_summary,
                    problem_background=problem_bg,
                    evidence_synthesis=evidence_syn,
                    solution_assessment=sol_assess,
                    action_plan=action_plan,
                    provenance="ai_synthesis",
                    provider=provider,
                    model=model,
                )

            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

            return AIResearchReportResult(
                session_id=str(session_id),
                report_title=report_title,
                executive_summary=exec_summary,
                problem_background=problem_bg,
                evidence_synthesis=evidence_syn,
                solution_assessment=sol_assess,
                action_plan=action_plan,
                markdown_content=markdown_content,
                provenance="ai_synthesis",
                provider=provider,
                model=model,
                prompt_version=PROMPT_VERSION,
                latency_ms=elapsed_ms,
                fallback_reason=None,
            )

        except Exception as e:
            logger.warning(
                f"AIReportService LLM execution failed ({provider}/{model}): {e}. "
                f"Falling back to Deterministic Template-Based Synthesis."
            )
            return self._fallback_to_template(
                session_record=session_record,
                session_data=session_data,
                start_time=start_time,
                fallback_reason=str(e),
                provider=provider,
                model=model,
            )

    def _fallback_to_template(
        self,
        session_record: ResearchSession,
        session_data: dict[str, Any],
        start_time: float,
        fallback_reason: str,
        provider: str,
        model: str,
    ) -> AIResearchReportResult:
        """Xử lý fallback sang tổng hợp tất định dạng template khi LLM gặp sự cố."""
        title = session_record.title
        report_title = f"Báo cáo Tổng hợp Nghiên cứu: {title}"

        # Trích xuất problem frame
        frame = session_data.get("problem_frame")
        if frame:
            problem_bg = (
                f"Bài toán nghiên cứu: {frame.get('raw_statement', 'N/A')}\n"
                f"Phân loại mâu thuẫn TRIZ: {frame.get('contradiction_type', 'N/A')}. "
                f"Thông số cải thiện (+): {frame.get('improving_parameter', 'N/A')} | "
                f"Thông số suy giảm (-): {frame.get('worsening_parameter', 'N/A')}."
            )
        else:
            problem_bg = f"Phiên nghiên cứu '{title}' hiện chưa hoàn thành bước chuẩn hóa cấu trúc bài toán."

        # Trích xuất research notes
        notes = session_data.get("research_notes", [])
        if notes:
            evidence_syn = (
                f"Hệ thống đã thu thập {len(notes)} ghi chú nghiên cứu và trích dẫn bằng chứng. "
                f"Các chủ đề chính bao gồm: "
                + ", ".join([f"[{n.get('note_type', 'note').capitalize()}] {n.get('content', '')[:60]}..." for n in notes[:3]])
            )
        else:
            evidence_syn = "Chưa có ghi chú hoặc trích dẫn tri thức được lưu trữ trong phiên này."

        # Trích xuất candidate solutions
        solutions = session_data.get("candidate_solutions", [])
        if solutions:
            accepted_sols = [s for s in solutions if s.get("status") == "accepted"]
            sol_assess = (
                f"Đã xây dựng {len(solutions)} phương án giải pháp sáng tạo ứng viên "
                f"({len(accepted_sols)} phương án đã được chấp nhận). "
                f"Phương án tiêu biểu: '{solutions[0].get('title', 'N/A')}' "
                f"với điểm tính mới {solutions[0].get('novelty_score', 0.0)} "
                f"và khả thi {solutions[0].get('feasibility_score', 0.0)}."
            )
        else:
            sol_assess = "Chưa có giải pháp sáng tạo ứng viên nào được đề xuất trong phiên nghiên cứu."

        # Action plan
        action_plan = [
            "1. Xác thực các giả thuyết kỹ thuật từ sổ tay ghi chép (Research Notes).",
            "2. Đánh giá tính khả thi và chi phí sản xuất cho các phương án giải pháp được chấp nhận.",
            "3. Thiết kế mô hình thử nghiệm (Proof of Concept) và đo lường tham số.",
        ]

        exec_summary = (
            f"Tổng quan báo cáo nghiên cứu cho đề tài '{title}'. "
            f"Hệ thống đã chuẩn hóa mâu thuẫn kỹ thuật và tổng hợp {len(notes)} bằng chứng "
            f"cùng {len(solutions)} đề xuất giải pháp ứng viên."
        )

        markdown_content = self._build_markdown_document(
            report_title=report_title,
            session_id=str(session_record.id),
            executive_summary=exec_summary,
            problem_background=problem_bg,
            evidence_synthesis=evidence_syn,
            solution_assessment=sol_assess,
            action_plan=action_plan,
            provenance="rule_based_fallback",
            provider=provider,
            model=model,
            fallback_reason=fallback_reason,
        )

        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

        return AIResearchReportResult(
            session_id=str(session_record.id),
            report_title=report_title,
            executive_summary=exec_summary,
            problem_background=problem_bg,
            evidence_synthesis=evidence_syn,
            solution_assessment=sol_assess,
            action_plan=action_plan,
            markdown_content=markdown_content,
            provenance="rule_based_fallback",
            provider=provider,
            model=model,
            prompt_version=PROMPT_VERSION,
            latency_ms=elapsed_ms,
            fallback_reason=fallback_reason,
        )

    def _build_markdown_document(
        self,
        report_title: str,
        session_id: str,
        executive_summary: str,
        problem_background: str,
        evidence_synthesis: str,
        solution_assessment: str,
        action_plan: list[str],
        provenance: str,
        provider: str,
        model: str,
        fallback_reason: Optional[str] = None,
    ) -> str:
        """Sinh tài liệu Markdown hoàn chỉnh cho báo cáo nghiên cứu."""
        lines = [
            f"# {report_title}",
            "",
            f"> **Mã phiên:** `{session_id}` | **Nguồn gốc:** `{provenance}` ({provider}/{model})  ",
            f"> **Phiên bản Prompt:** `{PROMPT_VERSION}`",
            "",
        ]

        if fallback_reason:
            lines.extend([
                f"> ⚠️ *Lưu ý: Báo cáo được tạo bằng quy tắc dự phòng do lỗi LLM: {fallback_reason}*",
                "",
            ])

        lines.extend([
            "## 1. Tóm Tắt Điều Hành (Executive Summary)",
            "",
            executive_summary,
            "",
            "## 2. Bối Cảnh & Định Khung Mâu Thuẫn (Problem Background)",
            "",
            problem_background,
            "",
            "## 3. Tổng Hợp Tri Thức & Bằng Chứng (Evidence Synthesis)",
            "",
            evidence_synthesis,
            "",
            "## 4. Đánh Giá Giải Pháp Sáng Tạo (Solution Assessment)",
            "",
            solution_assessment,
            "",
            "## 5. Kế Hoạch Hành Động Đề Xuất (Action Plan)",
            "",
        ])

        for item in action_plan:
            lines.append(f"- {item}")

        lines.append("")
        return "\n".join(lines).strip() + "\n"
