import { resolveLensFromDomain } from '../triz-lens-resolver'

describe('TRIZ Lens Resolver Expansion — Batch C35', () => {
  it('1. test_resolves_healthcare_domain_to_systems_thinking_lens', () => {
    expect(resolveLensFromDomain('healthcare')).toBe('systems_thinking')
    expect(resolveLensFromDomain('HealthCare')).toBe('systems_thinking')
    expect(resolveLensFromDomain('  healthcare  ')).toBe('systems_thinking')
  })

  it('2. test_resolves_education_domain_to_design_thinking_lens', () => {
    expect(resolveLensFromDomain('education')).toBe('design_thinking')
    expect(resolveLensFromDomain('EDUCATION')).toBe('design_thinking')
    expect(resolveLensFromDomain('  education ')).toBe('design_thinking')
  })

  it('3. test_resolves_sustainability_domain_to_systems_thinking_lens', () => {
    expect(resolveLensFromDomain('sustainability')).toBe('systems_thinking')
    expect(resolveLensFromDomain('Sustainability')).toBe('systems_thinking')
    expect(resolveLensFromDomain('  sustainability  ')).toBe('systems_thinking')
  })

  it('4. test_preserves_classic_domain_mappings', () => {
    expect(resolveLensFromDomain('business')).toBe('business')
    expect(resolveLensFromDomain('technical')).toBe('engineering')
    expect(resolveLensFromDomain('life')).toBe('everyday')
  })
})
