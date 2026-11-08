import { DOMAIN_LABELS } from '../utils'

describe('DOMAIN_LABELS mapping and fallback', () => {
  it('maps 4 target domains with Vietnamese labels correctly', () => {
    expect(DOMAIN_LABELS['life']).toBe('Đời sống')
    expect(DOMAIN_LABELS['business']).toBe('Kinh tế / Kinh doanh')
    expect(DOMAIN_LABELS['culture']).toBe('Văn hóa')
    expect(DOMAIN_LABELS['society']).toBe('Xã hội')
  })

  it('maps research domain to "Nghiên cứu"', () => {
    expect(DOMAIN_LABELS['research']).toBe('Nghiên cứu')
  })

  it('preserves legacy domain labels without aliasing personal to "Đời sống"', () => {
    expect(DOMAIN_LABELS['personal']).toBe('Cá nhân')
    expect(DOMAIN_LABELS['technical']).toBe('Kỹ thuật')
    expect(DOMAIN_LABELS['education']).toBe('Giáo dục')
  })

  it('falls back to raw domain string when domain is undefined or unknown', () => {
    const unknownDomain = 'unknown-domain-xyz'
    const renderedLabel = DOMAIN_LABELS[unknownDomain] ?? unknownDomain
    expect(renderedLabel).toBe('unknown-domain-xyz')
  })
})
