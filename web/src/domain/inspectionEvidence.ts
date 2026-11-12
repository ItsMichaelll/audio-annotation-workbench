export interface TranscriptRow {
  id: string
  speaker: string
  start: number
  end: number
  text: string
}

export interface InspectionScore {
  id: string
  name: string
  value: number
  unit: string
  source: string
  start?: number
  end?: number
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function bounds(start: unknown, end: unknown, duration: number): boolean {
  return (
    typeof start === 'number' &&
    Number.isFinite(start) &&
    start >= 0 &&
    typeof end === 'number' &&
    Number.isFinite(end) &&
    end > start &&
    end <= duration
  )
}

/** Reads optional manifest metadata without changing canonical annotations. */
export function parseInspectionEvidence(
  metadata: Record<string, unknown>,
  duration: number,
) {
  const transcript: TranscriptRow[] = []
  const scores: InspectionScore[] = []
  const warnings: string[] = []
  for (const key of ['transcript', 'scores']) {
    if (metadata[key] !== undefined && !Array.isArray(metadata[key]))
      warnings.push(`The ${key} container must be an array.`)
  }
  const ids = new Set<string>()
  for (const item of Array.isArray(metadata.transcript)
    ? metadata.transcript
    : []) {
    if (
      !record(item) ||
      !text(item.id) ||
      ids.has(item.id) ||
      !text(item.speaker) ||
      !text(item.text) ||
      !bounds(item.start, item.end, duration)
    ) {
      warnings.push('Skipped an invalid or duplicate transcript row.')
      continue
    }
    ids.add(item.id)
    // bounds validates numeric times before this type-safe reconstruction.
    if (typeof item.start !== 'number' || typeof item.end !== 'number') continue
    transcript.push({
      id: item.id,
      speaker: item.speaker,
      start: item.start,
      end: item.end,
      text: item.text,
    })
  }
  ids.clear()
  for (const item of Array.isArray(metadata.scores) ? metadata.scores : []) {
    if (
      !record(item) ||
      !text(item.id) ||
      ids.has(item.id) ||
      !text(item.name) ||
      !text(item.unit) ||
      !text(item.source) ||
      typeof item.value !== 'number' ||
      !Number.isFinite(item.value) ||
      ((item.start !== undefined || item.end !== undefined) &&
        !bounds(item.start, item.end, duration))
    ) {
      warnings.push('Skipped an invalid score or evidence range.')
      continue
    }
    ids.add(item.id)
    scores.push({
      id: item.id,
      name: item.name,
      unit: item.unit,
      source: item.source,
      value: item.value,
      ...(typeof item.start === 'number' && typeof item.end === 'number'
        ? { start: item.start, end: item.end }
        : {}),
    })
  }
  transcript.sort((a, b) => a.start - b.start || a.id.localeCompare(b.id))
  return { transcript, scores, warnings }
}
