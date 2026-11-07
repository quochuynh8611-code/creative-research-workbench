import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.orm import Session
from app.main import app
from app.api.v1.endpoints.sessions import get_db


@pytest.fixture(autouse=True)
def override_db_dependency(db_session: Session):
    app.dependency_overrides[get_db] = lambda: db_session
    yield
    app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_create_session():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/sessions",
            json={"title": "Test session", "domain": "research", "tags": ["triz"]},
        )
    assert response.status_code == 201
    data = response.json()["data"]
    assert data["status"] in ("active", "draft")

