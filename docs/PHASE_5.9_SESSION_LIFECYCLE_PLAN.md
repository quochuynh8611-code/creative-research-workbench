# PHASE 5.9 PLAN — Session Lifecycle & Safe Deletion

> **Document Status**: Execution Plan & Test Scenarios  
> **Target Release**: Phase 5.9  
> **Author**: Antigravity Pair Programmer  
> **Spec Ref**: [`docs/PHASE_5.9_SESSION_LIFECYCLE_SPEC.md`](file:///Users/mr.chem/Documents/Lap-trinh/creative-research-workbench/docs/PHASE_5.9_SESSION_LIFECYCLE_SPEC.md)

---

## 1. Gherkin Scenarios (Acceptance Criteria)

### Scenario 1: Archive an active research session
```gherkin
Given a ResearchSession exists in the database with status "active"
When the user sends a POST request to "/api/v1/sessions/{session_id}/archive"
Then the API responds with HTTP 200 OK
And the returned session status is "archived"
And subsequent default GET "/api/v1/sessions" does NOT include this session
And GET "/api/v1/sessions?status=archived" includes this session
And all related ProblemFrames and Contradictions remain intact in the database
```

### Scenario 2: Restore an archived research session
```gherkin
Given a ResearchSession exists in the database with status "archived"
When the user sends a POST request to "/api/v1/sessions/{session_id}/restore"
Then the API responds with HTTP 200 OK
And the returned session status is "active"
And subsequent default GET "/api/v1/sessions" includes this session again
```

### Scenario 3: Archive or restore non-existent session
```gherkin
Given a random non-existent UUID
When the user sends POST to "/api/v1/sessions/{random_uuid}/archive" or "/api/v1/sessions/{random_uuid}/restore"
Then the API responds with HTTP 404 Not Found
```

### Scenario 4: Frontend confirmation and optimistic React Query invalidation
```gherkin
Given the user is on the Research Sessions list view
When the user clicks the Archive button on an active session card
Then a confirmation dialog appears explaining the action is reversible
When the user clicks "Hủy" (Cancel)
Then the dialog closes and no archive API call is made
When the user clicks "Xác nhận lưu trữ" (Confirm)
Then the button shows a loading spinner
And the archive API is called
And on success, the session list refreshes and removes the session from the active view
And the session appears when switching to the "Đã lưu trữ" tab
```

---

## 2. File Change Scope

### A. Backend Files
1. **[`backend/src/app/api/v1/endpoints/sessions.py`](file:///Users/mr.chem/Documents/Lap-trinh/creative-research-workbench/backend/src/app/api/v1/endpoints/sessions.py)**:
   - Cập nhật `list_sessions`: Thêm `include_archived: bool = False` và loại bỏ `archived` khi `status is None`.
   - Thêm `POST /api/v1/sessions/{session_id}/archive`.
   - Thêm `POST /api/v1/sessions/{session_id}/restore`.
2. **[`backend/tests/integration/test_session_lifecycle.py`](file:///Users/mr.chem/Documents/Lap-trinh/creative-research-workbench/backend/tests/integration/test_session_lifecycle.py)** (New Test Suite):
   - Test archive session.
   - Test restore session.
   - Test 404 error handling.
   - Test list filtering with archive exclusion.

### B. Frontend Files
1. **[`apps/web/lib/api-client.ts`](file:///Users/mr.chem/Documents/Lap-trinh/creative-research-workbench/apps/web/lib/api-client.ts)**:
   - Thêm hàm `archiveSession(sessionId: string): Promise<ResearchSession>`.
   - Thêm hàm `restoreSession(sessionId: string): Promise<ResearchSession>`.
   - Cập nhật tham số `include_archived?: boolean` trong `listSessions`.
2. **[`apps/web/features/session/session-list.tsx`](file:///Users/mr.chem/Documents/Lap-trinh/creative-research-workbench/apps/web/features/session/session-list.tsx)**:
   - Thêm tab chuyển đổi: `Tất cả hoạt động` vs `Đã lưu trữ`.
   - Thêm nút Archive trên từng thẻ Session đang hoạt động.
   - Thêm nút Restore trên từng thẻ Session đã lưu trữ.
   - Thêm Confirmation Dialog tùy biến (Accessible Dialog, không dùng alert/confirm browser).
   - Hook mutations `archiveMutation` & `restoreMutation`.
3. **[`apps/web/features/session/__tests__/session-list.test.tsx`](file:///Users/mr.chem/Documents/Lap-trinh/creative-research-workbench/apps/web/features/session/__tests__/session-list.test.tsx)**:
   - Thêm test suite kiểm thử luồng Archive & Restore, kiểm tra dialog xác nhận và chuyển tab.

---

## 3. Step-by-Step Implementation Strategy

```
[Phase 5.9 Workflow]
1. Observe & Spec (DONE)
   ├── docs/PHASE_5.9_SESSION_LIFECYCLE_SPEC.md
   └── docs/PHASE_5.9_SESSION_LIFECYCLE_PLAN.md
2. Human-in-the-Loop Gate (WAITING APPROVAL)
3. Step 1 (Backend Test-First):
   ├── Viết backend tests trong test_session_lifecycle.py
   └── Chạy test (RED)
4. Step 2 (Backend Implementation):
   ├── Thêm routes /archive và /restore trong sessions.py
   ├── Cập nhật list_sessions filtering logic
   └── Chạy test (GREEN)
5. Step 3 (Frontend Test-First & Implementation):
   ├── Viết frontend tests cho archive/restore dialog & tab filter
   ├── Thêm archiveSession & restoreSession vào api-client.ts
   ├── Cập nhật session-list.tsx với UI Dialog & Tabs
   └── Chạy test (GREEN)
6. Step 4 (Full Verification):
   ├── Docker rebuild & live smoke test
   └── Xác nhận zero data loss & full restorable capabilities
```
