"""
test_workflow_execution_api.py — Batch C21: UI Execution & TRIZ Matrix Workflow Integration.

Gherkin Scenarios:
  - Scenario: Execute end-to-end workflow
    Given a session with problem statement and ingested documents
    When the user triggers "Run Full Workflow" (POST /api/v1/sessions/{id}/run-workflow)
    Then the system executes: ingest -> embed -> retrieve -> recommend principles
    And the output shows progress at each step
    And the final output includes recommended TRIZ principles

  - Scenario: Integration test end-to-end
    Given 10 golden documents are ingested and embedded
    When a test query is executed against the full pipeline
    Then the system returns relevant TRIZ principles based on the query
    And the pipeline latency is within acceptable threshold (< 500ms total)
    And Recall@5 >= 0.75 on test retrieval
"""
from __future__ import annotations

import pathlib
import time
import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.orm import Session

from app.domain.models import Contradiction, ContradictionType, ProblemFrame, ResearchSession, SessionStatus
from app.main import app
from tests.integration.test_real_embedding_integration import DeterministicFakeEmbeddingClient
from app.services.ingestion_service import IngestionService
from app.services.retrieval_service import RetrievalService


@pytest.fixture(autouse=True)
def override_dependencies(db_session: Session):
    try:
        from app.api.v1.endpoints.sessions import get_db
        app.dependency_overrides[get_db] = lambda: db_session
        yield
        app.dependency_overrides.pop(get_db, None)
    except ImportError:
        yield


def _seed_10_golden_docs(engine, tmp_path: pathlib.Path) -> list[str]:
    """Helper nạp 10 golden documents vào DB phục vụ end-to-end integration benchmark."""
    client = DeterministicFakeEmbeddingClient()
    service = IngestionService(engine=engine, embedding_client=client)

    golden_specs = [
        ("01_TRIZ_Foundations.md", "triz", "TRIZ cung cấp 40 nguyên tắc sáng tạo để giải quyết mâu thuẫn kỹ thuật và vật lý."),
        ("02_Contradiction_Matrix.md", "triz", "Ma trận mâu thuẫn Altshuller 39x39 đối chiếu thông số cải thiện và thông số suy giảm."),
        ("03_Physical_Contradictions.md", "triz", "Mâu thuẫn vật lý giải quyết bằng 4 nguyên tắc phân tách: không gian, thời gian, điều kiện, hệ thống."),
        ("04_System_Operator.md", "triz", "Sơ đồ 9 màn hình phân tích hệ thống qua quá khứ, hiện tại, tương lai và siêu hệ thống, phân hệ."),
        ("05_Substance_Field.md", "triz", "Phân tích chất trường Su-Field mô hình hóa tương tác giữa hai chất và một trường năng lượng."),
        ("06_Trends_of_Evolution.md", "evolution", "Các quy luật tiến hóa của hệ thống kỹ thuật: tăng tính lý tưởng, chuyển sang vi mô."),
        ("07_Everyday_TRIZ.md", "daily", "Ứng dụng TRIZ trong đời sống và kinh doanh: phân đoạn công việc, dự phòng rủi ro."),
        ("08_Smart_Materials.md", "materials", "Vật liệu thông minh và hợp kim ghi nhớ hình dạng giải quyết mâu thuẫn độ cứng và khối lượng."),
        ("09_Architecture_Design.md", "architecture", "Kiến trúc phần mềm hướng domain, phân tách ranh giới và microservices."),
        ("10_Hybrid_Search_Vector.md", "database", "Tìm kiếm lai kết hợp PostgreSQL Full-Text Search và pgvector Cosine Distance."),
    ]

    doc_ids = []
    for filename, topic, content in golden_specs:
        file_path = tmp_path / filename
        file_path.write_text(
            f"""---
title: "{filename}"
topic: "{topic}"
source_type: "golden"
language: "vi"
phase: "6"
status: "canonical"
golden: true
---

{content}
""",
            encoding="utf-8",
        )
        res = service.ingest(str(file_path))
        assert res.status == "success"
        doc_ids.append(str(res.document_id))
    return doc_ids


@pytest.mark.asyncio
async def test_get_embedding_status_endpoint(db_session: Session, tmp_path: pathlib.Path):
    """
    Xác nhận endpoint GET /api/v1/documents/embedding-status trả về đúng thông số
    tiến độ embedding và model name.
    """
    engine = db_session.get_bind()
    _seed_10_golden_docs(engine, tmp_path)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/v1/documents/embedding-status")
        assert resp.status_code == 200
        payload = resp.json()
        assert "data" in payload
        data = payload["data"]
        assert data["total_documents"] >= 10
        assert data["embedded_documents"] >= 10
        assert "provider" in data
        assert "model" in data
        assert "documents embedded" in data["progress_text"]


