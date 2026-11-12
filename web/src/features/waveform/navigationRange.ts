import { clampTime } from '../../domain/transport'
import { fitZoom } from '../../domain/zoom'

export interface NavigationRange {
  start: number
  end: number
}

export function navigationBounds(
  duration: number,
  activeRange?: NavigationRange | null,
): NavigationRange {
  const end = Number.isFinite(duration) ? Math.max(0, duration) : 0
  if (
    !activeRange ||
    !Number.isFinite(activeRange.start) ||
    !Number.isFinite(activeRange.end) ||
    activeRange.end <= activeRange.start
  )
    return { start: 0, end }
  const start = clampTime(activeRange.start, end)
  const stop = clampTime(activeRange.end, end)
  return stop > start ? { start, end: stop } : { start: 0, end }
}

export function clampNavigationTime(
  time: number,
  duration: number,
  activeRange?: NavigationRange | null,
): number {
  const bounds = navigationBounds(duration, activeRange)
  return Math.max(
    bounds.start,
    Math.min(bounds.end, Number.isFinite(time) ? time : bounds.start),
  )
}

export function fitNavigationRange(
  duration: number,
  width: number,
  activeRange?: NavigationRange | null,
) {
  const bounds = navigationBounds(duration, activeRange)
  return { ...bounds, zoom: fitZoom(bounds.end - bounds.start, width) }
}
