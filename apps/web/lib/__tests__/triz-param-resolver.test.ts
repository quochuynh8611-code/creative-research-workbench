import { resolveParamId, LEGACY_PARAM_ALIASES } from '../triz-param-resolver'

describe('triz-param-resolver', () => {
  const mockParams = [
    { id: 1, code: 'weight_moving', name_vi: 'Trọng lượng vật thể di động', name_en: 'Weight of moving object' },
    { id: 9, code: 'speed', name_vi: 'Tốc độ / Vận tốc', name_en: 'Speed' },
    { id: 14, code: 'strength', name_vi: 'Độ bền / Độ cứng', name_en: 'Strength' },
    { id: 22, code: 'loss_of_energy', name_vi: 'Hao tổn năng lượng', name_en: 'Waste of energy' },
    { id: 25, code: 'loss_of_time', name_vi: 'Hao tổn thời gian', name_en: 'Waste of time' },
    { id: 27, code: 'reliability', name_vi: 'Độ tin cậy', name_en: 'Reliability' },
    { id: 33, code: 'ease_of_operation', name_vi: 'Độ tiện lợi khi sử dụng', name_en: 'Ease of operation' },
  ]

  it('1. resolveParamId resolves legacy alias loss_of_money -> 22', () => {
    expect(resolveParamId('loss_of_money', mockParams)).toBe(22)
  })

  it('2. resolveParamId resolves legacy alias duration_action -> 25', () => {
    expect(resolveParamId('duration_action', mockParams)).toBe(25)
  })

  it('3. resolveParamId resolves canonical code and ID correctly', () => {
    expect(resolveParamId('speed', mockParams)).toBe(9)
    expect(resolveParamId('strength', mockParams)).toBe(14)
    expect(resolveParamId(9, mockParams)).toBe(9)
    expect(resolveParamId('14', mockParams)).toBe(14)
  })

  it('4. resolveParamId resolves by Vietnamese name and English name', () => {
    expect(resolveParamId('Độ bền / Độ cứng', mockParams)).toBe(14)
    expect(resolveParamId('Speed', mockParams)).toBe(9)
  })

  it('5. resolveParamId returns null for invalid / unknown string and does NOT pick a default parameter', () => {
    expect(resolveParamId('invalid_parameter_code', mockParams)).toBeNull()
    expect(resolveParamId('unknown_something', mockParams)).toBeNull()
    expect(resolveParamId('', mockParams)).toBeNull()
    expect(resolveParamId(null, mockParams)).toBeNull()
    expect(resolveParamId(undefined, mockParams)).toBeNull()
    expect(resolveParamId(999, mockParams)).toBeNull()
  })

  it('6. resolveParamId rejects non-integer numbers and out-of-range values strictly (1..39 only)', () => {
    // Valid boundary values
    expect(resolveParamId(1)).toBe(1)
    expect(resolveParamId(39)).toBe(39)
    expect(resolveParamId('1')).toBe(1)
    expect(resolveParamId('39')).toBe(39)

    // Out of range integers
    expect(resolveParamId(0)).toBeNull()
    expect(resolveParamId(40)).toBeNull()
    expect(resolveParamId(-5)).toBeNull()
    expect(resolveParamId('0')).toBeNull()
    expect(resolveParamId('40')).toBeNull()
    expect(resolveParamId('-5')).toBeNull()

    // Decimals and non-integers
    expect(resolveParamId(14.5)).toBeNull()
    expect(resolveParamId(1.0001)).toBeNull()
    expect(resolveParamId('14.5')).toBeNull()
    expect(resolveParamId('1.0001')).toBeNull()

    // Special numeric values
    expect(resolveParamId(NaN)).toBeNull()
    expect(resolveParamId(Infinity)).toBeNull()
    expect(resolveParamId(-Infinity)).toBeNull()
  })

  it('7. LEGACY_PARAM_ALIASES contains expected keys', () => {
    expect(LEGACY_PARAM_ALIASES['loss_of_money']).toBe(22)
    expect(LEGACY_PARAM_ALIASES['duration_action']).toBe(25)
  })
})