@pytest.mark.asyncio
async def test_run_session_workflow_end_to_end(db_session: Session, tmp_path: pathlib.Path):
    """
    Scenario: Execute end-to-end workflow
    GIVEN: Session có problem statement và 10 golden docs đã được ingest & embed
    WHEN: Gọi POST /api/v1/sessions/{id}/run-workflow
    THEN: Pipeline thực thi 4 bước: ingest -> embed -> retrieve -> recommend_principles
          kèm tiến độ, latency tổng < 500ms, và danh sách TRIZ principles gợi ý.
    """
    engine = db_session.get_bind()
    _seed_10_golden_docs(engine, tmp_path)

    # Tạo Session với ProblemFrame
    session = ResearchSession(
        title="Tối ưu độ bền và trọng lượng cánh tay robot",
        description="Nghiên cứu ứng dụng TRIZ cho composite",
        domain="technical",
        status=SessionStatus.active,
        workflow_state="structuring",
    )
    db_session.add(session)
    db_session.flush()

    frame = ProblemFrame(
        session_id=session.id,
        raw_statement="Tăng độ cứng của cánh tay robot nhưng không được làm tăng trọng lượng",
        normalized_statement="Cải thiện độ bền/độ cứng trong khi duy trì hoặc giảm trọng lượng",
        contradiction_type=ContradictionType.technical,
        improving_parameter="Độ bền / Độ cứng",
        worsening_parameter="Trọng lượng vật thể",
    )
    db_session.add(frame)
    db_session.flush()

    contradiction = Contradiction(
        problem_frame_id=frame.id,
        type=ContradictionType.technical,
        statement="Cải thiện độ cứng làm tăng trọng lượng",
        suggested_principles=[1, 10, 35, 40],
    )
    db_session.add(contradiction)
    db_session.commit()

    start_time = time.perf_counter()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(f"/api/v1/sessions/{session.id}/run-workflow")
    elapsed_ms = (time.perf_counter() - start_time) * 1000

    assert resp.status_code == 200
    res_data = resp.json()["data"]

    # Kiểm tra bước thực thi
    step_names = [s["step"] for s in res_data["steps"]]
    assert "ingest" in step_names
    assert "embed" in step_names
    assert "retrieve" in step_names
    assert "recommend_principles" in step_names

    for s in res_data["steps"]:
        assert s["status"] == "completed"

    # Kiểm tra nguyên tắc sáng tạo đầu ra
    principles = res_data["principles"]
    assert len(principles) >= 1
    p_ids = [p["principle_id"] for p in principles]
    assert any(pid in [1, 10, 35, 40] for pid in p_ids)

    # Kiểm tra SLA latency < 500ms
    assert elapsed_ms < 500.0, f"Pipeline latency {elapsed_ms:.1f}ms vượt quá SLA 500ms"


@pytest.mark.asyncio
async def test_pipeline_retrieval_recall_at_5(db_session: Session, tmp_path: pathlib.Path):
    """
    Scenario: Integration test end-to-end (Recall@5 >= 0.75)
    GIVEN: 10 golden documents đã được ingest vào corpus
    WHEN: Thực hiện các truy vấn kỹ thuật đặc thù
    THEN: Tài liệu liên quan xuất hiện trong Top 5 kết quả với Recall@5 >= 0.75
    """
    engine = db_session.get_bind()
    _seed_10_golden_docs(engine, tmp_path)

    test_queries_and_targets = [
        ("40 nguyên tắc sáng tạo giải quyết mâu thuẫn", "01_TRIZ_Foundations.md"),
        ("ma trận 39x39 altshuller thông số", "02_Contradiction_Matrix.md"),
        ("phân tách không gian thời gian mâu thuẫn vật lý", "03_Physical_Contradictions.md"),
        ("sơ đồ 9 màn hình quá khứ tương lai", "04_System_Operator.md"),
        ("chất trường su-field mô hình hóa", "05_Substance_Field.md"),
        ("quy luật tiến hóa hệ thống kỹ thuật", "06_Trends_of_Evolution.md"),
        ("tìm kiếm lai postgresql full text và pgvector", "10_Hybrid_Search_Vector.md"),
        ("vật liệu thông minh hợp kim nhớ hình", "08_Smart_Materials.md"),
    ]

    retrieval_service = RetrievalService(bind=db_session)

    hits = 0
    total_queries = len(test_queries_and_targets)

    for query, target_doc_name in test_queries_and_targets:
        results = retrieval_service.search(query=query, top_k=5)
        matched_filenames = [r.source_ref.rsplit("/", 1)[-1] for r in results]
        if any(target_doc_name in fn for fn in matched_filenames):
            hits += 1

    recall = hits / total_queries
    assert recall >= 0.75, f"Recall@5 là {recall:.2f}, không đạt ngưỡng >= 0.75"
