"""
session_export_service.py — Dịch vụ xuất dữ liệu Session thành báo cáo Markdown (Phase 9.1).
"""
from __future__ import annotations

import uuid
from typing import Optional
from sqlalchemy.orm import Session

from app.domain.models import (
    ProblemFrame,
    ResearchNote,
    ResearchSession,
)


def export_session_as_markdown(session: ResearchSession, db: Session) -> str:
    """
    Sinh tài liệu Markdown hoàn chỉnh (GitHub Flavored Markdown) từ dữ liệu của ResearchSession.

    Bao gồm:
      - YAML Frontmatter (metadata: title, session_id, status, workflow_state, timestamps)
      - Header & Overview
      - Mục 1: Bài toán & Phân tích mâu thuẫn TRIZ
      - Mục 2: Nguyên tắc sáng tạo đề xuất
      - Mục 3: Sổ tay ghi chép nghiên cứu (Research Notes)
    """
    status_str = (
        session.status.value
        if hasattr(session.status, "value")
        else str(session.status)
    )
    created_iso = session.created_at.isoformat() if session.created_at else ""
    updated_iso = session.updated_at.isoformat() if session.updated_at else created_iso

    # 1. YAML Frontmatter
    lines = [
        "---",
        f'title: "{session.title}"',
        f'session_id: "{session.id}"',
        f"status: {status_str}",
        f"workflow_state: {session.workflow_state}",
        f"created_at: {created_iso}",
        f"updated_at: {updated_iso}",
        "---",
        "",
        f"# {session.title}",
        "",
        f"> **Mã phiên nghiên cứu:** `{session.id}`  ",
        f"> **Trạng thái:** `{status_str}` | **Giai đoạn:** `{session.workflow_state}`  ",
        f"> **Thời gian tạo:** {created_iso} | **Cập nhật:** {updated_iso}",
        "",
    ]

    if session.description:
        lines.extend([
            "### Mô tả tổng quan",
            session.description.strip(),
            "",
        ])

    # 2. Section 1: Problem Framing & Contradiction Analysis
    lines.extend([
        "# 1. BÀI TOÁN & PHÂN TÍCH MÂU THUẪN TRIZ",
        "",
    ])

    frame: Optional[ProblemFrame] = (
        db.query(ProblemFrame)
        .filter_by(session_id=session.id)
        .order_by(ProblemFrame.created_at.desc())
        .first()
    )

    if frame:
        contra_type_str = (
            frame.contradiction_type.value
            if hasattr(frame.contradiction_type, "value")
            else str(frame.contradiction_type)
        )
        lines.extend([
            f"- **Phát biểu bài toán gốc (Raw Statement):**",
            f"  > {frame.raw_statement}",
            "",
            f"- **Bài toán chuẩn hóa (Normalized Statement):**",
            f"  > {frame.normalized_statement or 'Chưa có chuẩn hóa'}",
            "",
            "| Thuộc tính | Chi tiết |",
            "| :--- | :--- |",
            f"| **Phân loại mâu thuẫn** | `{contra_type_str}` |",
            f"| **Thông số cần cải thiện (+)** | {frame.improving_parameter or 'N/A'} |",
            f"| **Thông số bị xấu đi (-)** | {frame.worsening_parameter or 'N/A'} |",
            f"| **Lĩnh vực nghiên cứu** | {frame.domain or 'N/A'} |",
            "",
        ])
    else:
        lines.extend([
            "_Chưa có dữ liệu phân tích cấu trúc bài toán cho phiên nghiên cứu này._",
            "",
        ])

    # 3. Section 2: Recommended TRIZ Principles
    lines.extend([
        "# 2. NGUYÊN TẮC SÁNG TẠO ĐỀ XUẤT",
        "",
    ])

    if frame and (frame.improving_parameter or frame.worsening_parameter):
        lines.extend([
            "Dựa trên phân tích mâu thuẫn kỹ thuật Altshuller Matrix, các nguyên tắc sáng tạo tiềm năng được đề xuất để giải quyết mâu thuẫn giữa thông số cải thiện và thông số bị suy giảm.",
            "",
            f"- **Cặp thông số mâu thuẫn:** `{frame.improving_parameter or 'N/A'}` vs `{frame.worsening_parameter or 'N/A'}`",
            "",
        ])
    else:
        lines.extend([
            "_Chưa có dữ liệu nguyên tắc sáng tạo đề xuất (cần hoàn thành bước phân tích cấu trúc mâu thuẫn)._",
            "",
        ])

    # 4. Section 3: Research Notes
    lines.extend([
        "# 3. SỔ TAY GHI CHÉP NGHIÊN CỨU (RESEARCH NOTES)",
        "",
    ])

    notes = (
        db.query(ResearchNote)
        .filter_by(session_id=session.id)
        .order_by(ResearchNote.created_at.asc(), ResearchNote.id.asc())
        .all()
    )

    if notes:
        lines.append(f"Tổng số ghi chú: **{len(notes)}**\n")
        for idx, note in enumerate(notes, 1):
            note_type_badge = note.note_type.capitalize()
            note_time = (
                note.created_at.strftime("%Y-%m-%d %H:%M:%S UTC")
                if note.created_at
                else "N/A"
            )
            lines.extend([
                f"### {idx}. [{note_type_badge}] {note_time}",
                "",
                note.content.strip(),
                "",
                f"*(Mã ghi chú: `{note.id}`"
                + (f" | Nguồn trích dẫn: `{note.source_chunk_id}`" if note.source_chunk_id else "")
                + ")*",
                "",
                "---",
                "",
            ])
    else:
        lines.extend([
            "_Chưa có ghi chú nghiên cứu nào được tạo trong phiên này._",
            "",
        ])

    return "\n".join(lines).strip() + "\n"
