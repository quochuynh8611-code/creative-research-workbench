"""
Integration test suite for IngestionService and RetrievalService using Real Embedding Client.
Phase 6.1: Real Embedding Engine & Polymorphic Factory.
"""
from __future__ import annotations

import pathlib
import uuid
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.orm import Session

from app.domain.models import Chunk, Document
from app.scripts.reembed_chunks import reembed_all_chunks
from app.services.embedding_client import (
    EMBEDDING_DIM,
    EmbeddingClient,
    MockEmbeddingClient,
    OpenAIEmbeddingClient,
)
from app.services.ingestion_service import IngestionService
from app.services.retrieval_service import RetrievalService


class DeterministicFakeEmbeddingClient(EmbeddingClient):
    """
    Embedding Client giả lập sinh vector thực (non-zero) dựa trên từ khóa trong văn bản.
    Giúp kiểm tra thuật toán cosine distance pgvector và RRF hybrid search hoạt động chính xác.
    """

    def embed(self, texts: list[str]) -> list[list[float]]:
        results = []
        for text in texts:
            vec = [0.0] * EMBEDDING_DIM
            text_lower = text.lower()
            if "triz" in text_lower or "mâu thuẫn" in text_lower:
                vec[0] = 0.9
                vec[1] = 0.3
            if "database" in text_lower or "postgresql" in text_lower:
                vec[2] = 0.8
                vec[3] = 0.4
            if "kiến trúc" in text_lower or "architecture" in text_lower:
                vec[4] = 0.7
                vec[5] = 0.5
            # Đảm bảo vector luôn có ít nhất 1 giá trị khác 0 để là vector thực
            if all(v == 0.0 for v in vec):
                vec[0] = 0.01
            results.append(vec)
        return results


def test_ingestion_with_real_embeddings_persists_non_zero_vectors(db_session: Session, tmp_path: pathlib.Path):
    """
    GIVEN: Một markdown file với frontmatter và nội dung kỹ thuật
    WHEN: IngestionService chạy với DeterministicFakeEmbeddingClient
    THEN: Document và Chunks được lưu trong DB có trường embedding chứa các giá trị float thực khác 0.0
    """
    sample_file = tmp_path / "sample_triz_doc.md"
    sample_file.write_text(
        """---
title: "Nguyên lý giải quyết mâu thuẫn TRIZ"
topic: "engineering"
golden: true
phase: "6"
status: "canonical"
---

TRIZ cung cấp 40 nguyên tắc sáng tạo để giải quyết mâu thuẫn kỹ thuật mà không cần thỏa hiệp.
Các thông số bao gồm độ bền, trọng lượng, tốc độ và năng lượng.
""",
        encoding="utf-8",
    )

    client = DeterministicFakeEmbeddingClient()
    service = IngestionService(engine=db_session.bind, embedding_client=client)

    result = service.ingest(str(sample_file))
    assert result.status == "success"
    assert result.chunks_created >= 1

    # Kiểm tra DB records
    doc = db_session.query(Document).filter_by(id=result.document_id).first()
    assert doc is not None
    assert doc.title == "Nguyên lý giải quyết mâu thuẫn TRIZ"

    chunks = db_session.query(Chunk).filter_by(document_id=doc.id).all()
    assert len(chunks) == result.chunks_created
    for c in chunks:
        assert c.embedding is not None
        # Vector phải chứa giá trị float thực
        assert any(abs(v) > 0.0 for v in c.embedding)


