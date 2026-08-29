export const FINE_STEP_SECONDS = 0.05
export const COARSE_STEP_SECONDS = 0.25
export const SECOND_STEP_SECONDS = 1

export function clampTime(time: number, duration: number): number {
  if (!Number.isFinite(time) || duration <= 0 || !Number.isFinite(duration)) {
    return 0
  }

  return Math.min(Math.max(time, 0), duration)
}

export function movePlayhead(
  currentTime: number,
  deltaSeconds: number,
  duration: number,
): number {
  return clampTime(currentTime + deltaSeconds, duration)
}

export function arrowStep(shiftKey: boolean): number {
  return shiftKey ? COARSE_STEP_SECONDS : FINE_STEP_SECONDS
}

export function formatTime(seconds: number): string {
  const safeSeconds = Math.max(0, Number.isFinite(seconds) ? seconds : 0)
  const minutes = Math.floor(safeSeconds / 60)
  const remaining = safeSeconds - minutes * 60

  return `${minutes}:${remaining.toFixed(3).padStart(6, '0')}`
}
