import { describe, expect, it } from 'vitest'
import { hexToHsv, hsvToHex, normalizeHexColor } from './colorPicker'

describe('taxonomy color picker helpers', () => {
  it('normalizes only six-digit hex colors', () => {
    expect(normalizeHexColor(' #4f8cff ')).toBe('#4F8CFF')
    expect(normalizeHexColor('#fff')).toBeNull()
    expect(normalizeHexColor('blue')).toBeNull()
  })

  it('converts between canonical hex and HSV colors', () => {
    const pink = hexToHsv('#ff006e')
    expect(pink?.hue).toBeCloseTo(334.12, 2)
    expect(pink?.saturation).toBe(100)
    expect(pink?.value).toBe(100)
    expect(hsvToHex(pink!)).toBe('#FF006E')
    expect(hsvToHex({ hue: 360, saturation: 0, value: 100 })).toBe('#FFFFFF')
  })

  it('clamps saturation and value output', () => {
    expect(hsvToHex({ hue: -120, saturation: 200, value: 150 })).toBe('#0000FF')
    expect(hsvToHex({ hue: 0, saturation: -1, value: -1 })).toBe('#000000')
  })
})
