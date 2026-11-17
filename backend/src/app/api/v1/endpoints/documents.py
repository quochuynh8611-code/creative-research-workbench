"""
documents.py — REST API endpoints cho Quản lý Cơ sở Tri thức & Tài liệu (Phase 8)

Cung cấp:
  - GET    /api/v1/documents       : Liệt kê danh sách tài liệu kèm phân trang và bộ lọc
  - GET    /api/v1/documents/{id}  : Lấy chi tiết tài liệu kèm danh sách chunks
  - POST   /api/v1/documents/upload: Nạp tài liệu Markdown / Text vào Knowledge Base
  - PUT    /api/v1/documents/{id}  : Cập nhật nội dung tài liệu (re-chunk, re-embed nguyên tử)
  - DELETE /api/v1/documents/{id}  : Xóa tài liệu thường (chặn xóa Golden Documents)
"""
from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    Query,
    Response,
    UploadFile,
    status,
)
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.v1.endpoints.sessions import get_db
from app.core.cache import get_cache
from app.core.config import settings
from app.domain.models import Chunk, Document, DocumentStatus, JobStatus, JobType
from app.services.embedding_client import get_embedding_client
from app.services.ingestion_service import (
    DEFAULT_CHUNK_TOKENS,
    DEFAULT_OVERLAP_TOKENS,
    EMBEDDING_DIM,
    FrontmatterParser,
    FrontmatterValidationError,
    IngestionService,
    MarkdownChunker,
)
from app.services.job_service import JobService

router = APIRouter()


# ──────────────────────────────────────────────
# Request Schemas
# ──────────────────────────────────────────────

class DocumentUpdateRequest(BaseModel):
    content: str = Field(..., min_length=1, description="Nội dung Markdown hoặc text mới")
    title: Optional[str] = Field(None, description="Tiêu đề mới (tùy chọn)")
    topic: Optional[str] = Field(None, description="Topic mới (tùy chọn)")
    tags: Optional[list[str]] = Field(None, description="Danh sách tags mới (tùy chọn)")


# ──────────────────────────────────────────────
# Serializers
# ──────────────────────────────────────────────

def _serialize_document_item(doc: Document, chunks_count: int = 0) -> dict[str, Any]:
    return {
        "id": str(doc.id),
        "filename": doc.filename,
        "filepath": doc.filepath,
        "title": doc.title,
        "topic": doc.topic,
        "source_type": doc.source_type,
        "language": doc.language,
        "tags": doc.tags or [],
        "phase": doc.phase,
        "status": doc.status.value if isinstance(doc.status, DocumentStatus) else str(doc.status),
        "golden": doc.golden,
        "content_hash": doc.content_hash,
        "chunks_count": chunks_count,
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
        "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
    }


def _serialize_document_detail(doc: Document, chunks: list[Chunk]) -> dict[str, Any]:
    data = _serialize_document_item(doc, chunks_count=len(chunks))
    data["chunks"] = [
        {
            "id": str(chunk.id),
            "chunk_index": chunk.chunk_index,
            "token_count": chunk.token_count,
            "content": chunk.content,
        }
        for chunk in chunks
    ]
    return data


# ──────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────