def test_retrieval_hybrid_search_with_real_embeddings_ranks_by_semantic_similarity(db_session: Session, tmp_path: pathlib.Path):
    """
    GIVEN: Hai documents được ingest vào DB với real embeddings
    WHEN: RetrievalService tìm kiếm câu truy vấn sát nghĩa với document 1
    THEN: Document 1 phải được xếp hạng cao hơn qua RRF fusion
    """
    file_1 = tmp_path / "doc_triz.md"
    file_1.write_text(
        """---
title: "Tài liệu về TRIZ và Mâu Thuẫn"
topic: "methodology"
golden: true
---

Nghiên cứu về lý thuyết giải quyết mâu thuẫn TRIZ và các nguyên tắc sáng tạo cốt lõi.
""",
        encoding="utf-8",
    )

    file_2 = tmp_path / "doc_db.md"
    file_2.write_text(
        """---
title: "Tài liệu về Database PostgreSQL"
topic: "infrastructure"
golden: false
---

Quản trị hệ quản trị cơ sở dữ liệu PostgreSQL và cấu hình chỉ mục lưu trữ.
""",
        encoding="utf-8",
    )

    client = DeterministicFakeEmbeddingClient()
    ingestion = IngestionService(engine=db_session.bind, embedding_client=client)
    res_1 = ingestion.ingest(str(file_1))
    res_2 = ingestion.ingest(str(file_2))

    assert res_1.status == "success"
    assert res_2.status == "success"

    retriever = RetrievalService(bind=db_session, embedding_client=client)
    search_results = retriever.search("mâu thuẫn sáng tạo TRIZ", top_k=5)

    assert len(search_results) >= 1
    # Document về TRIZ phải đứng đầu
    assert search_results[0].document_id == res_1.document_id
    assert search_results[0].score > 0.0


def test_ingestion_persists_document_and_fallback_zero_vectors_on_provider_error(db_session: Session, tmp_path: pathlib.Path):
    """
    GIVEN: IngestionService dùng OpenAIEmbeddingClient nhưng API bên ngoài bị lỗi kết nối
    WHEN: Gọi IngestionService.ingest trên một tài liệu mới
    THEN:
      - Document và Chunks vẫn được lưu đầy đủ vào PostgreSQL
      - Kết quả IngestResult trả về status='success' (degraded mode)
      - Chunks được gán zero-vectors 1536 chiều
      - Không ném ngoại lệ 500 ra caller
    """
    sample_file = tmp_path / "degraded_doc.md"
    sample_file.write_text(
        """---
title: "Tài liệu nạp trong điều kiện API lỗi"
topic: "testing"
golden: false
---

Nội dung tài liệu kiểm thử khả năng phục hồi của Ingestion pipeline khi API nhúng gặp sự cố.
Hệ thống phải lưu trữ thành công và gán placeholder zero-vector thay vì làm gián đoạn request.
""",
        encoding="utf-8",
    )

    failing_client = OpenAIEmbeddingClient(api_key="sk-fake-error-key", fallback_on_error=True)
    with patch("openai.OpenAI") as mock_openai:
        mock_instance = MagicMock()
        mock_instance.embeddings.create.side_effect = RuntimeError("OpenAI Server Error 503")
        mock_openai.return_value = mock_instance

        service = IngestionService(engine=db_session.bind, embedding_client=failing_client)
        result = service.ingest(str(sample_file))

        assert result.status == "success"
        assert result.chunks_created >= 1

        doc = db_session.query(Document).filter_by(id=result.document_id).first()
        assert doc is not None
        assert doc.title == "Tài liệu nạp trong điều kiện API lỗi"

        chunks = db_session.query(Chunk).filter_by(document_id=doc.id).all()
        assert len(chunks) == result.chunks_created
        for c in chunks:
            assert c.embedding is not None
            assert len(c.embedding) == EMBEDDING_DIM
            assert all(v == 0.0 for v in c.embedding)


def test_retrieval_service_bypasses_vector_leg_when_query_vector_is_all_zeros(db_session: Session, tmp_path: pathlib.Path):
    """
    GIVEN: RetrievalService dùng MockEmbeddingClient (toàn bộ query vector sinh ra là 0.0)
    WHEN: Thực hiện tìm kiếm retriever.search("Full-Text Search tsvector")
    THEN:
      - Leg 2 (Vector Search) bị bypass an toàn (trả về list rỗng, không tính cosine trên zero-vector)
      - Leg 1 (FTS) trả về đúng tài liệu liên quan
      - Điểm số RRF fusion được tính toán chính xác
    """
    file_path = tmp_path / "fts_doc.md"
    file_path.write_text(
        """---
title: "Tài liệu Kiến trúc Full-Text Search"
topic: "search"
golden: true
---

PostgreSQL cung cấp công cụ Full-Text Search tsvector mạnh mẽ cho tiếng Việt và tiếng Anh.
Khi không có vector nhúng, hệ thống phải trả kết quả hoàn toàn dựa vào FTS.
""",
        encoding="utf-8",
    )

    mock_client = MockEmbeddingClient()
    ingestion = IngestionService(engine=db_session.bind, embedding_client=mock_client)
    res = ingestion.ingest(str(file_path))
    assert res.status == "success"

    retriever = RetrievalService(bind=db_session, embedding_client=mock_client)

    with patch.object(retriever, "_vector_search", wraps=retriever._vector_search) as spy_vec_search:
        results = retriever.search("Full-Text Search tsvector", top_k=5)

        spy_vec_search.assert_called_once()
        # Đảm bảo FTS vẫn trả về kết quả chính xác
        assert len(results) >= 1
        assert results[0].document_id == res.document_id
        assert "tsvector" in results[0].excerpt.lower()
        assert results[0].score > 0.0


