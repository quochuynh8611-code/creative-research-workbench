"""
test_knowledge_base_execution.py — Integration test suite cho Phase 8 Knowledge Base Execution

Covering 5 Core Execution Scenarios:
  - Scenario 1: Upload a new document (POST /upload -> chunks created & embedded, indexed for search)
  - Scenario 2: Update an existing document (PUT /{id} -> re-chunk, re-embed, search index updated)
  - Scenario 3: Delete an existing document (DELETE /{id} -> document + chunks deleted, 403 on golden)
  - Scenario 4: Search after upload (document content retrieved via POST /search with correct source_ref)
  - Scenario 5: Idempotent re-upload (content_hash match returns already_exists)
"""
from __future__ import annotations

import io
import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.orm import Session

from app.api.v1.endpoints.search import get_db as get_search_db, get_retrieval_service
from app.api.v1.endpoints.sessions import get_db as get_sessions_db
from app.domain.models import Chunk, Document, DocumentStatus
from app.main import app
from app.services.retrieval_service import RetrievalService


@pytest.fixture(autouse=True)
def override_db_dependency(db_session: Session):
    """Override dependencies to use test db_session."""
    app.dependency_overrides[get_sessions_db] = lambda: db_session
    app.dependency_overrides[get_search_db] = lambda: db_session
    app.dependency_overrides[get_retrieval_service] = lambda: RetrievalService(bind=db_session)
    yield
    app.dependency_overrides.pop(get_sessions_db, None)
    app.dependency_overrides.pop(get_search_db, None)
    app.dependency_overrides.pop(get_retrieval_service, None)


@pytest.mark.asyncio
async def test_scenario_1_upload_new_document_creates_chunks_and_embeddings(db_session: Session):
    """
    Scenario 1: Upload a new document
    GIVEN: Một file markdown hợp lệ có frontmatter
    WHEN: Gọi POST /api/v1/documents/upload
    THEN: Response trả về 200 OK, status='success', tạo document và chunks có embedding vector 1536 dim
    """
    content = b"""---
title: "Nghien cuu dong co dien"
topic: "automotive"
source_type: "paper"
language: "vi"
tags: ["motor", "ev"]
phase: "1"
status: "draft"
golden: false
---

# Dong Co Dien Khong Choi Than
Dong co BLDC giup toi uu hieu suat nang luong va tang do ben cho xe dien.
He thong dieu khien vector FOC mang lai do em ai cao khi van hanh.
"""
    files = {"file": ("bldc_motor.md", io.BytesIO(content), "text/markdown")}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/documents/upload", files=files)

    assert response.status_code == 200
    payload = response.json()
    assert payload["data"]["status"] == "success"
    doc_id_str = payload["data"]["document_id"]
    assert doc_id_str is not None
    doc_id = uuid.UUID(doc_id_str)

    # Verify document trong DB
    doc = db_session.get(Document, doc_id)
    assert doc is not None
    assert doc.title == "Nghien cuu dong co dien"
    assert doc.topic == "automotive"
    assert doc.golden is False

    # Verify chunks & embeddings
    chunks = db_session.query(Chunk).filter_by(document_id=doc_id).all()
    assert len(chunks) >= 1
    for chunk in chunks:
        assert chunk.embedding is not None
        assert len(chunk.embedding) == 1536


