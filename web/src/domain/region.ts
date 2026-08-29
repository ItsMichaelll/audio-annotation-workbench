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