@router.get("", response_model=None)
async def list_documents(
    q: Optional[str] = Query(None, description="Tìm kiếm theo tiêu đề hoặc tên file"),
    topic: Optional[str] = Query(None, description="Lọc theo topic"),
    status: Optional[str] = Query(None, description="Lọc theo trạng thái (canonical/draft/deprecated)"),
    golden: Optional[bool] = Query(None, description="Lọc theo cờ Golden Document"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Liệt kê danh sách tài liệu trong Knowledge Base có hỗ trợ tìm kiếm, lọc và phân trang.
    """
    query = select(Document)

    # 1. Filters
    if q and q.strip():
        search_term = f"%{q.strip()}%"
        query = query.where(
            or_(
                Document.title.ilike(search_term),
                Document.filename.ilike(search_term),
            )
        )
    if topic and topic.strip():
        query = query.where(Document.topic == topic.strip())
    if status and status.strip():
        query = query.where(Document.status == status.strip())
    if golden is not None:
        query = query.where(Document.golden == golden)

    # 2. Total Count
    count_query = select(func.count()).select_from(query.subquery())
    total = db.scalar(count_query) or 0

    # 3. Pagination & Order
    query = query.order_by(Document.created_at.desc()).offset(offset).limit(limit)
    documents = db.scalars(query).all()

    # 4. Chunks Count Mapping
    doc_ids = [d.id for d in documents]
    chunks_count_map: dict[uuid.UUID, int] = {}
    if doc_ids:
        chunk_counts = (
            db.query(Chunk.document_id, func.count(Chunk.id))
            .filter(Chunk.document_id.in_(doc_ids))
            .group_by(Chunk.document_id)
            .all()
        )
        chunks_count_map = {doc_id: count for doc_id, count in chunk_counts}

    serialized = [
        _serialize_document_item(doc, chunks_count=chunks_count_map.get(doc.id, 0))
        for doc in documents
    ]

    return {
        "data": serialized,
        "meta": {
            "total": total,
            "limit": limit,
            "offset": offset,
        },
    }


@router.get("/embedding-status", response_model=None)
async def get_embedding_status(
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Trả về tiến độ embedding hiện tại của toàn bộ Knowledge Base và model nhúng đang kích hoạt.
    """
    total_docs = db.scalar(select(func.count(Document.id))) or 0
    embedded_docs = db.scalar(
        select(func.count(func.distinct(Chunk.document_id))).where(Chunk.embedding.isnot(None))
    ) or 0
    total_chunks = db.scalar(select(func.count(Chunk.id))) or 0
    embedded_chunks = db.scalar(
        select(func.count(Chunk.id)).where(Chunk.embedding.isnot(None))
    ) or 0

    provider = getattr(settings, "EMBEDDING_PROVIDER", "mock")
    model = (
        getattr(settings, "EMBEDDING_MODEL_NAME", None)
        or (getattr(settings, "OLLAMA_EMBEDDING_MODEL", "nomic-embed-text") if provider == "ollama" else provider)
    )

    return {
        "data": {
            "total_documents": total_docs,
            "embedded_documents": embedded_docs,
            "total_chunks": total_chunks,
            "embedded_chunks": embedded_chunks,
            "provider": provider,
            "model": model,
            "progress_text": f"{embedded_docs}/{total_docs} documents embedded",
        }
    }


@router.get("/{document_id}", response_model=None)
async def get_document(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Lấy thông tin chi tiết một tài liệu kèm danh sách các chunks.
    """
    document = db.get(Document, document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document not found: {document_id}",
        )

    chunks_stmt = (
        select(Chunk)
        .where(Chunk.document_id == document_id)
        .order_by(Chunk.chunk_index.asc())
    )
    chunks = list(db.scalars(chunks_stmt).all())

    return {
        "data": _serialize_document_detail(document, chunks)
    }


MAX_UPLOAD_SIZE_BYTES: int = 10 * 1024 * 1024  # 10MB limit


@router.post("/upload", response_model=None)
async def upload_document(
    response: Response,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    async_mode: bool = Query(False, alias="async", description="Chạy nạp tài liệu bất đồng bộ"),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Upload và nạp tài liệu Markdown / TXT vào Knowledge Base.
    Hỗ trợ 2 chế độ:
      - Đồng bộ (mặc định async=false): Chờ ingest hoàn tất, trả về HTTP 200.
      - Bất đồng bộ (async=true): Tạo job, kích hoạt BackgroundTasks, trả về HTTP 202 Accepted.
    """
    filename = file.filename or "uploaded.md"
    ext = filename.lower().split(".")[-1] if "." in filename else ""
    if ext not in ["md", "txt", "markdown"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chỉ hỗ trợ nạp tài liệu định dạng Markdown (.md, .markdown) hoặc Text (.txt)",
        )

    try:
        raw_bytes = await file.read()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Không thể đọc nội dung file: {exc}",
        ) from exc

    if len(raw_bytes) > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dung lượng file vượt quá giới hạn tối đa 10MB.",
        )

    engine = db.get_bind()

    # --- CHẾ ĐỘ BẤT ĐỒNG BỘ (ASYNC MODE) ---
    if async_mode:
        job_service = JobService(engine=engine)
        job = job_service.create_job(job_type=JobType.document_ingestion)

        def _async_ingest_worker(worker_session: Session) -> dict[str, Any]:
            worker_engine = worker_session.get_bind()
            worker_ingest_service = IngestionService(engine=worker_engine)
            res = worker_ingest_service.ingest_bytes(raw_bytes=raw_bytes, filename=filename)
            if res.status == "error":
                raise RuntimeError(res.error_message or "Lỗi không xác định khi nạp tài liệu")
            get_cache().invalidate_namespace("search")
            get_cache().invalidate_namespace("analytics")
            return {
                "status": res.status,
                "document_id": str(res.document_id) if res.document_id else None,
                "chunks_created": res.chunks_created,
                "embeddings_created": res.embeddings_created,
            }

        background_tasks.add_task(job_service.run_job, job.id, _async_ingest_worker)
        response.status_code = status.HTTP_202_ACCEPTED

        return {
            "data": {
                "job_id": str(job.id),
                "job_type": job.job_type.value if hasattr(job.job_type, "value") else str(job.job_type),
                "status": job.status.value if hasattr(job.status, "value") else str(job.status),
                "created_at": job.created_at.isoformat() if job.created_at else None,
            }
        }

    # --- CHẾ ĐỘ ĐỒNG BỘ (SYNC MODE - DEFAULT) ---
    service = IngestionService(engine=engine)
    result = service.ingest_bytes(raw_bytes=raw_bytes, filename=filename)

    if result.status == "already_exists":
        return {
            "data": {
                "status": "already_exists",
                "document_id": str(result.document_id),
                "filename": filename,
                "message": "Tài liệu với nội dung tương tự đã tồn tại trong hệ thống.",
            }
        }

    if result.status == "error":
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi trong quá trình nạp tài liệu: {result.error_message}",
        )

    # Invalidate cache sau khi nạp tài liệu thành công
    get_cache().invalidate_namespace("search")
    get_cache().invalidate_namespace("analytics")

    # Lấy title của document vừa tạo
    created_doc = db.get(Document, result.document_id)
    doc_title = created_doc.title if created_doc else filename

    return {
        "data": {
            "status": "success",
            "document_id": str(result.document_id),
            "filename": filename,
            "title": doc_title,
            "chunks_created": result.chunks_created,
            "embeddings_created": result.embeddings_created,
        }
    }


