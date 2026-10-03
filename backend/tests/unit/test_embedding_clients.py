"""
Unit tests for EmbeddingClient implementations, factory, resilience, and retry behaviors.
Phase 6.1: Real Embedding Engine & Polymorphic Factory.
"""
from __future__ import annotations

import logging
from unittest.mock import MagicMock, patch

import pytest

from app.core.config import Settings
from app.services.embedding_client import (
    EMBEDDING_DIM,
    EmbeddingClient,
    GeminiEmbeddingClient,
    MockEmbeddingClient,
    OpenAIEmbeddingClient,
    get_embedding_client,
)


def test_mock_embedding_client_dimensions_and_values():
    """MockEmbeddingClient phải trả về danh sách vector 1536 chiều với toàn số 0.0."""
    client = MockEmbeddingClient()
    texts = ["Thử nghiệm 1", "Thử nghiệm 2", "Thử nghiệm 3"]
    vectors = client.embed(texts)

    assert len(vectors) == 3
    for vec in vectors:
        assert len(vec) == EMBEDDING_DIM
        assert all(v == 0.0 for v in vec)
        assert all(isinstance(v, float) for v in vec)


def test_mock_embedding_client_empty_input():
    """MockEmbeddingClient với danh sách rỗng phải trả về danh sách rỗng."""
    client = MockEmbeddingClient()
    assert client.embed([]) == []


def test_openai_embedding_client_success():
    """OpenAIEmbeddingClient gọi API thành công và trả về vector 1536 chiều."""
    fake_vector_1 = [0.1] * EMBEDDING_DIM
    fake_vector_2 = [-0.2] * EMBEDDING_DIM

    mock_response = MagicMock()
    mock_item_1 = MagicMock()
    mock_item_1.embedding = fake_vector_1
    mock_item_2 = MagicMock()
    mock_item_2.embedding = fake_vector_2
    mock_response.data = [mock_item_1, mock_item_2]

    with patch("openai.OpenAI") as mock_openai_cls:
        mock_instance = MagicMock()
        mock_instance.embeddings.create.return_value = mock_response
        mock_openai_cls.return_value = mock_instance

        client = OpenAIEmbeddingClient(api_key="sk-test-fake-key", model="text-embedding-3-small")
        vectors = client.embed(["Văn bản 1", "Văn bản 2"])

        assert len(vectors) == 2
        assert vectors[0] == fake_vector_1
        assert vectors[1] == fake_vector_2
        mock_instance.embeddings.create.assert_called_once()


def test_openai_embedding_client_graceful_fallback_on_missing_key(caplog):
    """OpenAIEmbeddingClient không có API key phải tự động fallback về MockEmbeddingClient mà không crash."""
    with caplog.at_level(logging.WARNING):
        client = OpenAIEmbeddingClient(api_key="", fallback_on_error=True)
        vectors = client.embed(["Câu hỏi thử nghiệm"])

    assert len(vectors) == 1
    assert len(vectors[0]) == EMBEDDING_DIM
    assert all(v == 0.0 for v in vectors[0])
    assert any("OpenAI API key missing" in record.message for record in caplog.records)


def test_openai_embedding_client_retry_and_fallback_on_exception(caplog):
    """OpenAIEmbeddingClient gặp exception liên tiếp phải retry tối đa và fallback an toàn."""
    with patch("openai.OpenAI") as mock_openai_cls:
        mock_instance = MagicMock()
        mock_instance.embeddings.create.side_effect = RuntimeError("OpenAI Server Error 500")
        mock_openai_cls.return_value = mock_instance

        with caplog.at_level(logging.WARNING):
            client = OpenAIEmbeddingClient(
                api_key="sk-test-key",
                max_retries=2,
                retry_delay=0.01,
                fallback_on_error=True,
            )
            vectors = client.embed(["Thử nghiệm lỗi"])

        assert len(vectors) == 1
        assert len(vectors[0]) == EMBEDDING_DIM
        assert all(v == 0.0 for v in vectors[0])
        assert mock_instance.embeddings.create.call_count == 3  # 1 initial + 2 retries
        assert any("Falling back to MockEmbeddingClient" in record.message or "falling back to MockEmbeddingClient" in record.message for record in caplog.records)


