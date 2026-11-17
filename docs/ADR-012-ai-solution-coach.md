# ADR-012: KIẾN TRÚC AI SOLUTION COACH & HUMAN-CONTROLLED GROUNDED SUGGESTIONS

**Trạng thái:** Proposed (Đang trình duyệt Founder)  
**Ngày:** 2026-11-17  
**Phạm vi:** Backend AI Services, API REST Gateway, Frontend Session Workspace  
**Tác giả:** Senior AI Product Engineer / Technical Architect  
**Liên quan:** [BATCH_C31_AI_COACH_SPEC.md](BATCH_C31_AI_COACH_SPEC.md), [ADR-011-productization-ai-configuration.md](ADR-011-productization-ai-configuration.md), [ADR-005-phase-9a-export-and-synthesis.md](ADR-005-phase-9a-export-and-synthesis.md)

---

## 1. Bối Cảnh (Context)

Sau khi hoàn thành Batch C30 (cấu hình AI đa nguồn an toàn, hệ thống chỉ báo trạng thái AI, giao diện Onboarding và các Modal xác nhận an toàn), Creative Research Workbench (CRW) cần một tính năng cốt lõi giúp người nghiên cứu giải phóng sức sáng tạo: **AI Solution Coach**.

Trong nghiên cứu sáng chế và giải quyết vấn đề bằng phương pháp TRIZ, rào cản lớn nhất của con người là:
1. Độ ỳ tâm lý (Psychological Inertia): Quen với lối mòn tư duy hiện tại, khó nhìn ra mâu thuẫn ẩn.
2. Khó khăn trong việc liên kết các nguyên tắc sáng tạo trừu tượng (như *Phân nhỏ*, *Linh hoạt hóa*, *Kết hợp*) vào bối cảnh cụ thể của ngành hàng (Logistics, Nông nghiệp, Thực phẩm, Công nghệ).

Tuy nhiên, việc đưa AI vào quy trình giải quyết vấn đề sáng tạo tiềm ẩn các nguy cơ:
- **Ảo giác (Hallucination):** AI sinh ra các giải pháp ngụy khoa học, không có căn cứ thực tế.
- **Tự tiện ghi đè (Auto-Overwrite):** AI tự động chèn dữ liệu vào bảng giải pháp hoặc ghi chú làm ô nhiễm dữ liệu nghiên cứu của con người.
- **Tắc nghẽn hệ thống (Provider Outage):** Khi nhà cung cấp AI gặp lỗi, hệ thống bị treo hoặc mất chức năng.

Hệ thống cần một quyết định kiến trúc chuẩn mực để hiện thực hóa AI Solution Coach vừa mạnh mẽ, vừa an toàn tuyệt đối và có khả năng truy vết nguồn gốc 100%.

---

## 2. Quyết Định Kiến Trúc (Decisions)

### Quyết định 1: Mô hình Cố Vấn Tương Tác Hướng Con Người (Human-Empowering Advisor, Not Autonomous Agent)
- AI Coach được thiết kế như một **cố vấn chuyên môn phản biện (Advisory Assistant)**, tuyệt đối **KHÔNG phải là Autonomous Agent**.
- AI Coach không tự ý ra quyết định, không tự chuyển bước trong máy trạng thái (FSM), và không tự động mutate database.
- Giới hạn chặt chẽ: Mỗi lần gọi Coach trả về **tối đa 5 suggestions**, ưu tiên tính súc tích, liên quan cao và kiểm chứng được.
- Mọi gợi ý của AI Coach hiển thị ở dạng bản nháp xem trước (Preview-Only Ephemeral State).

### Quyết định 2: Kỷ Luật Grounding Cứng & Bounded Context (Hard Grounding & Bounded Input Context)
- Mỗi gợi ý (`CoachSuggestion`) bắt buộc phải đính kèm cấu trúc `source_grounding` hợp lệ trỏ tới 1 trong 4 loại căn cứ:
  - `source_type`: `contradiction` | `principle` | `evidence` | `note`
  - `source_reference`: Trích dẫn rõ ràng cơ sở lý luận (ví dụ: *"Mâu thuẫn kỹ thuật: Tốc độ vs Chi phí"* hoặc *"Nguyên tắc TRIZ #1: Phân nhỏ"*).
- Nếu gợi ý không có căn cứ hoặc căn cứ rỗng: **Bắt buộc loại bỏ khỏi kết quả, không hiển thị cho người dùng**.
- Ngữ cảnh đầu vào được giới hạn chặt chẽ (Bounded Context): Chỉ gửi các trường cần thiết trong session (`title`, `domain`, `ProblemFrame`, top candidate solutions/notes, recommended principles); tuyệt đối không gửi metadata hệ thống, secret, API key hay token.

