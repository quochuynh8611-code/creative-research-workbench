"""
ingestion_service.py — Pipeline nạp tài liệu Markdown vào Knowledge Base

Pipeline (theo thứ tự):
  1. Đọc file → kiểm tra tồn tại
  2. FrontmatterParser  → tách YAML front-block khỏi body
  3. SHA-256 dedup      → tra cứu content_hash trong DB, skip nếu đã có
  4. MarkdownChunker    → cắt body thành các chunk 512t / overlap 50t
  5. EmbeddingClient    → tạo vector 1536 dim cho mỗi chunk
  6. Persist            → Document + Chunks vào PostgreSQL (1 transaction)

Design decisions:
  - EmbeddingClient là interface riêng → dễ swap MockClient ↔ OpenAIClient
    mà không thay đổi IngestionService
  - Chunker dùng tiktoken cl100k_base (cùng tokenizer với text-embedding-3-small)
  - Mỗi lần ingest là 1 atomic transaction: tất cả commit hoặc tất cả rollback
  - content_hash = SHA256(raw_bytes) — hash trước khi parse để chống re-ingest
    ngay cả khi nội dung thay đổi không đáng kể

Ref: docs/DOMAIN_SCHEMA.md, docs/ADR-001-architecture.md
"""
from __future__ import annotations

import hashlib
import logging
import pathlib
import re
import uuid
from abc import ABC, abstractmethod
from typing import Any

import yaml
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.domain.models import Chunk, Document, DocumentStatus, IngestResult

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────

DEFAULT_CHUNK_TOKENS: int = 512
DEFAULT_OVERLAP_TOKENS: int = 50
EMBEDDING_DIM: int = 1536


# ──────────────────────────────────────────────
# FrontmatterParser
# ──────────────────────────────────────────────

_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)


class FrontmatterParser:
    """
    Tách YAML front-block (--- ... ---) khỏi nội dung Markdown.

    Returns:
        metadata: dict — parsed YAML, empty dict nếu không có front-block
        body:     str  — phần còn lại sau front-block
    """

    @staticmethod
    def parse(raw_text: str) -> tuple[dict[str, Any], str]:
        match = _FRONTMATTER_RE.match(raw_text)
        if not match:
            return {}, raw_text

        try:
            metadata: dict[str, Any] = yaml.safe_load(match.group(1)) or {}
        except yaml.YAMLError as exc:
            logger.warning("Frontmatter YAML parse error: %s", exc)
            metadata = {}

        body = raw_text[match.end():]
        return metadata, body


# ──────────────────────────────────────────────
# MarkdownChunker
# ──────────────────────────────────────────────

