export type ShiftWheelMode = 'pan' | 'move-region'

export function shiftWheelMode(
  selectedRegionId: string | null,
): ShiftWheelMode {
  return selectedRegionId === null ? 'pan' : 'move-region'
}

export function clampedWheelScroll(
  current: number,
  delta: number,
  maximum: number,
): number {
  if (![current, delta, maximum].every(Number.isFinite)) return 0
  return Math.min(Math.max(current + delta, 0), Math.max(maximum, 0))
}
