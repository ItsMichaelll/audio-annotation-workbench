import { describe, expect, it } from 'vitest'
import {
  clampInspectorWidth,
  DEFAULT_INSPECTOR_WIDTH,
  maximumInspectorWidth,
} from './editorLayout'

describe('annotation inspector sizing', () => {
  it('keeps the default minimum and caps width at 45vw or twice default', () => {
    expect(clampInspectorWidth(100, 1_600)).toBe(DEFAULT_INSPECTOR_WIDTH)
    expect(clampInspectorWidth(800, 1_600)).toBe(620)
    expect(clampInspectorWidth(800, 1_000)).toBe(450)
    expect(maximumInspectorWidth(1_600)).toBe(620)
  })
})
