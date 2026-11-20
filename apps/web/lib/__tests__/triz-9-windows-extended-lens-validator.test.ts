import { validateTriz9WindowsContext } from '../triz-9-windows-context-validator'

describe('Lô 3: Extended-Lens Save Context Validator Specification (C38-GAP-03)', () => {
  const extendedLenses = ['systems_thinking', 'design_thinking', 'lean_startup'] as const
  const baselineLenses = ['engineering', 'business', 'everyday'] as const

  extendedLenses.forEach((lens) => {
    it(`3.1.1 Chấp nhận context hợp lệ cho lăng kính mở rộng: ${lens}`, () => {
      const candidate = {
        schema_version: 1,
        source_type: 'triz_9_windows',
        lens: lens,
        level: 'system',
        time: 'future',
        cell_label: 'Hệ thống thích ứng động tương lai',
      }

      const result = validateTriz9WindowsContext(candidate)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.lens).toBe(lens)
        expect(result.data.cell_label).toBe('Hệ thống thích ứng động tương lai')
      }
    })
  })

  baselineLenses.forEach((lens) => {
    it(`3.1.2 Bảo toàn context hợp lệ cho lăng kính nền tảng: ${lens}`, () => {
      const candidate = {
        schema_version: 1,
        source_type: 'triz_9_windows',
        lens: lens,
        level: 'supersystem',
        time: 'present',
        cell_label: 'Hạ tầng hiện tại',
      }

      const result = validateTriz9WindowsContext(candidate)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.lens).toBe(lens)
      }
    })
  })

  it('3.1.3 Từ chối lăng kính lạ không thuộc 6 lăng kính', () => {
    const candidate = {
      schema_version: 1,
      source_type: 'triz_9_windows',
      lens: 'quantum_physics',
      level: 'system',
      time: 'present',
      cell_label: 'Ô không hợp lệ',
    }

    const result = validateTriz9WindowsContext(candidate)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('lens')
    }
  })
})
