# Batch C5 — Context Mapping: Domain to 9-Windows Lens

## 1. Purpose
Preselect the appropriate TRIZ 9-Windows lens from the normalized problem-frame domain without overriding a user’s manual lens selection.

## 2. Decision
Use a pure, explicit, deterministic resolver:
`resolveLensFromDomain(domain?: string | null): TrizNineWindowsLens`

## 3. Mapping Contract
- `business` -> `business`
- `life` -> `everyday`
- `personal` -> `everyday`
- `culture` -> `everyday`
- `society` -> `everyday`
- `technical` -> `engineering`
- `software` -> `engineering`
- `research` -> `engineering`
- `education` -> `engineering`
- `null`, `undefined`, empty string, whitespace-only, unknown -> `engineering`

## 4. Normalization Rule
- Trim whitespace.
- Lowercase before comparison.
- Do not use substring matching.
- Do not use fuzzy matching.
- Do not infer from partial words.

## 5. Component Contract
`TrizNineWindowsProps` thêm:
```ts
initialLens?: TrizNineWindowsLens
```

Ràng buộc:
- Default `initialLens = 'engineering'`.
- `initialLens` chỉ dùng làm giá trị khởi tạo `activeLens`.
- KHÔNG dùng `useEffect` để reset `activeLens` theo domain.
- Sau khi người dùng đổi lens, re-render phải bảo toàn lựa chọn thủ công.
- Standalone route không truyền `initialLens` nên vẫn `engineering`.

## 6. NormalizedView Contract
- Gọi `resolveLensFromDomain(problemFrame.domain)`.
- Truyền kết quả vào `TrizNineWindows` qua prop `initialLens`.
- KHÔNG lưu lens selection vào state của `NormalizedView`.
- KHÔNG ghi đè lựa chọn người dùng.

## 7. Forbidden Behavior
- Không persistence.
- Không `localStorage`/`sessionStorage`/`IndexedDB`.
- Không substring/fuzzy matching.
- Không đổi backend/API/DB/migration/FSM/route.
- Không đổi `NoteDraft`/`Notebook`.
- Không tự reset lens theo domain sau khi người dùng đã chọn.

## 8. Test Plan — RED
Tạo 18 test RED theo danh sách đã duyệt:
1. `test_resolves_business_domain_to_business_lens`
2. `test_resolves_life_and_personal_domains_to_everyday_lens`
3. `test_resolves_culture_and_society_domains_to_everyday_lens`
4. `test_resolves_technical_software_research_and_education_domains_to_engineering_lens`
5. `test_falls_back_to_engineering_for_null_undefined_empty_whitespace_and_unknown_domains`
6. `test_normalizes_case_and_whitespace_before_mapping`
7. `test_is_pure_and_does_not_mutate_input`
8. `test_accepts_initial_lens_prop`
9. `test_defaults_to_engineering_when_initial_lens_is_omitted`
10. `test_allows_manual_lens_switch_after_initial_lens`
11. `test_does_not_reset_manual_lens_selection_on_re_render`
12. `test_preselects_business_lens_when_problem_frame_domain_is_business`
13. `test_preselects_everyday_lens_when_problem_frame_domain_is_life`
14. `test_preselects_everyday_lens_when_problem_frame_domain_is_culture`
15. `test_preselects_everyday_lens_when_problem_frame_domain_is_society`
16. `test_preselects_engineering_lens_for_technical_domain`
17. `test_preselects_engineering_lens_for_missing_domain`
18. `test_replaces_previous_no_mapping_contract_with_initial_lens_contract`