def test_gemini_embedding_client_success():
    """GeminiEmbeddingClient gọi batchEmbedContents qua HTTP thành công và trả về vector 1536 chiều."""
    fake_vector = [0.05] * EMBEDDING_DIM
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "embeddings": [
            {"values": fake_vector},
            {"values": fake_vector},
        ]
    }

    with patch("httpx.Client.post", return_value=mock_response) as mock_post:
        client = GeminiEmbeddingClient(
            api_key="fake-gemini-key",
            model="text-embedding-004",
        )
        vectors = client.embed(["Doc 1", "Doc 2"])

        assert len(vectors) == 2
        assert len(vectors[0]) == EMBEDDING_DIM
        assert vectors[0] == fake_vector
        mock_post.assert_called_once()


def test_gemini_embedding_client_pads_or_truncates_dimension():
    """GeminiEmbeddingClient tự động chuẩn hóa kích thước vector đúng 1536 chiều nếu provider trả kích thước khác."""
    short_vector = [0.5] * 768
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "embeddings": [{"values": short_vector}]
    }

    with patch("httpx.Client.post", return_value=mock_response):
        client = GeminiEmbeddingClient(api_key="fake-gemini-key")
        vectors = client.embed(["Doc short"])

        assert len(vectors) == 1
        assert len(vectors[0]) == EMBEDDING_DIM
        assert vectors[0][:768] == short_vector
        assert all(v == 0.0 for v in vectors[0][768:])


def test_gemini_embedding_client_graceful_fallback_on_missing_key(caplog):
    """GeminiEmbeddingClient không có API key phải tự động fallback về zero-vectors."""
    with caplog.at_level(logging.WARNING):
        client = GeminiEmbeddingClient(api_key="", fallback_on_error=True)
        vectors = client.embed(["Gemini test"])

    assert len(vectors) == 1
    assert len(vectors[0]) == EMBEDDING_DIM
    assert all(v == 0.0 for v in vectors[0])
    assert any("Gemini API key missing" in record.message for record in caplog.records)


def test_gemini_embedding_client_retry_and_fallback_on_http_error(caplog):
    """GeminiEmbeddingClient gặp lỗi HTTP 503 phải retry và fallback an toàn."""
    mock_response = MagicMock()
    mock_response.status_code = 503
    mock_response.text = "Service Unavailable"

    with patch("httpx.Client.post", return_value=mock_response):
        with caplog.at_level(logging.WARNING):
            client = GeminiEmbeddingClient(
                api_key="fake-key",
                max_retries=1,
                retry_delay=0.01,
                fallback_on_error=True,
            )
            vectors = client.embed(["Test 503"])

        assert len(vectors) == 1
        assert all(v == 0.0 for v in vectors[0])


def test_factory_get_embedding_client_explicit_provider():
    """Factory get_embedding_client khởi tạo đúng class theo provider được chỉ định."""
    mock_client = get_embedding_client("mock")
    assert isinstance(mock_client, MockEmbeddingClient)

    openai_client = get_embedding_client("openai")
    assert isinstance(openai_client, OpenAIEmbeddingClient)

    gemini_client = get_embedding_client("gemini")
    assert isinstance(gemini_client, GeminiEmbeddingClient)


def test_factory_get_embedding_client_from_settings():
    """Factory get_embedding_client đọc đúng cấu hình settings khi provider=None."""
    custom_settings = Settings(EMBEDDING_PROVIDER="openai")
    with patch("app.services.embedding_client.settings", custom_settings):
        client = get_embedding_client()
        assert isinstance(client, OpenAIEmbeddingClient)


