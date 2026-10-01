"""
Integration test suite for IngestionService and RetrievalService using Real Embedding Client.
Phase 6.1: Real Embedding Engine & Polymorphic Factory.
"""
from __future__ import annotations

import pathlib
import pytest
from sqlalchemy.orm import Session

from app.domain.models import Chunk, Document
from app.services.embedding_client import EmbeddingClient, EMBEDDING_DIM
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
