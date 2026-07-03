---
title: "FAILING INTEGRATION TEST SPEC — Creative Research Workbench MVP"
topic: testing
source_type: spec
language: vi
tags: [integration-test, failing, tdd, red-green, pytest, fixtures]
golden: true
phase: 0
created_at: 2026-07-03
---

# FAILING INTEGRATION TEST SPEC — Creative Research Workbench MVP

## Purpose
Đặc tả integration tests theo phong cách TDD. Viết tests này TRƯỚC khi code. Tất cả tests phải fail đỏ ban đầu.

## Test Harness Assumptions
- Framework: `pytest` + `httpx.AsyncClient`
- Database: PostgreSQL test instance (Docker)
- Fixtures: `test_session`, `test_problem_frame`, `golden_docs_loaded`

## IT-001: Create session
```python
async def test_create_session_returns_201_with_id(client):
    response = await client.post("/api/v1/sessions", json={
        "title": "Test session",
        "domain": "technical"
    })
    assert response.status_code == 201
    data = response.json()
    assert "id" in data
    assert data["status"] == "draft"
    assert "slug" in data
```

## IT-002: Clarify vague problem
```python
async def test_vague_problem_returns_clarifying_questions(client, test_session):
    response = await client.post(
        f"/api/v1/sessions/{test_session.id}/problem-frames",
        json={"raw_statement": "Mọi thứ không ổn"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "clarifying_questions" in data
    assert len(data["clarifying_questions"]) >= 2
    assert "problem_frame" not in data
```

## IT-003: Create problem frame version 1
```python
async def test_structured_problem_returns_problem_frame(client, test_session):
    response = await client.post(
        f"/api/v1/sessions/{test_session.id}/problem-frames",
        json={"raw_statement": "Hệ thống xử lý đơn hàng bị chậm khi có hơn 100 đơn đồng thời"}
    )
    assert response.status_code == 201
    frame = response.json()
    assert frame["completeness_score"] >= 0.6
    assert frame["goal"] != ""
    assert len(frame["constraints"]) >= 1
```

## IT-004: Search returns excerpts
```python
async def test_search_returns_results_with_excerpts(client, golden_docs_loaded):
    response = await client.post("/api/v1/search", json={
        "query": "TRIZ technical contradiction",
        "top_k": 5
    })
    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) >= 1
    for r in results:
        assert "excerpt" in r
        assert "source_file" in r
        assert r["score_hybrid"] > 0
```

## IT-005: Advance workflow stage
```python
async def test_advance_session_to_structuring(client, test_session_with_frame):
    response = await client.post(
        f"/api/v1/sessions/{test_session_with_frame.id}/advance",
        json={"to_stage": "structuring"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["current_stage"] == "structuring"
    assert data["previous_stage"] == "intake"
```
