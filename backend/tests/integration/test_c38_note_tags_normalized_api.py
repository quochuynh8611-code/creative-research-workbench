"""test_c38_note_tags_normalized_api.py — Integration tests cho C38-GAP-01: Per-Note Tagging (Phương án B: Bảng tags + note_tags).

Kiến trúc chuẩn hóa (Normalized Tagging Architecture):
  - Bảng tags: id, canonical_slug (unique, max 50), display_label (max 100), created_at.
  - Bảng note_tags: note_id (FK), tag_id (FK), created_at. Unique(note_id, tag_id).
  - Không dùng ARRAY(String).
  - Zero hard-delete trên bảng tags khi note bị xóa (chỉ xóa association trong note_tags).
  - Endpoints:
      - POST /api/v1/sessions/{session_id}/notes (with tags: list[str])
      - GET /api/v1/sessions/{session_id}/notes (?tag=...)
      - GET /api/v1/sessions/{session_id}/export (JSON and Markdown include tags)
"""
from __future__ import annotations

import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.domain.models import ResearchNote, ResearchSession, SessionStatus
from app.main import app


@pytest.fixture(autouse=True)
def override_db_dependency(db_session: Session):
    """Dependency override cho get_db."""
    try:
        from app.api.v1.endpoints.sessions import get_db
        app.dependency_overrides[get_db] = lambda: db_session
        yield
        app.dependency_overrides.pop(get_db, None)
    except ImportError:
        yield