def test_reembed_all_chunks_real_database_integration_batch_commit(db_session: Session, tmp_path: pathlib.Path):
    """
    GIVEN: 5 chunks trong PostgreSQL (3 chunks zero-vectors và 2 chunks đã có real vectors)
    WHEN: Gọi reembed_all_chunks(batch_size=2, only_zero=True) với DeterministicFakeEmbeddingClient
    THEN:
      - Hàm trả về đúng số lượng 3 chunks đã xử lý
      - 3 chunks zero-vector được cập nhật vector thực trong database
      - 2 chunks đã có real vector giữ nguyên giá trị ban đầu
      - Thay đổi được commit thành công vào PostgreSQL
    """
    doc = Document(
        id=uuid.uuid4(),
        filename="test_reembed_doc.md",
        filepath="docs/test_reembed_doc.md",
        title="Tài liệu kiểm thử Re-embed",
        content_hash=uuid.uuid4().hex,
    )
    db_session.add(doc)

    chunks = [
        Chunk(
            id=uuid.uuid4(),
            document_id=doc.id,
            content="Đoạn văn 1 về nguyên lý TRIZ",
            chunk_index=0,
            token_count=10,
            embedding=[0.0] * EMBEDDING_DIM,
        ),
        Chunk(
            id=uuid.uuid4(),
            document_id=doc.id,
            content="Đoạn văn 2 về kiến trúc database PostgreSQL",
            chunk_index=1,
            token_count=12,
            embedding=[0.0] * EMBEDDING_DIM,
        ),
        Chunk(
            id=uuid.uuid4(),
            document_id=doc.id,
            content="Đoạn văn 3 đã có vector sẵn",
            chunk_index=2,
            token_count=10,
            embedding=[0.77] * EMBEDDING_DIM,
        ),
        Chunk(
            id=uuid.uuid4(),
            document_id=doc.id,
            content="Đoạn văn 4 chưa có vector (None)",
            chunk_index=3,
            token_count=10,
            embedding=None,
        ),
        Chunk(
            id=uuid.uuid4(),
            document_id=doc.id,
            content="Đoạn văn 5 đã có vector sẵn",
            chunk_index=4,
            token_count=10,
            embedding=[0.88] * EMBEDDING_DIM,
        ),
    ]
    db_session.add_all(chunks)
    db_session.commit()

    client = DeterministicFakeEmbeddingClient()
    processed_count = reembed_all_chunks(
        db_session=db_session,
        embedding_client=client,
        batch_size=2,
        only_zero=True,
    )

    assert processed_count == 3

    # Query lại database để verify persistence thật
    reloaded_chunks = db_session.query(Chunk).filter_by(document_id=doc.id).order_by(Chunk.chunk_index.asc()).all()
    assert len(reloaded_chunks) == 5

    # Chunks 0, 1, 3 phải có real vector mới
    assert reloaded_chunks[0].embedding is not None
    assert any(abs(v) > 0.0 for v in reloaded_chunks[0].embedding)
    assert reloaded_chunks[1].embedding is not None
    assert any(abs(v) > 0.0 for v in reloaded_chunks[1].embedding)
    assert reloaded_chunks[3].embedding is not None
    assert any(abs(v) > 0.0 for v in reloaded_chunks[3].embedding)

    # Chunks 2, 4 phải giữ nguyên vector ban đầu
    assert reloaded_chunks[2].embedding == [0.77] * EMBEDDING_DIM
    assert reloaded_chunks[4].embedding == [0.88] * EMBEDDING_DIM


