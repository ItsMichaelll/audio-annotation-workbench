export const DEFAULT_INSPECTOR_WIDTH = 310

export function maximumInspectorWidth(viewportWidth: number): number {
  return Math.max(
    DEFAULT_INSPECTOR_WIDTH,
    Math.min(DEFAULT_INSPECTOR_WIDTH * 2, viewportWidth * 0.45),
  )
}

export function clampInspectorWidth(
  width: number,
  viewportWidth: number,
): number {
  const maximum = maximumInspectorWidth(viewportWidth)
  return Math.min(Math.max(width, DEFAULT_INSPECTOR_WIDTH), maximum)
}
