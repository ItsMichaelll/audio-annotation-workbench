export function scrollWidthsMatch(
  mainScrollWidth: number,
  scrollbarScrollWidth: number,
  tolerance = 1,
): boolean {
  if (
    !Number.isFinite(mainScrollWidth) ||
    !Number.isFinite(scrollbarScrollWidth) ||
    mainScrollWidth < 0 ||
    scrollbarScrollWidth < 0
  ) {
    return false
  }

  return (
    Math.abs(mainScrollWidth - scrollbarScrollWidth) <= Math.max(0, tolerance)
  )
}