def test_factory_get_embedding_client_unknown_provider_fallback(caplog):
    """Factory get_embedding_client với provider lạ phải fallback về MockEmbeddingClient kèm log cảnh báo."""
    with caplog.at_level(logging.WARNING):
        client = get_embedding_client("unsupported_provider")
        assert isinstance(client, MockEmbeddingClient)
        assert any("Unknown EMBEDDING_PROVIDER" in record.message for record in caplog.records)


def test_reembed_all_chunks_logic():
    """Kiểm tra logic reembed_all_chunks cập nhật embedding của các chunk theo batch."""
    from app.domain.models import Chunk
    from app.scripts.reembed_chunks import reembed_all_chunks

    chunk_1 = MagicMock(spec=Chunk)
    chunk_1.content = "Nội dung 1"
    chunk_1.embedding = [0.0] * EMBEDDING_DIM

    chunk_2 = MagicMock(spec=Chunk)
    chunk_2.content = "Nội dung 2"
    chunk_2.embedding = [0.0] * EMBEDDING_DIM

    mock_session = MagicMock()
    mock_session.query.return_value.order_by.return_value.all.return_value = [chunk_1, chunk_2]

    fake_client = MagicMock()
    fake_client.embed.return_value = [[0.8] * EMBEDDING_DIM, [0.9] * EMBEDDING_DIM]

    count = reembed_all_chunks(
        db_session=mock_session,
        embedding_client=fake_client,
        batch_size=2,
        only_zero=False,
    )

    assert count == 2
    fake_client.embed.assert_called_once_with(["Nội dung 1", "Nội dung 2"])
    assert chunk_1.embedding == [0.8] * EMBEDDING_DIM
    assert chunk_2.embedding == [0.9] * EMBEDDING_DIM
    mock_session.commit.assert_called_once()


def test_reembed_all_chunks_only_zero_flag_skips_existing_real_vectors():
    """
    GIVEN: 4 chunks gồm 2 chunks zero-vectors/None và 2 chunks đã có real vectors
    WHEN: Gọi reembed_all_chunks(..., only_zero=True)
    THEN:
      - Chỉ 2 zero-vector chunks được đưa vào embedding_client.embed
      - 2 real-vector chunks giữ nguyên giá trị ban đầu
      - Hàm trả về count = 2
    """
    from app.domain.models import Chunk
    from app.scripts.reembed_chunks import reembed_all_chunks

    chunk_zero_1 = MagicMock(spec=Chunk)
    chunk_zero_1.content = "Nội dung cần re-embed 1"
    chunk_zero_1.embedding = [0.0] * EMBEDDING_DIM

    chunk_real_1 = MagicMock(spec=Chunk)
    chunk_real_1.content = "Nội dung đã có vector thực 1"
    chunk_real_1.embedding = [0.75] * EMBEDDING_DIM

    chunk_zero_2 = MagicMock(spec=Chunk)
    chunk_zero_2.content = "Nội dung cần re-embed 2"
    chunk_zero_2.embedding = None

    chunk_real_2 = MagicMock(spec=Chunk)
    chunk_real_2.content = "Nội dung đã có vector thực 2"
    chunk_real_2.embedding = [0.85] * EMBEDDING_DIM

    mock_session = MagicMock()
    mock_session.query.return_value.order_by.return_value.all.return_value = [
        chunk_zero_1,
        chunk_real_1,
        chunk_zero_2,
        chunk_real_2,
    ]

    fake_client = MagicMock()
    fake_client.embed.return_value = [
        [0.91] * EMBEDDING_DIM,
        [0.92] * EMBEDDING_DIM,
    ]

    count = reembed_all_chunks(
        db_session=mock_session,
        embedding_client=fake_client,
        batch_size=10,
        only_zero=True,
    )

    assert count == 2
    fake_client.embed.assert_called_once_with([
        "Nội dung cần re-embed 1",
        "Nội dung cần re-embed 2",
    ])
    assert chunk_zero_1.embedding == [0.91] * EMBEDDING_DIM
    assert chunk_zero_2.embedding == [0.92] * EMBEDDING_DIM
    assert chunk_real_1.embedding == [0.75] * EMBEDDING_DIM
    assert chunk_real_2.embedding == [0.85] * EMBEDDING_DIM
    mock_session.commit.assert_called_once()


