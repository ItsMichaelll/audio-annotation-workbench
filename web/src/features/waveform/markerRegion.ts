import type { MarkerAnnotation } from '../../domain/models'

export type WaveformEntityKind = 'annotation-region' | 'marker'

export interface MarkerShapePresentation {
  hitTargetWidthPx: number
  lineWidthPx: number
  capWidthPx: number
  capHeightPx: number
  shadowBlurPx: number
}

export function markerShapePresentation(
  selected: boolean,
): MarkerShapePresentation {
  return {
    hitTargetWidthPx: 10,
    lineWidthPx: selected ? 2 : 1,
    capWidthPx: 10,
    capHeightPx: 8,
    shadowBlurPx: selected ? 3 : 0,
  }
}

export function waveformEntityKind(
  entityKinds: ReadonlyMap<string, WaveformEntityKind>,
  entityId: string,
): WaveformEntityKind {
  return entityKinds.get(entityId) ?? 'annotation-region'
}

export function markerRegionOptions(
  marker: MarkerAnnotation,
  readOnly: boolean,
) {
  return {
    start: marker.time,
    end: marker.time,
    drag: !readOnly,
    resize: false,
  }
}