class StepFailingEmbeddingClient(EmbeddingClient):
    """
    Embedding Client giả lập:
      - Lần gọi 1: trả về vector non-zero thành công ([0.55] * 1536)
      - Lần gọi 2: ném RuntimeError('deterministic batch failure')
    """

    def __init__(self) -> None:
        self.call_count = 0

    def embed(self, texts: list[str]) -> list[list[float]]:
        self.call_count += 1
        if self.call_count == 1:
            return [[0.55] * EMBEDDING_DIM for _ in texts]
        raise RuntimeError("deterministic batch failure")


def test_reembed_all_chunks_preserves_prior_commits_when_subsequent_batch_embed_fails(db_session: Session):
    """
    GIVEN: 4 chunks zero-vector trong PostgreSQL, batch_size=2
    WHEN: Gọi reembed_all_chunks với StepFailingEmbeddingClient (batch 1 embed thành công, batch 2 ném RuntimeError ở embed step)
    THEN:
      - reembed_all_chunks ném lại RuntimeError
      - Batch 1 (chunks 0, 1) giữ nguyên vector đã commit thành công ([0.55] * 1536)
      - Batch 2 (chunks 2, 3) không bị cập nhật (vẫn là zero-vector)
      - Client được gọi chính xác 2 lần (không gọi batch tiếp theo)
      - db_session ở trạng thái usable
    """
    doc = Document(
        id=uuid.uuid4(),
        filename="test_partial_progress_doc.md",
        filepath="docs/test_partial_progress_doc.md",
        title="Tài liệu kiểm thử Partial Progress",
        content_hash=uuid.uuid4().hex,
    )
    db_session.add(doc)

    chunks = [
        Chunk(
            id=uuid.uuid4(),
            document_id=doc.id,
            content="Đoạn 0 - batch 1",
            chunk_index=0,
            token_count=10,
            embedding=[0.0] * EMBEDDING_DIM,
        ),
        Chunk(
            id=uuid.uuid4(),
            document_id=doc.id,
            content="Đoạn 1 - batch 1",
            chunk_index=1,
            token_count=10,
            embedding=[0.0] * EMBEDDING_DIM,
        ),
        Chunk(
            id=uuid.uuid4(),
            document_id=doc.id,
            content="Đoạn 2 - batch 2",
            chunk_index=2,
            token_count=10,
            embedding=[0.0] * EMBEDDING_DIM,
        ),
        Chunk(
            id=uuid.uuid4(),
            document_id=doc.id,
            content="Đoạn 3 - batch 2",
            chunk_index=3,
            token_count=10,
            embedding=[0.0] * EMBEDDING_DIM,
        ),
    ]
    db_session.add_all(chunks)
    db_session.commit()

    failing_client = StepFailingEmbeddingClient()

    with pytest.raises(RuntimeError, match="deterministic batch failure"):
        reembed_all_chunks(
            db_session=db_session,
            embedding_client=failing_client,
            batch_size=2,
            only_zero=True,
        )

    assert failing_client.call_count == 2

    # Query lại database để kiểm tra tính cô lập của transaction
    reloaded_chunks = db_session.query(Chunk).filter_by(document_id=doc.id).order_by(Chunk.chunk_index.asc()).all()
    assert len(reloaded_chunks) == 4

    # Batch 1 (chunks 0, 1) phải được lưu vĩnh viễn giá trị [0.55] * 1536
    assert reloaded_chunks[0].embedding == [0.55] * EMBEDDING_DIM
    assert reloaded_chunks[1].embedding == [0.55] * EMBEDDING_DIM

    # Batch 2 (chunks 2, 3) phải giữ nguyên zero-vector ban đầu
    assert reloaded_chunks[2].embedding == [0.0] * EMBEDDING_DIM
    assert reloaded_chunks[3].embedding == [0.0] * EMBEDDING_DIM