@pytest.mark.asyncio
async def test_create_note_with_normalized_tags_and_deduplication(db_session: Session):
    """
    GIVEN: Một session hợp lệ
    WHEN: Gửi POST note với tags chứa chữ hoa, khoảng trắng và trùng lặp
    THEN:
      1. API trả về mảng tags đã chuẩn hóa (lowercase, trimmed, deduplicated)
      2. Bảng 'tags' chứa các bản ghi canonical_slug duy nhất
      3. Bảng 'note_tags' chứa các bản ghi liên kết giữa note_id và tag_id
    """
    session = ResearchSession(
        title="Session Test Normalized Tagging",
        status=SessionStatus.active,
        workflow_state="structuring",
    )
    db_session.add(session)
    db_session.flush()

    payload = {
        "content": "Ghi chú về pin graphene và phân tán nhiệt",
        "note_type": "insight",
        "tags": [" Battery ", "battery", "THERMAL", "cooling", "thermal "],
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(f"/api/v1/sessions/{session.id}/notes", json=payload)
        assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
        data = res.json()
        assert "data" in data or "id" in data
        note_data = data.get("data", data)
        assert note_data["content"] == payload["content"]
        assert "tags" in note_data
        assert note_data["tags"] == ["battery", "thermal", "cooling"]
        note_id = note_data["id"]

    # Kiểm tra trực tiếp bảng tags và note_tags trong DB
    tags_in_db = db_session.execute(
        text("SELECT canonical_slug FROM tags ORDER BY canonical_slug")
    ).scalars().all()
    assert "battery" in tags_in_db
    assert "thermal" in tags_in_db
    assert "cooling" in tags_in_db

    associations = db_session.execute(
        text("SELECT COUNT(*) FROM note_tags WHERE note_id = :note_id"),
        {"note_id": note_id},
    ).scalar()
    assert associations == 3


@pytest.mark.asyncio
async def test_multiple_notes_reuse_same_canonical_tag(db_session: Session):
    """
    GIVEN: Hai notes khác nhau được tạo với cùng một tag 'triz'
    WHEN: Cả 2 notes được lưu
    THEN:
      1. Bảng 'tags' chỉ có đúng 1 bản ghi canonical_slug = 'triz'
      2. Bảng 'note_tags' có 2 bản ghi liên kết tới cùng tag_id đó
    """
    session = ResearchSession(
        title="Session Shared Tag",
        status=SessionStatus.active,
        workflow_state="structuring",
    )
    db_session.add(session)
    db_session.flush()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res1 = await client.post(
            f"/api/v1/sessions/{session.id}/notes",
            json={"content": "Note 1 về triz", "note_type": "insight", "tags": ["triz", "method"]},
        )
        assert res1.status_code == 201
        res2 = await client.post(
            f"/api/v1/sessions/{session.id}/notes",
            json={"content": "Note 2 về triz", "note_type": "hypothesis", "tags": ["TRIZ", "innovation"]},
        )
        assert res2.status_code == 201

    # Bảng tags chỉ có đúng 1 bản ghi 'triz'
    triz_count = db_session.execute(
        text("SELECT COUNT(*) FROM tags WHERE canonical_slug = 'triz'")
    ).scalar()
    assert triz_count == 1

    # Bảng note_tags có 2 bản ghi liên kết tới tag 'triz'
    tag_id = db_session.execute(
        text("SELECT id FROM tags WHERE canonical_slug = 'triz'")
    ).scalar()
    assoc_count = db_session.execute(
        text("SELECT COUNT(*) FROM note_tags WHERE tag_id = :tag_id"),
        {"tag_id": tag_id},
    ).scalar()
    assert assoc_count == 2


@pytest.mark.asyncio
async def test_validation_rejects_more_than_10_tags_or_tag_over_50_chars(db_session: Session):
    """
    GIVEN: Session hợp lệ
    WHEN:
      1. Gửi note có > 10 tags
      2. Gửi note có tag dài > 50 ký tự
    THEN: API từ chối với status 422 Unprocessable Entity
    """
    session = ResearchSession(
        title="Session Validation",
        status=SessionStatus.active,
        workflow_state="structuring",
    )
    db_session.add(session)
    db_session.flush()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Trường hợp 1: > 10 tags
        too_many_tags = [f"tag-{i}" for i in range(11)]
        res1 = await client.post(
            f"/api/v1/sessions/{session.id}/notes",
            json={"content": "Note quá nhiều tags", "tags": too_many_tags},
        )
        assert res1.status_code == 422

        # Trường hợp 2: tag dài > 50 ký tự
        long_tag = "a" * 51
        res2 = await client.post(
            f"/api/v1/sessions/{session.id}/notes",
            json={"content": "Note tag quá dài", "tags": [long_tag]},
        )
        assert res2.status_code == 422


@pytest.mark.asyncio
async def test_delete_note_removes_association_but_preserves_canonical_tag(db_session: Session):
    """
    GIVEN: Một note có tag 'preserved-tag'
    WHEN: Gọi DELETE note
    THEN:
      1. Association trong note_tags bị xóa (CASCADE)
      2. Bản ghi 'preserved-tag' trong bảng tags vẫn TỒN TẠI (zero hard-delete)
    """
    session = ResearchSession(
        title="Session Delete Note Guard",
        status=SessionStatus.active,
        workflow_state="structuring",
    )
    db_session.add(session)
    db_session.flush()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        create_res = await client.post(
            f"/api/v1/sessions/{session.id}/notes",
            json={"content": "Note to be deleted", "tags": ["preserved-tag"]},
        )
        assert create_res.status_code == 201
        note_id = create_res.json().get("data", create_res.json())["id"]

        del_res = await client.delete(f"/api/v1/sessions/{session.id}/notes/{note_id}")
        assert del_res.status_code == 200

    # Association trong note_tags bị xóa
    assoc = db_session.execute(
        text("SELECT COUNT(*) FROM note_tags WHERE note_id = :note_id"),
        {"note_id": note_id},
    ).scalar()
    assert assoc == 0

    # Tag trong bảng tags VẪN TỒN TẠI
    tag_count = db_session.execute(
        text("SELECT COUNT(*) FROM tags WHERE canonical_slug = 'preserved-tag'")
    ).scalar()
    assert tag_count == 1


@pytest.mark.asyncio
async def test_filter_notes_by_tag(db_session: Session):
    """
    GIVEN: Hai notes có tags khác nhau ('ai' và 'hardware')
    WHEN: Gọi GET /api/v1/sessions/{session_id}/notes?tag=ai
    THEN: Chỉ trả về note có tag 'ai'
    """
    session = ResearchSession(
        title="Session Filter By Tag",
        status=SessionStatus.active,
        workflow_state="structuring",
    )
    db_session.add(session)
    db_session.flush()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post(
            f"/api/v1/sessions/{session.id}/notes",
            json={"content": "Mô hình ngôn ngữ lớn", "tags": ["ai", "nlp"]},
        )
        await client.post(
            f"/api/v1/sessions/{session.id}/notes",
            json={"content": "Cảm biến nhiệt độ", "tags": ["hardware", "iot"]},
        )

        res = await client.get(f"/api/v1/sessions/{session.id}/notes?tag=ai")
        assert res.status_code == 200
        data = res.json()
        notes = data.get("data", data)
        assert len(notes) == 1
        assert notes[0]["content"] == "Mô hình ngôn ngữ lớn"
        assert "ai" in notes[0]["tags"]


@pytest.mark.asyncio
async def test_remove_tag_association_preserves_canonical_tag_and_note(db_session: Session):
    """
    GIVEN:
      - Note 1 có 2 tags: 'battery' và 'thermal'
      - Note 2 cũng có tag: 'battery'
    WHEN:
      - Gọi DELETE /api/v1/sessions/{session_id}/notes/{note_id}/tags/battery
    THEN:
      1. API trả về status 200 kèm danh sách tags còn lại của Note 1 là ['thermal']
      2. Liên kết giữa Note 1 và 'battery' trong bảng note_tags bị xóa
      3. Liên kết giữa Note 1 và 'thermal' vẫn còn nguyên
      4. Note 1 vẫn tồn tại nguyên vẹn trong DB
      5. Canonical tag 'battery' vẫn TỒN TẠI trong bảng tags (zero hard-delete)
      6. Note 2 vẫn giữ nguyên liên kết với 'battery'
    """
    session = ResearchSession(
        title="Session Remove Tag Association",
        status=SessionStatus.active,
        workflow_state="structuring",
    )
    db_session.add(session)
    db_session.flush()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Tạo note 1 với 2 tags
        res1 = await client.post(
            f"/api/v1/sessions/{session.id}/notes",
            json={"content": "Note 1 pin nhiệt", "tags": ["battery", "thermal"]},
        )
        assert res1.status_code == 201
        note1_id = res1.json().get("data", res1.json())["id"]

        # Tạo note 2 dùng chung tag 'battery'
        res2 = await client.post(
            f"/api/v1/sessions/{session.id}/notes",
            json={"content": "Note 2 pin dung lượng", "tags": ["battery", "capacity"]},
        )
        assert res2.status_code == 201
        note2_id = res2.json().get("data", res2.json())["id"]

        # Gọi DELETE gỡ tag 'battery' khỏi Note 1
        del_tag_res = await client.delete(
            f"/api/v1/sessions/{session.id}/notes/{note1_id}/tags/battery"
        )
        assert del_tag_res.status_code == 200, f"Expected 200, got {del_tag_res.status_code}: {del_tag_res.text}"
        data = del_tag_res.json()
        note_data = data.get("data", data)
        assert "tags" in note_data
        assert note_data["tags"] == ["thermal"]
        assert note_data["id"] == note1_id

    # 1. Bảng note_tags cho note1 chỉ còn đúng 1 liên kết ('thermal')
    note1_assocs = db_session.execute(
        text("SELECT COUNT(*) FROM note_tags WHERE note_id = :nid"),
        {"nid": note1_id},
    ).scalar()
    assert note1_assocs == 1

    # 2. Canonical tag 'battery' VẪN TỒN TẠI trong bảng tags
    battery_tag = db_session.execute(
        text("SELECT id FROM tags WHERE canonical_slug = 'battery'")
    ).scalar()
    assert battery_tag is not None

    # 3. Note 1 vẫn tồn tại nguyên vẹn
    note1_in_db = db_session.query(ResearchNote).filter_by(id=uuid.UUID(note1_id)).first()
    assert note1_in_db is not None
    assert note1_in_db.content == "Note 1 pin nhiệt"

    # 4. Note 2 vẫn giữ nguyên liên kết với 'battery'
    note2_battery_assoc = db_session.execute(
        text("SELECT COUNT(*) FROM note_tags WHERE note_id = :nid AND tag_id = :tid"),
        {"nid": note2_id, "tid": battery_tag},
    ).scalar()
    assert note2_battery_assoc == 1


@pytest.mark.asyncio
async def test_remove_tag_association_updates_filtering(db_session: Session):
    """
    GIVEN: Note có tag 'ai'
    WHEN:
      1. GET notes?tag=ai -> trả về note
      2. DELETE note's tag 'ai'
      3. GET notes?tag=ai -> không còn trả về note này
    """
    session = ResearchSession(
        title="Session Filter Update On Tag Remove",
        status=SessionStatus.active,
        workflow_state="structuring",
    )
    db_session.add(session)
    db_session.flush()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            f"/api/v1/sessions/{session.id}/notes",
            json={"content": "Thuật toán học sâu", "tags": ["ai", "deep-learning"]},
        )
        assert res.status_code == 201
        note_id = res.json().get("data", res.json())["id"]

        # Filter trước khi remove
        filter1 = await client.get(f"/api/v1/sessions/{session.id}/notes?tag=ai")
        assert filter1.status_code == 200
        notes1 = filter1.json().get("data", filter1.json())
        assert len(notes1) == 1

        # Remove tag 'ai'
        del_res = await client.delete(f"/api/v1/sessions/{session.id}/notes/{note_id}/tags/ai")
        assert del_res.status_code == 200

        # Filter sau khi remove
        filter2 = await client.get(f"/api/v1/sessions/{session.id}/notes?tag=ai")
        assert filter2.status_code == 200
        notes2 = filter2.json().get("data", filter2.json())
        assert len(notes2) == 0


