import type { MarkerAnnotation } from './models'
import { clampTime } from './transport'

/**
 * Marker times are displayed to 1 ms. Treat markers within that same precision
 * as occupying one timestamp when creating or navigating from the playhead.
 */
export const MARKER_TIME_TOLERANCE_SECONDS = 0.001

export function normalizeMarkerTime(
  time: number,
  duration?: number,
): number | null {
  if (!Number.isFinite(time)) return null
  if (duration !== undefined && Number.isFinite(duration) && duration >= 0) {
    return clampTime(time, duration)
  }
  return Math.max(time, 0)
}

export function normalizeMarkers(
  markers: readonly MarkerAnnotation[] | undefined,
  duration?: number,
  reservedIds: ReadonlySet<string> = new Set(),
): MarkerAnnotation[] {
  const ids = new Set(reservedIds)
  const normalized: MarkerAnnotation[] = []
  for (const marker of markers ?? []) {
    if (!marker.id || ids.has(marker.id)) continue
    const time = normalizeMarkerTime(marker.time, duration)
    if (time === null) continue
    ids.add(marker.id)
    normalized.push({ id: marker.id, time })
  }
  return normalized
}

export function chronologicalMarkers(
  markers: readonly MarkerAnnotation[],
): MarkerAnnotation[] {
  return [...markers].sort(
    (left, right) => left.time - right.time || left.id.localeCompare(right.id),
  )
}

export function hasMarkerNearTime(
  markers: readonly MarkerAnnotation[],
  time: number,
  tolerance = MARKER_TIME_TOLERANCE_SECONDS,
): boolean {
  return markers.some((marker) => Math.abs(marker.time - time) <= tolerance)
}

export function addMarker(
  markers: readonly MarkerAnnotation[],
  marker: MarkerAnnotation,
  duration: number,
): MarkerAnnotation[] {
  const time = normalizeMarkerTime(marker.time, duration)
  if (time === null || hasMarkerNearTime(markers, time)) return [...markers]
  return [...markers, { id: marker.id, time }]
}

export function updateMarker(
  markers: readonly MarkerAnnotation[],
  marker: MarkerAnnotation,
  duration: number,
): MarkerAnnotation[] {
  const time = normalizeMarkerTime(marker.time, duration)
  if (time === null) return [...markers]
  return markers.map((item) =>
    item.id === marker.id ? { ...item, time } : item,
  )
}

export function removeMarker(
  markers: readonly MarkerAnnotation[],
  markerId: string,
): MarkerAnnotation[] {
  return markers.filter((marker) => marker.id !== markerId)
}

export function adjacentMarker(
  markers: readonly MarkerAnnotation[],
  selectedMarkerId: string | null,
  currentTime: number,
  direction: 'previous' | 'next',
): MarkerAnnotation | null {
  const ordered = chronologicalMarkers(markers)
  const selectedIndex = selectedMarkerId
    ? ordered.findIndex((marker) => marker.id === selectedMarkerId)
    : -1
  if (selectedIndex >= 0) {
    return ordered[selectedIndex + (direction === 'next' ? 1 : -1)] ?? null
  }

  if (direction === 'next') {
    return (
      ordered.find(
        (marker) => marker.time > currentTime + MARKER_TIME_TOLERANCE_SECONDS,
      ) ?? null
    )
  }
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const marker = ordered[index]
    if (marker && marker.time < currentTime - MARKER_TIME_TOLERANCE_SECONDS) {
      return marker
    }
  }
  return null
}

export function markerOrdinal(
  markers: readonly MarkerAnnotation[],
  markerId: string | null,
): number | null {
  if (!markerId) return null
  const index = chronologicalMarkers(markers).findIndex(
    (marker) => marker.id === markerId,
  )
  return index < 0 ? null : index + 1
}

export function seekToMarkerWithoutPlaybackChange(
  time: number,
  duration: number,
  seek: (boundedTime: number) => void,
): number | null {
  const bounded = normalizeMarkerTime(time, duration)
  if (bounded === null) return null
  seek(bounded)
  return bounded
}
