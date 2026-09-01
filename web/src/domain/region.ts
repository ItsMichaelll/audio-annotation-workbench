import { clampTime } from './transport'

export interface RegionMetadata {
  id: string
  start: number
  end: number
  data: Record<string, unknown>
}

export const MINIMUM_REGION_SECONDS = 0.001

export function normalizeRegion(
  start: number,
  end: number,
  duration: number,
  minimumLength = MINIMUM_REGION_SECONDS,
): Pick<RegionMetadata, 'start' | 'end'> | null {
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    !Number.isFinite(duration) ||
    duration <= 0
  ) {
    return null
  }

  const normalizedStart = clampTime(Math.min(start, end), duration)
  const normalizedEnd = clampTime(Math.max(start, end), duration)

  if (normalizedEnd - normalizedStart < minimumLength) {
    return null
  }

  return { start: normalizedStart, end: normalizedEnd }
}

export function translateRegion(
  start: number,
  end: number,
  deltaSeconds: number,
  duration: number,
): Pick<RegionMetadata, 'start' | 'end'> | null {
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    !Number.isFinite(deltaSeconds) ||
    !Number.isFinite(duration) ||
    duration <= 0 ||
    end <= start
  ) {
    return null
  }

  const regionLength = Math.min(end - start, duration)
  const translatedStart = Math.min(
    Math.max(start + deltaSeconds, 0),
    duration - regionLength,
  )

  return {
    start: translatedStart,
    end: translatedStart + regionLength,
  }
}

export interface RegionDragOrigin {
  start: number
  end: number
  pointerX: number
  scrollLeft: number
  pixelsPerSecond: number
}

export function regionDragBounds(
  origin: RegionDragOrigin,
  pointerX: number,
  scrollLeft: number,
  audioDuration: number,
): Pick<RegionMetadata, 'start' | 'end'> | null {
  if (
    !Number.isFinite(origin.start) ||
    !Number.isFinite(origin.end) ||
    !Number.isFinite(origin.pointerX) ||
    !Number.isFinite(origin.scrollLeft) ||
    !Number.isFinite(origin.pixelsPerSecond) ||
    origin.pixelsPerSecond <= 0 ||
    !Number.isFinite(pointerX) ||
    !Number.isFinite(scrollLeft) ||
    !Number.isFinite(audioDuration) ||
    audioDuration <= 0 ||
    origin.end <= origin.start
  ) {
    return null
  }

  const regionLength = Math.min(origin.end - origin.start, audioDuration)
  const rawDelta =
    (pointerX - origin.pointerX + scrollLeft - origin.scrollLeft) /
    origin.pixelsPerSecond
  const translatedStart = Math.min(
    Math.max(origin.start + rawDelta, 0),
    audioDuration - regionLength,
  )
  return {
    start: translatedStart,
    end: translatedStart + regionLength,
  }
}

export function viewportAutoScrollDelta(
  pointerX: number,
  viewportLeft: number,
  viewportRight: number,
  scrollLeft: number,
  maximumScroll: number,
  edgeSize = 32,
  maximumStep = 1,
): number {
  if (
    ![
      pointerX,
      viewportLeft,
      viewportRight,
      scrollLeft,
      maximumScroll,
      edgeSize,
      maximumStep,
    ].every(Number.isFinite) ||
    viewportRight <= viewportLeft ||
    edgeSize <= 0 ||
    maximumStep <= 0
  ) {
    return 0
  }
  if (pointerX < viewportLeft + edgeSize && scrollLeft > 0) {
    const strength = Math.min(
      Math.max((viewportLeft + edgeSize - pointerX) / edgeSize, 0),
      1,
    )
    return -Math.min(maximumStep * strength, scrollLeft)
  }
  if (pointerX > viewportRight - edgeSize && scrollLeft < maximumScroll) {
    const strength = Math.min(
      Math.max((pointerX - (viewportRight - edgeSize)) / edgeSize, 0),
      1,
    )
    return Math.min(maximumStep * strength, maximumScroll - scrollLeft)
  }
  return 0
}

