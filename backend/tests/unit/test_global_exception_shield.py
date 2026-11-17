"""
test_global_exception_shield.py — Unit tests cho Global Exception Shield (Batch C30)

Kiểm tra:
1. Bắt mọi unhandled exception (500) và trả về payload trung tính.
2. Trả về mã lỗi định danh `error_id`.
3. Tuyệt đối không rò rỉ stack trace, tên file code, hoặc chi tiết exception nội bộ.
"""
from __future__ import annotations

import pytest
from fastapi import APIRouter
from fastapi.testclient import TestClient

from app.main import app

# Tạo route kiểm thử giả lập lỗi 500 không mong muốn
crash_router = APIRouter()


@crash_router.get("/test-unhandled-crash")
async def trigger_crash():
    raise RuntimeError("Critical database crash or unexpected internal bug with sensitive info: secret_token_xyz")


# Tạm thời đăng ký router kiểm thử vào app
app.include_router(crash_router, prefix="/api/v1/test-shield")


@pytest.fixture
def client():
    # raise_server_exceptions=False cho phép test client nhận HTTP 500 thay vì re-raise exception trong Python
    return TestClient(app, raise_server_exceptions=False)


def test_global_exception_shield_masks_internal_error(client):
    response = client.get("/api/v1/test-shield/test-unhandled-crash")
    assert response.status_code == 500

    payload = response.json()
    assert "detail" in payload
    assert payload["detail"] == "Internal server error. Please try again later."
    assert "error_id" in payload
    assert isinstance(payload["error_id"], str)
    assert len(payload["error_id"]) > 0

    # Khẳng định stack trace và thông tin nhạy cảm không bị lộ
    raw_text = response.text
    assert "Traceback" not in raw_text
    assert "RuntimeError" not in raw_text
    assert "secret_token_xyz" not in raw_text
    assert ".py" not in raw_text
