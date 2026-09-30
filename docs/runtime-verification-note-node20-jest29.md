# Runtime Verification & Tooling Stabilization Note (Node 20 LTS + Jest 29)

## 1. Bối cảnh
Trong quá trình triển khai và kiểm thử Phase 5.3c (Search & Filter Enhancement) cho ứng dụng `apps/web` (Next.js 14 + React 18 + Jest 29), môi trường hệ thống ban đầu sử dụng Node.js `v26.4.0` đã gây ra các lỗi không tương thích ở tầng runtime CLI và Jest test runner.

Tài liệu này ghi nhận nguyên nhân kỹ thuật, giải pháp ổn định hóa runtime và các khuyến nghị vận hành cho contributor.

---

## 2. Triệu chứng lỗi dưới Node.js v26.4.0
Khi chạy các lệnh build và test trên Node.js v26.4.0:
1. **Next.js CLI Loader Error (`next build`):**
   - Lỗi: `TypeError: Class extends value undefined is not a constructor or null` tại `next/dist/bin/next` (`_commander.Command`).
   - Lỗi: `TypeError: (0 , _env.loadEnvConfig) is not a function` tại `next/dist/server/config.js`.
   - Nguyên nhân: Cơ chế CJS module evaluation/lexer mới trong Node.js v26 xung đột với dynamic require và namespace interop của Next.js 14.2.3.
2. **Jest Runner & JSDOM Mismatch (`npm test`):**
   - Lỗi: `TypeError: (0 , _core(...).runCLI) is not a function` và `TypeError: (0 , _normalize.default) is not a function`.
   - Nguyên nhân: Sự phân mảnh dependency giữa `jest@29.7.0` và `jest-environment-jsdom@^30.5.2` (Jest 30 canary kéo transitive packages `@jest/core@30` và `jest-config@30`).

---

## 3. Runtime tương thích chuẩn: Node.js 20 Active LTS
- **Runtime được chọn:** Node.js `v20.20.2` (Node 20 LTS).
- **Lý do:** Đây là môi trường runtime chuẩn được Next.js 14 và Jest 29 hỗ trợ chính thức và ổn định nhất, đảm bảo tương thích 100% với toàn bộ pipeline build, type-check và test suites.

---

## 4. Quyết định Dependency (Tooling Alignment)
1. **Giữ phiên bản Jest:** `jest@^29.7.0`
2. **Đồng bộ JSDOM Environment:** Pin `jest-environment-jsdom` về `^29.7.0` (thay vì version 30) để đảm bảo đồng nhất major version trong toàn bộ cây dependency của Jest.

---

## 5. Đánh giá tác động
- **Production Code:** Không thay đổi bất kỳ logic nghiệp vụ hay runtime behavior nào trong `apps/web/features/session/` hoặc `apps/web/app/`.
- **Package Lock Churn:** File `apps/web/package-lock.json` được cập nhật sạch sẽ (clean install) để loại bỏ các transitive dependency thừa từ Jest 30. Đây là thay đổi tooling dự kiến và an toàn.
- **Verification Matrix:**
  - `npm test`: 18/18 tests PASS (bao gồm toàn bộ SessionList read/create/filter tests).
  - `npm run type-check`: PASS (0 lỗi).
  - `npm run build`: PASS (Production build thành công 5/5 static pages).

---

## 6. Khuyến nghị cho Contributor
- **Khuyến nghị:** Sử dụng **Node.js 20 LTS** (hoặc Node.js 18+) khi cài đặt, phát triển và chạy verification test trong `apps/web`.
- **Cảnh báo:** Tránh sử dụng các bản Node.js experimental/future (như Node.js 26) cho frontend stack hiện tại (Next.js 14 / Jest 29) để tránh các lỗi phá vỡ tương thích CJS loader.