class MarkdownChunker:
    """
    Cắt văn bản thành các chunk có độ dài tối đa `max_tokens` tokens.

    Strategy:
      - Tách theo paragraph (\n\n) trước
      - Gom các paragraph vào chunk hiện tại cho đến khi vượt ngưỡng
      - Khi chunk đầy, giữ lại `overlap_tokens` cuối cùng làm context sang chunk tiếp

    Tokenizer: tiktoken cl100k_base — cùng với text-embedding-3-small.
    Fallback: ước lượng 4 chars/token nếu tiktoken chưa được cài.
    """

    def __init__(
        self,
        max_tokens: int = DEFAULT_CHUNK_TOKENS,
        overlap_tokens: int = DEFAULT_OVERLAP_TOKENS,
    ) -> None:
        self.max_tokens = max_tokens
        self.overlap_tokens = overlap_tokens
        self._enc = self._load_encoder()

    @staticmethod
    def _load_encoder() -> Any:
        try:
            import tiktoken  # type: ignore[import]
            return tiktoken.get_encoding("cl100k_base")
        except ImportError:
            logger.info("tiktoken not installed — using char-based token estimation")
            return None

    def count_tokens(self, text: str) -> int:
        if self._enc is not None:
            return len(self._enc.encode(text))
        # Fallback: 4 chars ≈ 1 token (conservative estimate)
        return max(1, len(text) // 4)

    def split(self, text: str) -> list[tuple[str, int]]:
        """
        Trả về list of (chunk_text, token_count).
        """
        paragraphs = [p.strip() for p in re.split(r"\n{2,}", text) if p.strip()]
        if not paragraphs:
            return []

        chunks: list[tuple[str, int]] = []
        current_parts: list[str] = []
        current_tokens: int = 0

        for para in paragraphs:
            para_tokens = self.count_tokens(para)

            # Paragraph quá dài — cắt cứng theo từng câu
            if para_tokens > self.max_tokens:
                # flush current buffer trước
                if current_parts:
                    text_chunk = "\n\n".join(current_parts)
                    chunks.append((text_chunk, self.count_tokens(text_chunk)))
                    current_parts = []
                    current_tokens = 0

                # Cắt para dài thành sub-chunks theo từ
                words = para.split()
                sub_buf: list[str] = []
                sub_tokens = 0
                for word in words:
                    wt = self.count_tokens(word)
                    if sub_tokens + wt > self.max_tokens and sub_buf:
                        sub_text = " ".join(sub_buf)
                        chunks.append((sub_text, self.count_tokens(sub_text)))
                        # overlap: giữ lại phần cuối
                        overlap_words = self._overlap_words(sub_buf)
                        sub_buf = overlap_words + [word]
                        sub_tokens = self.count_tokens(" ".join(sub_buf))
                    else:
                        sub_buf.append(word)
                        sub_tokens += wt
                if sub_buf:
                    sub_text = " ".join(sub_buf)
                    chunks.append((sub_text, self.count_tokens(sub_text)))
                continue

            # Normal: gom vào chunk hiện tại
            if current_tokens + para_tokens > self.max_tokens and current_parts:
                text_chunk = "\n\n".join(current_parts)
                chunks.append((text_chunk, self.count_tokens(text_chunk)))
                # Overlap: giữ lại paragraph cuối nếu còn chỗ
                overlap_text = current_parts[-1] if current_parts else ""
                overlap_t = self.count_tokens(overlap_text)
                if overlap_t <= self.overlap_tokens:
                    current_parts = [overlap_text]
                    current_tokens = overlap_t
                else:
                    current_parts = []
                    current_tokens = 0

            current_parts.append(para)
            current_tokens += para_tokens

        # Flush phần còn lại
        if current_parts:
            text_chunk = "\n\n".join(current_parts)
            chunks.append((text_chunk, self.count_tokens(text_chunk)))

        return chunks

    def _overlap_words(self, word_list: list[str]) -> list[str]:
        """Lấy các từ cuối sao cho tổng token <= overlap_tokens."""
        result: list[str] = []
        tokens = 0
        for word in reversed(word_list):
            wt = self.count_tokens(word)
            if tokens + wt > self.overlap_tokens:
                break
            result.insert(0, word)
            tokens += wt
        return result


# ──────────────────────────────────────────────
# EmbeddingClient (Interface + MockClient)
# ──────────────────────────────────────────────

class EmbeddingClient(ABC):
    """
    Interface cho embedding client.
    Implement interface này để swap MockClient ↔ OpenAIClient.
    """

    @abstractmethod
    def embed(self, texts: list[str]) -> list[list[float]]:
        """
        Nhận list[str], trả về list[list[float]] với dim == EMBEDDING_DIM.
        Thứ tự output phải tương ứng 1:1 với input.
        """
        ...


class MockEmbeddingClient(EmbeddingClient):
    """
    Mock: trả về zero-vectors 1536 dim.
    Dùng trong integration tests và development khi chưa có OpenAI API key.

    NOTE: zero-vectors không có nghĩa về semantic — chỉ để pipeline chạy được.
    Swap bằng OpenAIEmbeddingClient khi cần retrieval thực.
    """

    def embed(self, texts: list[str]) -> list[list[float]]:
        return [[0.0] * EMBEDDING_DIM for _ in texts]


# ──────────────────────────────────────────────
# IngestionService
# ──────────────────────────────────────────────

class IngestionService:
    """
    Orchestrate toàn bộ pipeline ingest: file → DB.

    Args:
        engine:           SQLAlchemy Engine (PostgreSQL)
        embedding_client: EmbeddingClient impl. Default: MockEmbeddingClient.
        chunk_size:       Số token tối đa mỗi chunk. Default: 512.
        overlap:          Số token overlap giữa các chunk. Default: 50.

    Usage:
        service = IngestionService(engine=engine)
        result = service.ingest("docs/ADR-001-architecture.md")
        assert result.status == "success"
    """

    def __init__(
        self,
        engine: Engine,
        embedding_client: EmbeddingClient | None = None,
        chunk_size: int = DEFAULT_CHUNK_TOKENS,
        overlap: int = DEFAULT_OVERLAP_TOKENS,
    ) -> None:
        self.engine = engine
        self.embedding_client = embedding_client or MockEmbeddingClient()
        self.chunker = MarkdownChunker(max_tokens=chunk_size, overlap_tokens=overlap)

    # ──────────────────────────────────────────
    # Public API
    # ──────────────────────────────────────────

    def ingest(self, filepath: str) -> IngestResult:
        """
        Ingest 1 file Markdown vào Knowledge Base.

        Returns:
            IngestResult.status == 'success'        → tạo mới thành công
            IngestResult.status == 'already_exists' → content_hash đã tồn tại, skip
            IngestResult.status == 'error'          → lỗi (chi tiết trong error_message)
        """
        path = pathlib.Path(filepath)

        # Guard: file phải tồn tại
        if not path.is_file():
            logger.error("File không tồn tại: %s", filepath)
            return IngestResult.error(f"File not found: {filepath}")

        try:
            return self._ingest_file(path)
        except Exception as exc:  # noqa: BLE001
            logger.exception("Lỗi khi ingest %s", filepath)
            return IngestResult.error(str(exc))

    # ──────────────────────────────────────────
    # Private helpers
    # ──────────────────────────────────────────

    def _ingest_file(self, path: pathlib.Path) -> IngestResult:
        raw_bytes = path.read_bytes()
        content_hash = hashlib.sha256(raw_bytes).hexdigest()

        # ── Dedup check ───────────────────────
        existing_id = self._find_by_hash(content_hash)
        if existing_id is not None:
            logger.info("Duplicate skip: %s (hash=%s)", path.name, content_hash[:8])
            return IngestResult.already_exists(existing_id)

        # ── Parse ─────────────────────────────
        raw_text = raw_bytes.decode("utf-8", errors="replace")
        metadata, body = FrontmatterParser.parse(raw_text)

        # ── Build Document ────────────────────
        doc_id = uuid.uuid4()
        document = self._build_document(
            doc_id=doc_id,
            path=path,
            metadata=metadata,
            content_hash=content_hash,
        )

        # ── Chunk ─────────────────────────────
        chunks_data = self.chunker.split(body)
        if not chunks_data:
            # Fallback: nội dung rỗng — tạo 1 chunk tượng trưng
            chunks_data = [(body.strip() or "(empty)", 1)]

        # ── Embed ─────────────────────────────
        texts = [text for text, _ in chunks_data]
        vectors = self.embedding_client.embed(texts)

        # ── Build Chunks ──────────────────────
        chunk_objects = [
            Chunk(
                id=uuid.uuid4(),
                document_id=doc_id,
                content=text,
                chunk_index=idx,
                token_count=token_count,
                embedding=vector,
            )
            for idx, ((text, token_count), vector) in enumerate(
                zip(chunks_data, vectors)
            )
        ]

        # ── Persist (1 transaction) ───────────
        with Session(self.engine) as session:
            session.add(document)
            session.add_all(chunk_objects)
            session.commit()

        logger.info(
            "Ingested: %s → doc_id=%s, chunks=%d",
            path.name,
            doc_id,
            len(chunk_objects),
        )

        return IngestResult(
            status="success",
            document_id=doc_id,
            chunks_created=len(chunk_objects),
            embeddings_created=len(chunk_objects),
        )

    def _find_by_hash(self, content_hash: str) -> uuid.UUID | None:
        """Trả về Document.id nếu content_hash đã tồn tại, None nếu chưa."""
        with Session(self.engine) as session:
            stmt = select(Document.id).where(Document.content_hash == content_hash)
            return session.scalar(stmt)

    @staticmethod
    def _build_document(
        doc_id: uuid.UUID,
        path: pathlib.Path,
        metadata: dict[str, Any],
        content_hash: str,
    ) -> Document:
        """Ánh xạ frontmatter metadata → Document ORM object."""
        # status: map string → enum, default draft
        raw_status = metadata.get("status", "draft")
        try:
            status = DocumentStatus(raw_status)
        except ValueError:
            status = DocumentStatus.draft

        # tags: đảm bảo luôn là list[str] hoặc None
        raw_tags = metadata.get("tags")
        if isinstance(raw_tags, list):
            tags: list[str] | None = [str(t) for t in raw_tags]
        elif raw_tags is not None:
            tags = [str(raw_tags)]
        else:
            tags = None

        # golden: frontmatter có thể là bool hoặc string "true"
        raw_golden = metadata.get("golden", False)
        golden = raw_golden is True or str(raw_golden).lower() == "true"

        # phase: lưu dưới dạng string
        raw_phase = metadata.get("phase")
        phase = str(raw_phase) if raw_phase is not None else None

        return Document(
            id=doc_id,
            filename=path.name,
            filepath=str(path),
            title=str(metadata.get("title", path.stem)),
            topic=metadata.get("topic"),
            source_type=metadata.get("source_type"),
            language=metadata.get("language", "vi"),
            tags=tags,
            phase=phase,
            status=status,
            golden=golden,
            content_hash=content_hash,
        )
