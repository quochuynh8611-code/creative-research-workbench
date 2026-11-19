---
title: "ADR-018 — Founder Experience Validation & UX Hardening"
topic: "architecture-decision-record"
source_type: "adr"
language: "vi"
tags: ["adr", "c37", "ux", "quality", "feedback-loop"]
status: "Proposed"
created: "2026-11-19"
---

# ADR-018 — Founder Experience Validation & UX Hardening

## Status

Proposed

## Context

Sau Batch C35 và C36, Creative Research Workbench đã có 6 lens TRIZ 9-Windows, 3 Workflow Profiles, 18 domain templates, multi-lens frontend, domain resolver, workflow persistence và export với provenance đầy đủ.

Local stack đang chạy với PostgreSQL, API và frontend; AI Provider đang ở Mock mode. Founder đang kiểm tra trực tiếp sản phẩm tại `http://localhost:3011`.

Tại thời điểm này, chưa có danh sách bug/UX issue/feature request cụ thể từ Founder. Vì vậy, việc tự chọn một hướng mở rộng tính năng lớn có rủi ro xây dựng sai nhu cầu và làm tăng bề mặt kiểm thử mà không giải quyết vấn đề thực tế.

## Decision

Chọn **Founder Experience Validation & UX Hardening** làm phạm vi Batch C37.

C37 sẽ:

1. Chuẩn hóa quy trình Founder testing và feedback intake.
2. Kiểm chứng các luồng cốt lõi trên local stack.
3. Phân loại và ưu tiên issue theo severity và blast radius.
4. Chỉ sửa các lỗi nhỏ đã được xác nhận, theo test-first.
5. Chuyển các product gap lớn sang C38 Planning/Discovery.

## Alternatives Considered

### Option A — Founder Experience Validation & UX Hardening

- Ưu điểm: blast radius thấp, trực tiếp bảo vệ chất lượng sản phẩm, tạo input chất lượng cho batch tiếp theo.
- Nhược điểm: không tạo tính năng mới ngay lập tức.

### Option B — Product Value Completion

- Ưu điểm: có thể mở rộng trải nghiệm end-to-end.
- Nhược điểm: thiếu input Founder cụ thể; dễ suy đoán sai ưu tiên và tăng phạm vi.

### Option C — Reliability & Operations Expansion

- Ưu điểm: tăng độ tin cậy hạ tầng.
- Nhược điểm: hệ thống đã có observability, benchmark, migration verification và runbook; chưa có bằng chứng ops issue cấp bách từ Founder.

### Option D — AI Capability Expansion

- Ưu điểm: tăng giá trị AI.
- Nhược điểm: cần kiểm soát chi phí, độ chính xác, grounding và UX phê duyệt; chưa phù hợp khi Founder chưa báo cáo vấn đề.

## Consequences

### Positive

- Founder testing trở thành nguồn yêu cầu có cấu trúc.
- Giảm nguy cơ behavioral drift và regression sau C35/C36.
- Mỗi thay đổi nhỏ có test-first và blast radius được kiểm soát.
- Không phát sinh chi phí AI token vì vẫn dùng Mock mode.

### Negative

- C37 không tạo tính năng mới lớn.
- Cần Founder dành thời gian kiểm thử và phản hồi.
- Một số product gap có thể phải hoãn sang C38.

## Reversibility

Đây là quyết định **hai chiều**:

- Checklist, issue log và tài liệu có thể điều chỉnh dễ dàng.
- Các fix nhỏ được tách PR riêng và có thể revert độc lập.
- Không thay đổi schema, API contract, dependency hay hạ tầng production.

## Guardrails

- Không commit/push/PR/deploy/merge nếu chưa có lệnh Founder.
- Không thay đổi schema/backend runtime.
- Không thêm dependency mới.
- Không commit secret.
- Không bật real AI provider trong C37.
- Mọi P0/P1 fix phải có failing test trước khi sửa.
- Mọi PR phải có phạm vi hẹp, mô tả rõ và test GREEN.
