export const MOMENTARY_WINDOW_SECONDS = 0.4
export const SHORT_TERM_WINDOW_SECONDS = 3
export const MEASUREMENT_STEP_SECONDS = 0.1

export function measurementWindowFrames(
  sampleRate: number,
  windowSeconds: number,
): number {
  if (!(sampleRate > 0) || !(windowSeconds > 0)) return 0
  return Math.round(sampleRate * windowSeconds)
}
