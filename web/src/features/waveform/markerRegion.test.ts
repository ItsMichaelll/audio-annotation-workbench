import { describe, expect, it } from 'vitest'
import {
  markerRegionOptions,
  markerShapePresentation,
  waveformEntityKind,
} from './markerRegion'

describe('WaveSurfer marker regions', () => {
  it('uses an explicit entity discriminator instead of timing', () => {
    const kinds = new Map([
      ['marker-at-two', 'marker'],
      ['zero-length-region', 'annotation-region'],
    ] as const)
    expect(waveformEntityKind(kinds, 'marker-at-two')).toBe('marker')
    expect(waveformEntityKind(kinds, 'zero-length-region')).toBe(
      'annotation-region',
    )
    expect(waveformEntityKind(kinds, 'new-plugin-region')).toBe(
      'annotation-region',
    )
  })

  it('renders editable markers as zero-length draggable non-resizable regions', () => {
    expect(markerRegionOptions({ id: 'marker', time: 2.5 }, false)).toEqual({
      start: 2.5,
      end: 2.5,
      drag: true,
      resize: false,
    })
  })

  it('keeps submitted marker regions selectable but not draggable', () => {
    expect(
      markerRegionOptions({ id: 'marker', time: 2.5 }, true),
    ).toMatchObject({ drag: false, resize: false })
  })

  it('uses a thin centered line and widens it only when selected', () => {
    expect(markerShapePresentation(false)).toEqual({
      hitTargetWidthPx: 10,
      lineWidthPx: 1,
      capWidthPx: 10,
      capHeightPx: 8,
      shadowBlurPx: 0,
    })
    expect(markerShapePresentation(true)).toEqual({
      hitTargetWidthPx: 10,
      lineWidthPx: 2,
      capWidthPx: 10,
      capHeightPx: 8,
      shadowBlurPx: 3,
    })
  })
})
