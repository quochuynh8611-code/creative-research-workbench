# Specification: Phase 10.2 — Backend Cross-Session Knowledge Discovery

## 1. Giới thiệu & Mục tiêu
- **Mã định danh:** Phase 10.2 (Increment 1 - Backend Core)
- **Mục tiêu:** Cung cấp endpoint tìm kiếm các phiên nghiên cứu tương đồng (`ResearchSession`) dựa trên cấu trúc bài toán TRIZ (`ProblemFrame`, `Contradiction`, parameters) của phiên hiện tại.
- **Phạm vi Increment 1:**
  - Dedicated service: `CrossSessionDiscoveryService` (tách biệt hoàn toàn với `RetrievalService`).
  - Endpoint: `GET /api/v1/search/cross-session`
  - Chấm điểm tương đồng theo phương pháp xác định (Deterministic Structural Scoring), không phụ thuộc external API/embedding.
  - Xử lý biên triệt để: không self-match, loại trừ session `archived`, trả 200 OK rỗng có `reason="no_problem_frame"` khi session nguồn chưa có problem frame, trả 404 khi session không tồn tại.

---

## 2. API Contract

### 2.1 Endpoint
```http
GET /api/v1/search/cross-session?session_id={uuid}&top_k=5&min_score=0.2
```

### 2.2 Query Parameters
| Tham số | Kiểu dữ liệu | Mặc định | Giới hạn | Mô tả |
|---|---|---|---|---|
| `session_id` | `uuid.UUID` | *(Bắt buộc)* | UUID v4 hợp lệ | ID của phiên nghiên cứu nguồn cần tìm liên kết |
| `top_k` | `int` | `5` | `1 <= top_k <= 50` | Số lượng kết quả tối đa trả về |
| `min_score` | `float` | `0.1` | `0.0 <= min_score <= 1.0` | Ngưỡng điểm tương đồng tối thiểu để đưa vào kết quả |

### 2.3 Response Schema (`200 OK`)
```json
{
  "source_session_id": "8f3b145a-3829-4d62-9844-369b769f7831",
  "has_problem_frame": true,
  "reason": null,
  "matched_sessions": [
    {
      "session_id": "c7a1029b-8147-4950-a925-1e3c880858e6",
      "title": "Tối ưu hóa hệ thống tản nhiệt pin",
      "domain": "engineering",
      "status": "active",
      "similarity_score": 0.85,
      "match_reasons": [
        "Trùng thông số cải thiện: Speed",
        "Trùng thông số xấu đi: Strength",
        "Trùng loại mâu thuẫn: technical",
        "Cùng lĩnh vực: engineering",
        "Trùng 2 nguyên tắc TRIZ đề xuất (#1, #35)"
      ],
      "shared_parameters": {
        "improving_parameter": "Speed",
        "worsening_parameter": "Strength",
        "contradiction_type": "technical",
        "shared_principles": [1, 35]
      },
      "created_at": "2026-10-01T10:00:00Z"
    }
  ],
  "total_candidates_analyzed": 12,
  "latency_ms": 14.5
}
```

### 2.4 Trường hợp đặc biệt (No Problem Frame)
Khi session nguồn chưa cấu trúc bài toán:
```json
{
  "source_session_id": "8f3b145a-3829-4d62-9844-369b769f7831",
  "has_problem_frame": false,
  "reason": "no_problem_frame",
  "matched_sessions": [],
  "total_candidates_analyzed": 0,
  "latency_ms": 2.1
}
```

### 2.5 Error Codes
- `404 Not Found`: Khi `session_id` không tồn tại trong DB.
  ```json
  {"detail": "Session with id '...' not found"}
  ```
- `422 Unprocessable Entity`: Khi `session_id` không phải UUID hoặc `top_k` / `min_score` vượt ngoài validation constraints.

---

## 3. Thuật toán Deterministic Structural Scoring

Điểm tương đồng $S \in [0.0, 1.0]$ giữa Source Problem Frame ($P_{src}$) và Target Candidate Problem Frame ($P_{tgt}$) được tính toán theo trọng số có tổng bằng 1.0:

1. **Improving Parameter Match ($W_1 = 0.25$):**
   - $P_{src}.improving\_parameter == P_{tgt}.improving\_parameter \implies +0.25$
2. **Worsening Parameter Match ($W_2 = 0.25$):**
   - $P_{src}.worsening\_parameter == P_{tgt}.worsening\_parameter \implies +0.25$
3. **Contradiction Type Match ($W_3 = 0.20$):**
   - $P_{src}.contradiction\_type == P_{tgt}.contradiction\_type$ (loại trừ `unknown`/`none`) $\implies +0.20$
4. **Domain Match ($W_4 = 0.15$):**
   - $P_{src}.domain.lower() == P_{tgt}.domain.lower() \implies +0.15$
5. **TRIZ Suggested Principles Overlap ($W_5 = 0.15$):**
   - Tính hệ số Jaccard Similarity giữa 2 tập nguyên tắc: $\frac{|Principles_{src} \cap Principles_{tgt}|}{|Principles_{src} \cup Principles_{tgt}|} \times 0.15$

### Quy tắc sắp xếp ổn định (Stable Ordering)
Kết quả trả về được sắp xếp theo:
1. `similarity_score` giảm dần (DESC)
2. `created_at` giảm dần (DESC)
3. `session_id` tăng dần (ASC) để đảm bảo tính tất định 100%.

---

## 4. Bảo vệ hiệu năng & Chống N+1 Query

- Truy vấn lấy candidates trong 1 single SQL query với Eager Loading:
  ```python
  stmt = (
      select(ResearchSession)
      .options(
          joinedload(ResearchSession.problem_frames).joinedload(ProblemFrame.contradictions)
      )
      .where(
          ResearchSession.id != source_session_id,
          ResearchSession.status != SessionStatus.archived
      )
  )
  ```
- Không gọi external network API, không tải vector ngoại lai.
