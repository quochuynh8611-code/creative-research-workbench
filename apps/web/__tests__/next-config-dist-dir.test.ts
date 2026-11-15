import path from 'path'
import {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_BUILD,
  PHASE_PRODUCTION_SERVER,
} from 'next/constants'

type NextConfigFn = (
  phase: string,
  context: { defaultConfig: Record<string, unknown> }
) => Promise<Record<string, unknown>> | Record<string, unknown>

type NextConfigExport = Record<string, unknown> | NextConfigFn

async function loadResolvedConfig(phase: string): Promise<Record<string, unknown>> {
  const configPath = path.resolve(__dirname, '../next.config.mjs')
  const mod = await import(configPath)
  const configExport = (mod.default ?? mod) as NextConfigExport

  if (typeof configExport === 'function') {
    return await configExport(phase, { defaultConfig: {} })
  }
  return configExport
}

describe('Next.js Config distDir Isolation', () => {
  const originalApiBaseUrl = process.env.API_BASE_URL

  afterEach(() => {
    if (originalApiBaseUrl === undefined) {
      delete process.env.API_BASE_URL
    } else {
      process.env.API_BASE_URL = originalApiBaseUrl
    }
  })

  it('(a) PHASE_DEVELOPMENT_SERVER -> distDir ".next-dev"', async () => {
    const config = await loadResolvedConfig(PHASE_DEVELOPMENT_SERVER)
    expect(config.distDir).toBe('.next-dev')
  })

  it('(b) PHASE_PRODUCTION_BUILD -> distDir ".next" (default) và output "standalone"', async () => {
    const config = await loadResolvedConfig(PHASE_PRODUCTION_BUILD)
    expect(config.distDir ?? '.next').toBe('.next')
    expect(config.output).toBe('standalone')
  })

  it('(c) PHASE_PRODUCTION_SERVER -> distDir ".next" (default)', async () => {
    const config = await loadResolvedConfig(PHASE_PRODUCTION_SERVER)
    expect(config.distDir ?? '.next').toBe('.next')
  })

  it('(d) rewrites /api/:path* fallback http://localhost:8000/api/:path* khi API_BASE_URL chưa đặt', async () => {
    delete process.env.API_BASE_URL
    const config = await loadResolvedConfig(PHASE_PRODUCTION_BUILD)

    expect(typeof config.rewrites).toBe('function')
    const rewritesFn = config.rewrites as () => Promise<Array<{ source: string; destination: string }>>
    const rewrites = await rewritesFn()

    expect(rewrites).toEqual(
      expect.arrayContaining([
        {
          source: '/api/:path*',
          destination: 'http://localhost:8000/api/:path*',
        },
      ])
    )
  })
})