### Quyết định 3: Zero Auto-Overwrite, Rate Limiting & Human Confirmation Gate
- Lệnh gọi AI Coach (`POST /api/v1/sessions/{session_id}/coach/suggestions`) là một thao tác **thuần truy vấn (Pure Query)**, không tạo dòng mới trong database (Zero DB Side-effects).
- Áp dụng kiểm soát tần suất và idempotency: Khi client gửi nhiều request dồn dập, chỉ trả lời phân tích logic an toàn, không tạo mutations.
- Khi người dùng muốn chuyển đổi một gợi ý thành `CandidateSolution` hoặc `ResearchNote`, hệ thống kích hoạt **Confirmation Modal** (tái sử dụng kiến trúc từ Batch C30) để yêu cầu người dùng xác nhận rõ ràng trước khi gọi mutation API sẵn có.

### Quyết định 4: Cơ Chế Dự Phòng Hai Tầng & Minh Bạch Nguồn Gốc (Dual-Layer Fallback & Clear Provenance)
- **Tầng 1 (Primary AI):** Gọi mô hình LLM đã cấu hình (OpenAI `gpt-4o-mini` hoặc Ollama cục bộ) với timeout tối đa 10 giây và 2 lần retry giới hạn. Provenance ghi nhận: `ai_coach`.
- **Tầng 2 (Rule-Based Fallback):** Nếu LLM không khả dụng (thiếu key, hết quota, timeout, lỗi mạng, malformed JSON hoặc `LLM_PROVIDER=mock`), hệ thống tự động kích hoạt `RuleBasedCoach`.
- **Nguyên tắc Provenance:** Rule-Based Coach **KHÔNG PHẢI LÀ AI**. Hệ thống bắt buộc phân biệt rõ ràng nhãn nguồn gốc:
  - `ai_coach`: Gợi ý sinh từ mô hình AI thật.
  - `rule_based_fallback`: Gợi ý từ bộ quy tắc TRIZ Heuristic cục bộ.
- UI hiển thị rõ ràng nguồn gốc để người nghiên cứu hoàn toàn minh bạch về cơ sở của gợi ý.

### Quyết định 5: Bảo Toàn Schema Cơ Sở Dữ Liệu Hiện Hành (Zero Schema Mutation)
- Không tạo bảng mới, không thêm cột mới trong PostgreSQL.
- Dữ liệu gợi ý được quản lý tạm thời tại frontend React Query cache (`['coach-suggestions', sessionId]`).
- Tận dụng 100% các bảng và endpoint hiện có (`candidate_solutions`, `research_notes`).

---

## 3. Các Phương Án Bị Loại Bỏ (Rejected Alternatives)

1. **Phương án AI Agent Tự Hành (Autonomous Agent Pattern):**
   - *Lý do loại bỏ:* Tạo nguy cơ cao về việc AI tự ý tạo và sửa đổi các giải pháp nghiên cứu mà con người chưa kịp đánh giá, vi phạm Hiến pháp vận hành và nguyên tắc an toàn dữ liệu.
2. **Phương án Lưu Gợi Ý Vào Bảng Database Riêng (`coach_suggestions` table):**
   - *Lý do loại bỏ:* Làm phức tạp hóa schema, đòi hỏi Alembic migration mới, tăng chi phí dọn dẹp dữ liệu rác (ephemeral data), trong khi người dùng có thể chưa muốn lưu các gợi ý đó.
3. **Phương án Trả Về Văn Bản Tự Do (Raw Unstructured LLM Markdown):**
   - *Lý do loại bỏ:* Frontend không thể bóc tách thành các hành động độc lập (Accept, Dismiss, Convert to Solution, Convert to Note); không kiểm soát được việc trích dẫn nguồn gốc.

---

## 4. Hệ Quả Kỹ Thuật (Consequences)

### Tích cực:
- **Độ tin cậy tuyệt đối:** Hệ thống hoạt động mượt mà trong cả 3 chế độ (OpenAI, Ollama, và Offline Mock/Rule-based Fallback).
- **Trải nghiệm người dùng vượt trội:** Gợi ý được chia nhóm rõ ràng, có căn cứ giải thích tại sao lại đề xuất giải pháp này, biến TRIZ từ lý thuyết hàn lâm thành hành động cụ thể.
- **Zero blast radius:** Không rủi ro đối với cơ sở dữ liệu hiện tại, không có nguy cơ mất mát dữ liệu nghiên cứu.

### Hạn chế & Thách thức:
- Cần xây dựng prompt template và JSON schema parser chuẩn mực cho LLM client để đảm bảo cấu trúc trả về luôn hợp lệ.
- Phía frontend cần xử lý tốt state chuyển đổi gợi ý sang Solution/Note để tránh người dùng bấm lưu trùng lặp nhiều lần.

---

## 5. Chiến Lược Rollback (Rollback Strategy)

Do quyết định không thay đổi database schema:
1. Nếu phát hiện lỗi trong quá trình triển khai, chỉ cần rollback code phía backend service hoặc frontend panel về commit baseline `575221847b2b32d4f563dbc86a22f53688132776`.
2. Toàn bộ dữ liệu sessions, candidate solutions, research notes và vector embeddings trước đó vẫn giữ nguyên vẹn 100%.