def test_gemini_embedding_client_truncates_oversized_dimension():
    """
    GIVEN: Gemini REST API trả về vector có kích thước 3072 chiều (> 1536)
    WHEN: Gọi client.embed(["Văn bản kiểm thử"])
    THEN:
      - Vector trả về có chính xác 1536 chiều
      - 1536 phần tử bằng chính 1536 phần tử đầu tiên của vector phản hồi
      - Không ném exception
    """
    oversized_vector = [float(i) for i in range(3072)]
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "embeddings": [{"values": oversized_vector}]
    }

    with patch("httpx.Client.post", return_value=mock_response):
        client = GeminiEmbeddingClient(api_key="fake-gemini-key")
        vectors = client.embed(["Văn bản kiểm thử"])

        assert len(vectors) == 1
        assert len(vectors[0]) == EMBEDDING_DIM
        assert vectors[0] == oversized_vector[:EMBEDDING_DIM]


def test_openai_embedding_client_rate_limit_error_retry_and_fallback(caplog):
    """
    GIVEN: OpenAI client gặp lỗi RateLimitError liên tục ở mỗi lần gọi
    WHEN: Gọi client.embed(["Văn bản 1"])
    THEN:
      - Retry đúng 2 lần (tổng cộng 3 invocations)
      - Fallback trả về zero-vector 1536 chiều
      - Log cảnh báo không để lộ secret API key
    """
    secret_key = "sk-super-secret-api-key-12345"
    with patch("openai.OpenAI") as mock_openai_cls:
        import openai

        mock_response = MagicMock()
        mock_response.status_code = 429
        mock_response.headers = {}
        rate_limit_err = openai.RateLimitError(
            message="Rate limit exceeded: quota 429",
            response=mock_response,
            body={"error": {"message": "Rate limit reached"}},
        )

        mock_instance = MagicMock()
        mock_instance.embeddings.create.side_effect = rate_limit_err
        mock_openai_cls.return_value = mock_instance

        with caplog.at_level(logging.WARNING):
            client = OpenAIEmbeddingClient(
                api_key=secret_key,
                max_retries=2,
                retry_delay=0.01,
                fallback_on_error=True,
            )
            vectors = client.embed(["Nghiên cứu nguyên lý TRIZ"])

        assert len(vectors) == 1
        assert len(vectors[0]) == EMBEDDING_DIM
        assert all(v == 0.0 for v in vectors[0])
        assert mock_instance.embeddings.create.call_count == 3
        for record in caplog.records:
            assert secret_key not in record.message


def test_openai_embedding_client_api_connection_error_retry_and_fallback(caplog):
    """
    GIVEN: OpenAI client gặp lỗi APIConnectionError (mất kết nối mạng)
    WHEN: Gọi client.embed(["Văn bản 2"])
    THEN:
      - Retry đúng 2 lần (tổng cộng 3 invocations)
      - Fallback trả về zero-vector 1536 chiều
      - Không gọi network thật
    """
    secret_key = "sk-secret-connection-key-67890"
    with patch("openai.OpenAI") as mock_openai_cls:
        import openai

        conn_err = openai.APIConnectionError(request=MagicMock())

        mock_instance = MagicMock()
        mock_instance.embeddings.create.side_effect = conn_err
        mock_openai_cls.return_value = mock_instance

        with caplog.at_level(logging.WARNING):
            client = OpenAIEmbeddingClient(
                api_key=secret_key,
                max_retries=2,
                retry_delay=0.01,
                fallback_on_error=True,
            )
            vectors = client.embed(["Kiểm tra kết nối mạng"])

        assert len(vectors) == 1
        assert len(vectors[0]) == EMBEDDING_DIM
        assert all(v == 0.0 for v in vectors[0])
        assert mock_instance.embeddings.create.call_count == 3
        for record in caplog.records:
            assert secret_key not in record.message