@router.put("/{document_id}", response_model=None)
async def update_document(
    document_id: uuid.UUID,
    payload: DocumentUpdateRequest,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Cập nhật nội dung tài liệu trong Knowledge Base (Phase 8).
    - Chặn cập nhật Golden Documents (403 Forbidden).
    - Parse frontmatter (nếu có) và tính SHA-256 hash mới.
    - Kiểm tra hash trùng lặp với document khác (409 Conflict).
    - Xóa chunks cũ, tạo chunks mới và sinh embeddings (1536 dim).
    - Cập nhật document metadata nguyên tử trong 1 transaction.
    """
    document = db.get(Document, document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document not found: {document_id}",
        )

    if document.golden:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Không thể cập nhật Golden Document chuẩn tắc của hệ thống.",
        )

    raw_bytes = payload.content.encode("utf-8")
    new_hash = hashlib.sha256(raw_bytes).hexdigest()

    # Kiểm tra xung đột hash với document khác
    conflict_doc = db.execute(
        select(Document).where(Document.content_hash == new_hash, Document.id != document_id)
    ).scalar_one_or_none()
    if conflict_doc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Tài liệu với nội dung tương tự đã tồn tại với ID: {conflict_doc.id}",
        )

    # Parse frontmatter và trích xuất body
    try:
        metadata, body = FrontmatterParser.parse(payload.content)
    except FrontmatterValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Lỗi cú pháp frontmatter: {exc}",
        ) from exc

    # Xóa chunks cũ
    db.query(Chunk).filter(Chunk.document_id == document_id).delete()

    # Chunking
    chunker = MarkdownChunker(max_tokens=DEFAULT_CHUNK_TOKENS, overlap_tokens=DEFAULT_OVERLAP_TOKENS)
    chunks_data = chunker.split(body)
    if not chunks_data:
        chunks_data = [(body.strip() or "(empty)", 1)]

    # Embeddings
    embedding_client = get_embedding_client()
    texts = [text for text, _ in chunks_data]
    vectors = embedding_client.embed(texts)

    standardize_fn = getattr(embedding_client, "_standardize_dim", None)
    standardized_vectors: list[list[float]] = []
    for v in vectors:
        if len(v) != EMBEDDING_DIM:
            if callable(standardize_fn):
                standardized_vectors.append(standardize_fn(v))
            elif len(v) < EMBEDDING_DIM:
                standardized_vectors.append([float(x) for x in v] + [0.0] * (EMBEDDING_DIM - len(v)))
            else:
                standardized_vectors.append([float(x) for x in v[:EMBEDDING_DIM]])
        else:
            standardized_vectors.append(v)

    # Tạo chunks mới
    new_chunks = [
        Chunk(
            id=uuid.uuid4(),
            document_id=document_id,
            content=text,
            chunk_index=idx,
            token_count=token_count,
            embedding=vec,
        )
        for idx, ((text, token_count), vec) in enumerate(zip(chunks_data, standardized_vectors))
    ]
    db.add_all(new_chunks)

    # Cập nhật metadata Document
    document.content_hash = new_hash
    if payload.title is not None:
        document.title = payload.title
    elif "title" in metadata:
        document.title = str(metadata["title"])

    if payload.topic is not None:
        document.topic = payload.topic
    elif "topic" in metadata:
        document.topic = str(metadata["topic"])

    if payload.tags is not None:
        document.tags = payload.tags
    elif "tags" in metadata:
        raw_tags = metadata["tags"]
        document.tags = list(raw_tags) if isinstance(raw_tags, list) else [str(raw_tags)]

    if "source_type" in metadata:
        document.source_type = str(metadata["source_type"])
    if "language" in metadata:
        document.language = str(metadata["language"])
    if "phase" in metadata:
        document.phase = str(metadata["phase"])
    if "status" in metadata:
        try:
            document.status = DocumentStatus(str(metadata["status"]))
        except ValueError:
            pass

    document.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(document)

    get_cache().invalidate_namespace("search")
    get_cache().invalidate_namespace("analytics")

    return {
        "data": _serialize_document_detail(document, new_chunks)
    }


@router.delete("/{document_id}", response_model=None)
async def delete_document(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Xóa tài liệu khỏi Knowledge Base.
    Golden Document (golden=True) sẽ bị từ chối xóa với HTTP 403 Forbidden.
    """
    document = db.get(Document, document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document not found: {document_id}",
        )

    if document.golden:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Không thể xóa Golden Document chuẩn tắc của hệ thống.",
        )

    doc_id_str = str(document.id)
    db.delete(document)
    db.commit()

    get_cache().invalidate_namespace("search")
    get_cache().invalidate_namespace("analytics")

    return {
        "status": "deleted",
        "id": doc_id_str,
        "data": {
            "status": "deleted",
            "id": doc_id_str,
        },
    }
