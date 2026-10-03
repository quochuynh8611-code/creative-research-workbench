"""
reembed_chunks.py — Script CLI re-embed toàn bộ Chunk trong Knowledge Base (Phase 6.1).

Usage:
  python -m scripts.reembed_chunks [--provider openai|gemini|mock] [--batch-size 50] [--only-zero]

Ref: docs/PROFESSIONAL_UPGRADE_ROADMAP.md (Phase 6.1)
"""
from __future__ import annotations

import argparse
import logging

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.config import settings
from app.domain.models import Chunk
from app.services.embedding_client import EmbeddingClient, get_embedding_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("reembed_chunks")


def reembed_all_chunks(
    db_session: Session,
    embedding_client: EmbeddingClient,
    batch_size: int = 50,
    only_zero: bool = False,
) -> int:
    """
    Re-embed tất cả hoặc các chunk zero-vector trong database theo từng batch.

    Returns:
        Số lượng chunk đã được re-embed thành công.
    """
    if batch_size <= 0:
        raise ValueError("batch_size must be greater than 0")

    query = db_session.query(Chunk).order_by(Chunk.created_at.asc())
    all_chunks: list[Chunk] = query.all()

    target_chunks = []
    for c in all_chunks:
        if only_zero:
            # Chỉ re-embed nếu embedding là None hoặc toàn 0.0
            if c.embedding is None or all(v == 0.0 for v in c.embedding):
                target_chunks.append(c)
        else:
            target_chunks.append(c)

    total = len(target_chunks)
    if total == 0:
        logger.info("Không có chunk nào cần re-embed.")
        return 0

    logger.info(
        "Bắt đầu re-embed %d chunks (batch_size=%d, client=%s)...",
        total,
        batch_size,
        embedding_client.__class__.__name__,
    )

    processed = 0
    for i in range(0, total, batch_size):
        batch = target_chunks[i : i + batch_size]
        batch_num = (i // batch_size) + 1
        texts = [c.content for c in batch]
        try:
            vectors = embedding_client.embed(texts)

            for chunk_obj, vec in zip(batch, vectors):
                chunk_obj.embedding = vec

            db_session.flush()
            db_session.commit()
        except Exception as exc:
            db_session.rollback()
            logger.error(
                "Lỗi khi re-embed batch %d (chunks %d-%d/%d): %s. Đã rollback transaction.",
                batch_num,
                i + 1,
                min(i + batch_size, total),
                total,
                exc,
            )
            raise

        processed += len(batch)
        logger.info("Tiến độ: %d/%d chunks (%.1f%%)", processed, total, (processed / total) * 100)

    logger.info("Hoàn tất re-embed %d chunks.", processed)
    return processed


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Re-embed Knowledge Base chunks with real embeddings.")
    parser.add_argument(
        "--provider",
        type=str,
        default=None,
        help="Embedding provider ('openai', 'gemini', 'mock'). Mặc định đọc từ settings.EMBEDDING_PROVIDER.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=50,
        help="Kích thước batch mỗi lần gọi embedding API (mặc định: 50).",
    )
    parser.add_argument(
        "--only-zero",
        action="store_true",
        help="Chỉ re-embed các chunk có embedding là None hoặc zero-vectors.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    db_url = settings.DATABASE_URL
    if "asyncpg" in db_url:
        db_url = db_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")

    engine = create_engine(db_url)
    client = get_embedding_client(args.provider)

    with Session(engine) as session:
        reembed_all_chunks(
            db_session=session,
            embedding_client=client,
            batch_size=args.batch_size,
            only_zero=args.only_zero,
        )


if __name__ == "__main__":
    main()
