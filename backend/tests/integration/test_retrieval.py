"""
test_retrieval.py — Integration tests cho Retrieval pipeline

Coverage:
  IT-006: Retrieve evidence for contradiction (FAILING_INTEGRATION_TEST_SPEC.md)
  Gherkin: SC-004 Semantic search (GHERKIN_SCENARIOS.md)

Trạng thái hiện tại: RED — RetrievalService chưa được implement.
Mọi test trong file này PHẢI FAIL cho đến khi Phase 2 Step 3 hoàn thành.

Test design:
  - Dùng db_session fixture từ conftest.py (PostgreSQL thật qua testcontainers)
  - Dùng sample_chunks fixture với embeddings xác định (không random)
  - LLM embedding được mock: trả về vector [0.5] * 1536
  - Assertions dựa trên SearchResult dataclass từ models.py

Gherkin (SC-004):
  Given một ResearchSession có contradiction hợp lệ
  And corpus có ít nhất 3 chunks đã embed
  When gọi RetrievalService.search(query, top_k=5)
  Then kết quả phải có ít nhất 1 item
  And mỗi item phải có chunk_id, source_ref, excerpt, score hợp lệ
  And score phải nằm trong [0.0, 1.0]
  And kết quả được sắp xếp giảm dần theo score
"""
from __future__ import annotations

import uuid

import pytest
from sqlalchemy.orm import Session

from app.domain.models import (
    Chunk,
    Document,
    ProblemFrame,
    ResearchSession,
    SearchResult,
)

# RetrievalService chưa tồn tại — import sẽ raise ImportError (RED state)
# Khi implement xong, uncomment dòng dưới:
# from app.services.retrieval_service import RetrievalService


# ──────────────────────────────────────────────
# Marker: tất cả tests trong file này đều integration
# ──────────────────────────────────────────────
pytestmark = pytest.mark.integration


class TestSearchResultDataclass:
    """
    Unit tests cho SearchResult dataclass (models.py).
    Không cần DB — chạy luôn ngay cả khi RetrievalService chưa có.
    Trạng thái: GREEN (chỉ phụ thuộc models.py đã implement).
    """

    def test_search_result_fields_exist(self):
        """SearchResult phải có đủ 6 fields theo domain schema."""
        chunk_id = uuid.uuid4()
        doc_id = uuid.uuid4()
        result = SearchResult(
            chunk_id=chunk_id,
            source_ref="docs/triz-contradictions.md",
            excerpt="Mâu thuẫn kỹ thuật TRIZ: cải thiện tốc độ làm giảm độ tin cậy.",
            score=0.87,
            metadata={"topic": "contradictions", "golden": True},
            document_id=doc_id,
            chunk_index=0,
        )
        assert result.chunk_id == chunk_id
        assert result.source_ref == "docs/triz-contradictions.md"
        assert len(result.excerpt) > 0
        assert 0.0 <= result.score <= 1.0
        assert result.metadata["golden"] is True
        assert result.document_id == doc_id
        assert result.chunk_index == 0

    def test_search_result_default_metadata(self):
        """metadata phải default là dict rỗng, không phải None."""
        result = SearchResult(
            chunk_id=uuid.uuid4(),
            source_ref="docs/test.md",
            excerpt="test excerpt",
            score=0.5,
        )
        assert result.metadata == {}
        assert result.document_id is None
        assert result.chunk_index == 0


class TestDocumentAndChunkPersistence:
    """
    Kiểm tra rằng Document + Chunk được persist đúng trong DB.
    Đây là precondition của IT-006.
    Trạng thái: GREEN (chỉ phụ thuộc models.py + conftest).
    """

    def test_chunks_linked_to_document(
        self,
        db_session: Session,
        sample_document: Document,
        sample_chunks: list[Chunk],
    ):
        """
        Given: 3 chunks đã được tạo cho sample_document
        Then: chunks.count == 3 và mỗi chunk có document_id đúng
        """
        from sqlalchemy import select

        stmt = select(Chunk).where(Chunk.document_id == sample_document.id)
        result = db_session.execute(stmt).scalars().all()

        assert len(result) == 3
        for chunk in result:
            assert chunk.document_id == sample_document.id
            assert chunk.content is not None
            assert chunk.token_count > 0

    def test_chunk_embedding_stored(
        self,
        db_session: Session,
        sample_chunks: list[Chunk],
    ):
        """
        Given: chunk[0] có embedding xác định
        Then: embedding được lưu đúng, là list với 1536 dimensions
        """
        from sqlalchemy import select

        stmt = select(Chunk).where(Chunk.id == sample_chunks[0].id)
        chunk = db_session.execute(stmt).scalar_one()

        assert chunk.embedding is not None
        assert len(chunk.embedding) == 1536
        # chunk[0] high-relevance: giá trị đầu phải ~0.9
        assert chunk.embedding[0] == pytest.approx(0.9, abs=1e-6)

    def test_chunk_cascade_delete(
        self,
        db_session: Session,
        sample_document: Document,
        sample_chunks: list[Chunk],
    ):
        """
        Given: Document có 3 chunks
        When: Document bị xóa
        Then: tất cả chunks bị xóa (CASCADE DELETE)
        """
        from sqlalchemy import select

        doc_id = sample_document.id
        db_session.delete(sample_document)
        db_session.flush()

        stmt = select(Chunk).where(Chunk.document_id == doc_id)
        remaining = db_session.execute(stmt).scalars().all()
        assert len(remaining) == 0


