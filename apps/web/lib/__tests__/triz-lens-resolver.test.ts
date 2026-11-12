import { resolveLensFromDomain } from '../triz-lens-resolver'
import type { TrizNineWindowsLens } from '@/lib/types'

describe('TRIZ Lens Resolver — Batch C5 (Context Mapping)', () => {
  // 1. business -> business
  it('1. test_resolves_business_domain_to_business_lens: domain "business" ánh xạ chính xác sang lens "business"', () => {
    expect(resolveLensFromDomain('business')).toBe('business')
  })

  // 2. life, personal -> everyday
  it('2. test_resolves_life_and_personal_domains_to_everyday_lens: domain "life" và "personal" ánh xạ sang lens "everyday"', () => {
    expect(resolveLensFromDomain('life')).toBe('everyday')
    expect(resolveLensFromDomain('personal')).toBe('everyday')
  })

  // 3. culture, society -> everyday
  it('3. test_resolves_culture_and_society_domains_to_everyday_lens: domain "culture" và "society" ánh xạ sang lens "everyday"', () => {
    expect(resolveLensFromDomain('culture')).toBe('everyday')
    expect(resolveLensFromDomain('society')).toBe('everyday')
  })

  // 4. technical, software, research, education -> engineering
  it('4. test_resolves_technical_software_research_and_education_domains_to_engineering_lens: technical, software, research, education ánh xạ sang "engineering"', () => {
    expect(resolveLensFromDomain('technical')).toBe('engineering')
    expect(resolveLensFromDomain('software')).toBe('engineering')
    expect(resolveLensFromDomain('research')).toBe('engineering')
    expect(resolveLensFromDomain('education')).toBe('engineering')
  })

  // 5. null, undefined, empty, whitespace, unknown -> engineering
  it('5. test_falls_back_to_engineering_for_null_undefined_empty_whitespace_and_unknown_domains: fallback an toàn về "engineering"', () => {
    expect(resolveLensFromDomain(null)).toBe('engineering')
    expect(resolveLensFromDomain(undefined)).toBe('engineering')
    expect(resolveLensFromDomain('')).toBe('engineering')
    expect(resolveLensFromDomain('   ')).toBe('engineering')
    expect(resolveLensFromDomain('unknown_custom_domain')).toBe('engineering')
    expect(resolveLensFromDomain('random-domain-123')).toBe('engineering')
  })

  // 6. Normalization: case and whitespace
  it('6. test_normalizes_case_and_whitespace_before_mapping: chuẩn hóa trim khoảng trắng và lowercase trước khi ánh xạ', () => {
    expect(resolveLensFromDomain('  BUSINESS  ')).toBe('business')
    expect(resolveLensFromDomain('Business')).toBe('business')
    expect(resolveLensFromDomain('  LiFe ')).toBe('everyday')
    expect(resolveLensFromDomain('PERSONAL')).toBe('everyday')
    expect(resolveLensFromDomain('\tTechnical\n')).toBe('engineering')
  })

  // 7. Pure function: does not mutate input or have side-effects
  it('7. test_is_pure_and_does_not_mutate_input: hàm thuần túy, tính toán tất định không phụ thuộc ngữ cảnh bên ngoài', () => {
    const input = 'business'
    const result1 = resolveLensFromDomain(input)
    const result2 = resolveLensFromDomain(input)
    expect(result1).toBe(result2)
    expect(input).toBe('business')
  })
})