@pytest.mark.asyncio
async def test_update_note_tags_syncs_associations_and_preserves_canonical(db_session: Session):
    """
    GIVEN: Note có tags: ['keep', 'remove-me']
    WHEN: Gọi PUT /api/v1/sessions/{session_id}/notes/{note_id}/tags với body {'tags': ['keep', 'brand-new']}
    THEN:
      1. Tags của note được cập nhật thành ['keep', 'brand-new']
      2. Liên kết cho 'remove-me' bị xóa khỏi note_tags
      3. Liên kết cho 'brand-new' được thêm vào note_tags
      4. Tag 'remove-me' vẫn TỒN TẠI trong bảng tags (zero hard-delete)
    """
    session = ResearchSession(
        title="Session Update Note Tags",
        status=SessionStatus.active,
        workflow_state="structuring",
    )
    db_session.add(session)
    db_session.flush()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            f"/api/v1/sessions/{session.id}/notes",
            json={"content": "Ghi chú cập nhật tags", "tags": ["keep", "remove-me"]},
        )
        assert res.status_code == 201
        note_id = res.json().get("data", res.json())["id"]

        # Gọi PUT cập nhật tags
        put_res = await client.put(
            f"/api/v1/sessions/{session.id}/notes/{note_id}/tags",
            json={"tags": ["keep", "brand-new"]},
        )
        assert put_res.status_code == 200, f"Expected 200, got {put_res.status_code}: {put_res.text}"
        data = put_res.json()
        note_data = data.get("data", data)
        assert sorted(note_data["tags"]) == sorted(["keep", "brand-new"])

    # Kiểm tra tag 'remove-me' vẫn tồn tại trong bảng tags
    old_tag = db_session.execute(
        text("SELECT canonical_slug FROM tags WHERE canonical_slug = 'remove-me'")
    ).scalar()
    assert old_tag == "remove-me"

    # Kiểm tra liên kết note_tags
    current_slugs = db_session.execute(
        text("""
            SELECT t.canonical_slug 
            FROM tags t
            JOIN note_tags nt ON t.id = nt.tag_id
            WHERE nt.note_id = :nid
            ORDER BY t.canonical_slug
        """),
        {"nid": note_id},
    ).scalars().all()
    assert current_slugs == ["brand-new", "keep"]


@pytest.mark.asyncio
async def test_remove_nonexistent_tag_returns_404(db_session: Session):
    """
    GIVEN: Note chỉ có tag 'real-tag'
    WHEN: Gọi DELETE /api/v1/sessions/{session_id}/notes/{note_id}/tags/ghost-tag
    THEN: API trả về 404 Not Found
    """
    session = ResearchSession(
        title="Session 404 Tag",
        status=SessionStatus.active,
        workflow_state="structuring",
    )
    db_session.add(session)
    db_session.flush()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            f"/api/v1/sessions/{session.id}/notes",
            json={"content": "Note đơn giản", "tags": ["real-tag"]},
        )
        assert res.status_code == 201
        note_id = res.json().get("data", res.json())["id"]

        del_res = await client.delete(
            f"/api/v1/sessions/{session.id}/notes/{note_id}/tags/ghost-tag"
        )
        assert del_res.status_code == 404