class TestProblemFrameContradictionPersistence:
    """
    Kiểm tra ResearchSession → ProblemFrame → Contradiction chain.
    Trạng thái: GREEN.
    """

    def test_session_has_problem_frame(
        self,
        db_session: Session,
        sample_session: ResearchSession,
        sample_problem_frame: ProblemFrame,
    ):
        """
        Given: session có 1 problem_frame
        Then: session.problem_frames chứa đúng frame đó
        """
        db_session.refresh(sample_session)
        assert len(sample_session.problem_frames) == 1
        frame = sample_session.problem_frames[0]
        assert frame.improving_parameter == "speed"
        assert frame.worsening_parameter == "reliability"

    def test_contradiction_linked_to_frame(
        self,
        db_session: Session,
        sample_problem_frame: ProblemFrame,
        sample_contradiction,
    ):
        """
        Given: problem_frame có 1 contradiction
        Then: contradiction có suggested_principles hợp lệ (list[int])
        """
        db_session.refresh(sample_problem_frame)
        assert len(sample_problem_frame.contradictions) == 1
        c = sample_problem_frame.contradictions[0]
        assert c.suggested_principles is not None
        assert 10 in c.suggested_principles
        assert all(1 <= p <= 40 for p in c.suggested_principles)

    def test_frame_cascade_delete(
        self,
        db_session: Session,
        sample_session: ResearchSession,
        sample_problem_frame: ProblemFrame,
        sample_contradiction,
    ):
        """
        Given: session → frame → contradiction chain
        When: session bị xóa
        Then: frame và contradiction bị xóa theo (CASCADE)
        """
        from sqlalchemy import select
        from app.domain.models import Contradiction

        frame_id = sample_problem_frame.id
        contradiction_id = sample_contradiction.id

        db_session.delete(sample_session)
        db_session.flush()

        assert db_session.get(ProblemFrame, frame_id) is None
        assert db_session.get(Contradiction, contradiction_id) is None


class TestRetrievalServiceIT006:
    """
    IT-006: Retrieve evidence for contradiction.
    Trạng thái: RED — RetrievalService chưa được implement.

    Khi RetrievalService được implement tại app/services/retrieval_service.py,
    uncomment import ở đầu file và xóa pytest.skip() trong mỗi test.
    """

    def test_search_returns_results(
        self,
        db_session: Session,
        sample_chunks: list[Chunk],
        mock_openai_embedding,
    ):
        """
        Given: corpus có 3 chunks đã embed
        When: search("mâu thuẫn tốc độ độ tin cậy TRIZ", top_k=5)
        Then: ít nhất 1 kết quả được trả về
        """
        pytest.skip("RED: RetrievalService not implemented yet — Phase 2 Step 3")
        # service = RetrievalService(db_session)
        # results = service.search("mâu thuẫn tốc độ độ tin cậy TRIZ", top_k=5)
        # assert len(results) >= 1

    def test_search_results_have_required_fields(
        self,
        db_session: Session,
        sample_chunks: list[Chunk],
        mock_openai_embedding,
    ):
        """
        Given: corpus có chunks đã embed
        When: search() trả về kết quả
        Then: mỗi SearchResult phải có source_ref và excerpt không rỗng
        """
        pytest.skip("RED: RetrievalService not implemented yet — Phase 2 Step 3")
        # service = RetrievalService(db_session)
        # results = service.search("triz speed reliability", top_k=3)
        # for r in results:
        #     assert isinstance(r, SearchResult)
        #     assert r.source_ref != ""
        #     assert len(r.excerpt) > 0
        #     assert 0.0 <= r.score <= 1.0

    def test_search_results_sorted_by_score(
        self,
        db_session: Session,
        sample_chunks: list[Chunk],
        mock_openai_embedding,
    ):
        """
        Given: kết quả có nhiều hơn 1 item
        Then: score giảm dần (kết quả tốt nhất đứng đầu)
        """
        pytest.skip("RED: RetrievalService not implemented yet — Phase 2 Step 3")
        # service = RetrievalService(db_session)
        # results = service.search("triz", top_k=5)
        # scores = [r.score for r in results]
        # assert scores == sorted(scores, reverse=True)

    def test_search_metadata_includes_golden_flag(
        self,
        db_session: Session,
        sample_document: Document,
        sample_chunks: list[Chunk],
        mock_openai_embedding,
    ):
        """
        Given: sample_document.golden == True
        When: search trả về chunk từ document đó
        Then: result.metadata["golden"] == True
        """
        pytest.skip("RED: RetrievalService not implemented yet — Phase 2 Step 3")
        # service = RetrievalService(db_session)
        # results = service.search("mâu thuẫn", top_k=5)
        # hit = next((r for r in results if r.document_id == sample_document.id), None)
        # assert hit is not None
        # assert hit.metadata.get("golden") is True

    def test_search_empty_corpus_returns_empty_list(
        self,
        db_session: Session,
        mock_openai_embedding,
    ):
        """
        Given: corpus rỗng (không có fixtures)
        When: search() được gọi
        Then: trả về [] không raise exception
        """
        pytest.skip("RED: RetrievalService not implemented yet — Phase 2 Step 3")
        # service = RetrievalService(db_session)
        # results = service.search("bất kỳ truy vấn nào", top_k=5)
        # assert results == []

    def test_search_top_k_respected(
        self,
        db_session: Session,
        sample_chunks: list[Chunk],
        mock_openai_embedding,
    ):
        """
        Given: corpus có 3 chunks
        When: search(top_k=2)
        Then: trả về tối đa 2 kết quả
        """
        pytest.skip("RED: RetrievalService not implemented yet — Phase 2 Step 3")
        # service = RetrievalService(db_session)
        # results = service.search("triz", top_k=2)
        # assert len(results) <= 2