@pytest.mark.asyncio
async def test_scenario_2_update_existing_document_rechunks_and_reembeds(db_session: Session):
    """
    Scenario 2: Update an existing document
    GIVEN: Một document đã tồn tại trong hệ thống (golden=False) kèm chunks ban đầu
    WHEN: Gọi PUT /api/v1/documents/{id} với nội dung mới
    THEN: Chunks cũ bị xóa, chunks mới được tạo kèm embedding 1536 dim, metadata cập nhật
    AND: Thử update trên golden document thì bị chặn với HTTP 403
    """
    doc_id = uuid.uuid4()
    old_doc = Document(
        id=doc_id,
        filename="system_design.md",
        filepath="docs/system_design.md",
        title="Thiet ke he thong ban dau",
        topic="architecture",
        source_type="spec",
        language="vi",
        tags=["arch"],
        phase="1",
        status=DocumentStatus.draft,
        golden=False,
        content_hash="old_system_design_hash_123",
    )
    old_chunk = Chunk(
        id=uuid.uuid4(),
        document_id=doc_id,
        content="Noi dung kien truc he thong cu",
        chunk_index=0,
        token_count=10,
        embedding=[0.0] * 1536,
    )
    old_chunk_id = old_chunk.id
    db_session.add_all([old_doc, old_chunk])
    db_session.commit()

    update_payload = {
        "title": "Thiet ke kien truc cap nhat v2",
        "topic": "system-architecture",
        "tags": ["arch", "v2", "scalability"],
        "content": """---
title: "Kien truc Microservices v2"
topic: "system-architecture"
---

# Kien truc He thong Phien ban 2
Day la phan mo dau ve kien truc moi tich hop message queue va event-driven.

He thong ho tro scale ngang doc lap cho tung service va dam bao SLA cao.
""",
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.put(f"/api/v1/documents/{doc_id}", json=update_payload)

    assert response.status_code == 200
    res_data = response.json()["data"]
    assert res_data["id"] == str(doc_id)
    assert res_data["title"] == "Thiet ke kien truc cap nhat v2"
    assert res_data["topic"] == "system-architecture"

    # Verify trong DB
    updated_doc = db_session.get(Document, doc_id)
    assert updated_doc is not None
    assert updated_doc.title == "Thiet ke kien truc cap nhat v2"
    assert updated_doc.content_hash != "old_system_design_hash_123"

    # Chunks cũ phải bị xóa sạch, chunks mới được tạo
    new_chunks = (
        db_session.query(Chunk)
        .filter_by(document_id=doc_id)
        .order_by(Chunk.chunk_index.asc())
        .all()
    )
    assert len(new_chunks) >= 1
    assert old_chunk_id not in [c.id for c in new_chunks]
    assert db_session.get(Chunk, old_chunk_id) is None
    for c in new_chunks:
        assert c.embedding is not None
        assert len(c.embedding) == 1536

    # Test Golden Guard: Document golden không cho phép update qua API
    golden_doc = Document(
        id=uuid.uuid4(),
        filename="golden_rule.md",
        filepath="docs/golden_rule.md",
        title="Quy tac chuan",
        golden=True,
        status=DocumentStatus.canonical,
        content_hash="golden_rule_hash_456",
    )
    db_session.add(golden_doc)
    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        golden_res = await client.put(
            f"/api/v1/documents/{golden_doc.id}",
            json={"content": "Noi dung muon sua cua golden document"},
        )
    assert golden_res.status_code == 403
    assert "Golden" in golden_res.json()["detail"]


@pytest.mark.asyncio
async def test_scenario_3_delete_document_and_cascade_chunks(db_session: Session):
    """
    Scenario 3: Delete an existing document
    GIVEN: Document thường kèm 2 chunks, và Document golden
    WHEN: Gọi DELETE /api/v1/documents/{id}
    THEN: Document thường bị xóa sạch cùng chunks; Document golden bị chặn 403 và dữ liệu còn nguyên
    """
    doc_id = uuid.uuid4()
    doc = Document(
        id=doc_id,
        filename="to_delete_lifecycle.md",
        filepath="docs/to_delete_lifecycle.md",
        title="Tai lieu xoa lifecycle",
        golden=False,
        status=DocumentStatus.draft,
        content_hash="lifecycle_delete_hash_789",
    )
    c1 = Chunk(id=uuid.uuid4(), document_id=doc_id, content="c1", chunk_index=0, token_count=5, embedding=[0.0]*1536)
    c2 = Chunk(id=uuid.uuid4(), document_id=doc_id, content="c2", chunk_index=1, token_count=5, embedding=[0.0]*1536)
    db_session.add_all([doc, c1, c2])

    golden_id = uuid.uuid4()
    golden_doc = Document(
        id=golden_id,
        filename="golden_triz.md",
        filepath="docs/golden_triz.md",
        title="TRIZ Core Principles",
        golden=True,
        status=DocumentStatus.canonical,
        content_hash="golden_triz_hash_999",
    )
    db_session.add(golden_doc)
    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Xóa doc thường -> 200 OK
        del_res = await client.delete(f"/api/v1/documents/{doc_id}")
        assert del_res.status_code == 200
        assert del_res.json()["status"] == "deleted"

        # Thử xóa golden -> 403 Forbidden
        golden_del_res = await client.delete(f"/api/v1/documents/{golden_id}")
        assert golden_del_res.status_code == 403

    # Kiểm tra DB
    assert db_session.get(Document, doc_id) is None
    assert db_session.query(Chunk).filter_by(document_id=doc_id).count() == 0
    assert db_session.get(Document, golden_id) is not None


@pytest.mark.asyncio
async def test_scenario_4_search_after_upload(db_session: Session):
    """
    Scenario 4: Search after upload
    GIVEN: Upload 1 tài liệu có từ khóa độc nhất
    WHEN: Gọi POST /api/v1/search tìm kiếm từ khóa đó
    THEN: Tài liệu vừa upload được tìm thấy với source_ref chính xác
    """
    unique_keyword = f"quasiparticle_phonons_{uuid.uuid4().hex[:8]}"
    content = f"""---
title: "Vat ly chat ran nang cao"
topic: "physics"
---

# Nghien cuu Vat ly
Phat hien moi ve hieu ung {unique_keyword} trong vat lieu ban dan the he moi.
""".encode("utf-8")

    files = {"file": ("solid_state_physics.md", io.BytesIO(content), "text/markdown")}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        upload_res = await client.post("/api/v1/documents/upload", files=files)
        assert upload_res.status_code == 200

        search_res = await client.post(
            "/api/v1/search",
            json={"query": unique_keyword, "top_k": 5},
        )

    assert search_res.status_code == 200
    search_data = search_res.json()
    assert len(search_data["results"]) >= 1
    top_hit = search_data["results"][0]
    assert unique_keyword in top_hit["excerpt"]
    assert "solid_state_physics.md" in top_hit["source_ref"]


@pytest.mark.asyncio
async def test_scenario_5_idempotent_reupload_returns_already_exists(db_session: Session):
    """
    Scenario 5: Idempotent re-upload
    GIVEN: Một tài liệu đã được nạp thành công
    WHEN: Upload lại file với nội dung chính xác tương tự (trùng SHA-256)
    THEN: Trả về status 'already_exists' kèm document_id ban đầu, không tạo thêm bản ghi
    """
    content = b"""---
title: "Tai lieu Idempotent"
topic: "idempotency"
---

Noi dung kiem tra tinh idempotent cua upload endpoint.
"""
    files1 = {"file": ("idempotent_doc.md", io.BytesIO(content), "text/markdown")}
    files2 = {"file": ("idempotent_doc_copy.md", io.BytesIO(content), "text/markdown")}

    doc_count_before = db_session.query(Document).count()
    chunk_count_before = db_session.query(Chunk).count()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res1 = await client.post("/api/v1/documents/upload", files=files1)
        assert res1.status_code == 200
        first_doc_id = res1.json()["data"]["document_id"]

        res2 = await client.post("/api/v1/documents/upload", files=files2)
        assert res2.status_code == 200

    data2 = res2.json()["data"]
    assert data2["status"] == "already_exists"
    assert data2["document_id"] == first_doc_id

    # Chỉ có đúng 1 document mới và chunks tương ứng được thêm vào
    assert db_session.query(Document).count() == doc_count_before + 1
    assert db_session.query(Chunk).filter_by(document_id=uuid.UUID(first_doc_id)).count() >= 1