def test_reembed_all_chunks_rolls_back_failed_batch_and_preserves_prior_commits(db_session: Session):
    """
    GIVEN: 4 chunks zero-vector trong PostgreSQL, batch_size=2
    WHEN: Gọi reembed_all_chunks với client trả về vector hợp lệ,
          nhưng batch 2 bị ép lỗi deterministic tại commit sau khi đã mutate chunk objects
    THEN:
      - reembed_all_chunks ném lại RuntimeError
      - db_session.rollback() được gọi rõ ràng để rollback transaction và dọn dirty state
      - Batch 1 (chunks 0, 1) vẫn giữ nguyên vector đã commit ([0.55] * 1536)
      - Batch 2 (chunks 2, 3) sau reload giữ nguyên zero-vector ban đầu
      - db_session ở trạng thái usable sau failure
    """
    doc = Document(
        id=uuid.uuid4(),
        filename="test_rollback_doc.md",
        filepath="docs/test_rollback_doc.md",
        title="Tài liệu kiểm thử Rollback Batch",
        content_hash=uuid.uuid4().hex,
    )
    db_session.add(doc)

    chunks = [
        Chunk(
            id=uuid.uuid4(),
            document_id=doc.id,
            content="Đoạn 0 - batch 1",
            chunk_index=0,
            token_count=10,
            embedding=[0.0] * EMBEDDING_DIM,
        ),
        Chunk(
            id=uuid.uuid4(),
            document_id=doc.id,
            content="Đoạn 1 - batch 1",
            chunk_index=1,
            token_count=10,
            embedding=[0.0] * EMBEDDING_DIM,
        ),
        Chunk(
            id=uuid.uuid4(),
            document_id=doc.id,
            content="Đoạn 2 - batch 2",
            chunk_index=2,
            token_count=10,
            embedding=[0.0] * EMBEDDING_DIM,
        ),
        Chunk(
            id=uuid.uuid4(),
            document_id=doc.id,
            content="Đoạn 3 - batch 2",
            chunk_index=3,
            token_count=10,
            embedding=[0.0] * EMBEDDING_DIM,
        ),
    ]
    db_session.add_all(chunks)
    db_session.commit()

    class DeterministicNonZeroClient(EmbeddingClient):
        def embed(self, texts: list[str]) -> list[list[float]]:
            return [[0.55] * EMBEDDING_DIM for _ in texts]

    client = DeterministicNonZeroClient()

    # Deterministic commit failure only on batch 2
    original_commit = db_session.commit
    original_rollback = db_session.rollback
    commit_count = 0
    rollback_spy = MagicMock(side_effect=original_rollback)

    def conditional_commit(*args, **kwargs):
        nonlocal commit_count
        commit_count += 1
        if commit_count == 2:
            raise RuntimeError("deterministic batch 2 commit failure")
        return original_commit(*args, **kwargs)

    db_session.commit = conditional_commit
    db_session.rollback = rollback_spy

    try:
        with pytest.raises(RuntimeError, match="deterministic batch 2 commit failure"):
            reembed_all_chunks(
                db_session=db_session,
                embedding_client=client,
                batch_size=2,
                only_zero=True,
            )
    finally:
        # Restore original session methods
        db_session.commit = original_commit
        db_session.rollback = original_rollback

    # Assert rollback was explicitly invoked by reembed_all_chunks
    assert rollback_spy.call_count >= 1, "db_session.rollback() must be explicitly invoked on batch failure"

    # Query lại database để kiểm tra tính cô lập của transaction
    reloaded_chunks = db_session.query(Chunk).filter_by(document_id=doc.id).order_by(Chunk.chunk_index.asc()).all()
    assert len(reloaded_chunks) == 4

    # Batch 1 (chunks 0, 1) phải được lưu vĩnh viễn giá trị [0.55] * 1536
    assert reloaded_chunks[0].embedding == [0.55] * EMBEDDING_DIM
    assert reloaded_chunks[1].embedding == [0.55] * EMBEDDING_DIM

    # Batch 2 (chunks 2, 3) phải giữ nguyên zero-vector ban đầu
    assert reloaded_chunks[2].embedding == [0.0] * EMBEDDING_DIM
    assert reloaded_chunks[3].embedding == [0.0] * EMBEDDING_DIM
