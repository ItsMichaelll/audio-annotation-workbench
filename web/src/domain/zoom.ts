export const MAX_ZOOM_PX_PER_SECOND = 1600
export const ZOOM_FACTOR = 1.35
export const MIN_VERTICAL_SCALE = 0.25
export const MAX_VERTICAL_SCALE = 8
export const VERTICAL_SCALE_FACTOR = 1.2

export interface CursorZoomInput {
  currentZoom: number
  currentScroll: number
  pointerX: number
  nextZoom: number
  viewportWidth: number
  duration: number
}

export function fitZoom(duration: number, viewportWidth: number): number {
  if (duration <= 0 || viewportWidth <= 0) {
    return 0
  }

  return viewportWidth / duration
}

export function clampZoom(
  requestedZoom: number,
  fittedZoom: number,
  maximumZoom = MAX_ZOOM_PX_PER_SECOND,
): number {
  if (!Number.isFinite(requestedZoom) || fittedZoom <= 0) {
    return Math.max(0, fittedZoom)
  }

  return Math.min(Math.max(requestedZoom, fittedZoom), maximumZoom)
}

export function steppedZoom(
  currentZoom: number,
  direction: 'in' | 'out',
  fittedZoom: number,
): number {
  const factor = direction === 'in' ? ZOOM_FACTOR : 1 / ZOOM_FACTOR
  return clampZoom(currentZoom * factor, fittedZoom)
}

export function steppedVerticalScale(
  currentScale: number,
  direction: 'in' | 'out',
): number {
  const safeScale =
    Number.isFinite(currentScale) && currentScale > 0 ? currentScale : 1
  const factor =
    direction === 'in' ? VERTICAL_SCALE_FACTOR : 1 / VERTICAL_SCALE_FACTOR
  const nextScale = safeScale * factor

  if ((safeScale < 1 && nextScale >= 1) || (safeScale > 1 && nextScale <= 1)) {
    return 1
  }

  return Math.min(Math.max(nextScale, MIN_VERTICAL_SCALE), MAX_VERTICAL_SCALE)
}

export function cursorCenteredScroll({
  currentZoom,
  currentScroll,
  pointerX,
  nextZoom,
  viewportWidth,
  duration,
}: CursorZoomInput): number {
  if (
    currentZoom <= 0 ||
    nextZoom <= 0 ||
    duration <= 0 ||
    viewportWidth <= 0
  ) {
    return 0
  }

  const boundedPointer = Math.min(Math.max(pointerX, 0), viewportWidth)
  const anchorTime = (currentScroll + boundedPointer) / currentZoom
  const requestedScroll = anchorTime * nextZoom - boundedPointer
  const maximumScroll = Math.max(0, duration * nextZoom - viewportWidth)

  return Math.min(Math.max(requestedScroll, 0), maximumScroll)
}

export function keyboardZoomAnchor(
  currentTime: number,
  currentScroll: number,
  currentZoom: number,
  viewportWidth: number,
): number {
  const playheadX = currentTime * currentZoom - currentScroll
  if (playheadX >= 0 && playheadX <= viewportWidth) {
    return playheadX
  }

  return viewportWidth / 2
}
