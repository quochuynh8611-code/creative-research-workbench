import fs from 'fs'
import path from 'path'
import config from '../../tailwind.config'

describe('RootLayout and Typography Configuration', () => {
  it('does not import or use next/font/google in layout.tsx', () => {
    const layoutPath = path.resolve(__dirname, '../layout.tsx')
    const layoutContent = fs.readFileSync(layoutPath, 'utf8')
    expect(layoutContent).not.toContain("from 'next/font/google'")
    expect(layoutContent).not.toContain('--font-inter')
  })

  it('configures system font stack without depending on --font-inter', () => {
    const fontFamily = config.theme?.extend?.fontFamily as Record<string, string[]> | undefined
    const sansFonts = fontFamily?.sans
    expect(sansFonts).toBeDefined()
    expect(sansFonts).not.toContain('var(--font-inter)')
  })
})
