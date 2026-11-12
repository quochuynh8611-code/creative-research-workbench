import type { TrizNineWindowsLens } from '@/lib/types'

const DOMAIN_TO_LENS_MAP: Record<string, TrizNineWindowsLens> = {
  business: 'business',
  life: 'everyday',
  personal: 'everyday',
  culture: 'everyday',
  society: 'everyday',
  technical: 'engineering',
  software: 'engineering',
  research: 'engineering',
  education: 'engineering',
}

export function resolveLensFromDomain(
  domain?: string | null,
): TrizNineWindowsLens {
  if (!domain) {
    return 'engineering'
  }

  const normalized = domain.trim().toLowerCase()
  return DOMAIN_TO_LENS_MAP[normalized] ?? 'engineering'
}