export function maximumAudioScroll(
  audioDuration: number,
  pixelsPerSecond: number,
  clientWidth: number,
): number {
  if (
    !Number.isFinite(audioDuration) ||
    audioDuration <= 0 ||
    !Number.isFinite(pixelsPerSecond) ||
    pixelsPerSecond <= 0 ||
    !Number.isFinite(clientWidth) ||
    clientWidth <= 0
  ) {
    return 0
  }
  const contentWidth = Math.max(audioDuration * pixelsPerSecond, clientWidth)
  return Math.max(contentWidth - clientWidth, 0)
}

export function clampRegionEdit(
  previous: Pick<RegionMetadata, 'start' | 'end'>,
  proposedStart: number,
  proposedEnd: number,
  duration: number,
  minimumLength = MINIMUM_REGION_SECONDS,
): Pick<RegionMetadata, 'start' | 'end'> | null {
  const validPrevious = normalizeRegion(
    previous.start,
    previous.end,
    duration,
    minimumLength,
  )
  if (!validPrevious) return null
  if (!Number.isFinite(proposedStart) || !Number.isFinite(proposedEnd)) {
    return validPrevious
  }

  const startDelta = proposedStart - validPrevious.start
  const endDelta = proposedEnd - validPrevious.end
  const previousLength = validPrevious.end - validPrevious.start
  const proposedLength = proposedEnd - proposedStart
  const movementTolerance = Math.max(1e-6, previousLength * 1e-6)
  if (Math.abs(proposedLength - previousLength) <= movementTolerance) {
    return translateRegion(
      validPrevious.start,
      validPrevious.end,
      startDelta,
      duration,
    )
  }

  if (Math.abs(startDelta) >= Math.abs(endDelta)) {
    const end = Math.min(Math.max(proposedEnd, minimumLength), duration)
    return {
      start: Math.min(Math.max(proposedStart, 0), end - minimumLength),
      end,
    }
  }

  const start = Math.min(Math.max(proposedStart, 0), duration - minimumLength)
  return {
    start,
    end: Math.max(Math.min(proposedEnd, duration), start + minimumLength),
  }
}

export function regionSnapshotsEqual(
  left: readonly RegionMetadata[],
  right: readonly RegionMetadata[],
): boolean {
  return (
    left.length === right.length &&
    left.every((region, index) => {
      const other = right[index]
      return (
        other !== undefined &&
        region.id === other.id &&
        region.start === other.start &&
        region.end === other.end &&
        JSON.stringify(region.data) === JSON.stringify(other.data)
      )
    })
  )
}

export function upsertRegion(
  regions: readonly RegionMetadata[],
  nextRegion: RegionMetadata,
): RegionMetadata[] {
  const index = regions.findIndex((region) => region.id === nextRegion.id)
  if (index === -1) {
    return [...regions, nextRegion]
  }

  return regions.map((region) =>
    region.id === nextRegion.id ? nextRegion : region,
  )
}

export function removeRegion(
  regions: readonly RegionMetadata[],
  regionId: string,
): RegionMetadata[] {
  return regions.filter((region) => region.id !== regionId)
}

export function adjacentRegion(
  regions: readonly RegionMetadata[],
  selectedRegionId: string | null,
  direction: 'previous' | 'next',
): RegionMetadata | null {
  const ordered = [...regions].sort(
    (left, right) =>
      left.start - right.start ||
      left.end - right.end ||
      left.id.localeCompare(right.id),
  )
  if (ordered.length === 0) return null
  if (!selectedRegionId) {
    return direction === 'next' ? ordered[0]! : ordered.at(-1)!
  }
  const index = ordered.findIndex((region) => region.id === selectedRegionId)
  if (index < 0) return direction === 'next' ? ordered[0]! : ordered.at(-1)!
  return ordered[direction === 'next' ? index + 1 : index - 1] ?? null
}

export function regionVisualColors(
  color: string | undefined,
  selected: boolean,
): { fill: string; border: string } {
  const match = color?.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!match) {
    return {
      fill: selected ? 'rgba(70, 144, 255, 0.42)' : 'rgba(70, 144, 255, 0.28)',
      border: selected
        ? 'rgba(70, 144, 255, 0.95)'
        : 'rgba(70, 144, 255, 0.72)',
    }
  }
  const [red, green, blue] = match.slice(1).map((value) => parseInt(value!, 16))
  return {
    fill: `rgba(${red}, ${green}, ${blue}, ${selected ? 0.24 : 0.14})`,
    border: `rgba(${red}, ${green}, ${blue}, ${selected ? 0.95 : 0.78})`,
  }
}
