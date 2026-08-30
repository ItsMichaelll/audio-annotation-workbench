import {
  TASK_SCHEMA_VERSION,
  type MediaSourceReference,
  type TaskRecord,
  type TaskStatus,
} from './models'

export interface ManifestTask {
  id?: string
  audio: string
  name?: string
  metadata?: Record<string, unknown>
}

export interface ImportCandidate extends ManifestTask {
  source?: MediaSourceReference
}

export interface ImportPlan {
  candidates: number
  valid: ImportCandidate[]
  duplicates: ImportCandidate[]
  conflicts: ImportCandidate[]
  unresolved: ImportCandidate[]
  invalid: string[]
  unsupported: string[]
}

export function normalizeRelativePath(value: string): string {
  const path = value.trim().replaceAll('\\', '/')
  if (
    !path ||
    path.startsWith('/') ||
    /^[a-zA-Z]:\//.test(path) ||
    path.split('/').some((part) => part === '..' || !part)
  ) {
    throw new Error(
      'Audio paths must be non-empty relative paths without parent traversal.',
    )
  }
  return path
    .split('/')
    .filter((part) => part !== '.')
    .join('/')
}

function metadataIsSafe(value: unknown): value is Record<string, unknown> {
  if (!value || Array.isArray(value) || typeof value !== 'object') return false
  return Object.values(value).every(
    (item) =>
      item === null ||
      ['string', 'number', 'boolean'].includes(typeof item) ||
      (Array.isArray(item) &&
        item.every((entry) =>
          ['string', 'number', 'boolean'].includes(typeof entry),
        )),
  )
}

function parseEntry(value: unknown): ManifestTask {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new Error('Each manifest entry must be an object.')
  }
  const entry = value as Record<string, unknown>
  if (typeof entry.audio !== 'string')
    throw new Error('Each entry requires audio.')
  const audio = normalizeRelativePath(entry.audio)
  if (
    entry.id !== undefined &&
    (typeof entry.id !== 'string' || !entry.id.trim())
  ) {
    throw new Error('Task id must be a non-empty string when supplied.')
  }
  if (entry.name !== undefined && typeof entry.name !== 'string') {
    throw new Error('Task name must be a string when supplied.')
  }
  if (entry.metadata !== undefined && !metadataIsSafe(entry.metadata)) {
    throw new Error('Task metadata contains unsupported values.')
  }
  return {
    audio,
    ...(typeof entry.id === 'string' ? { id: entry.id } : {}),
    ...(typeof entry.name === 'string' ? { name: entry.name } : {}),
    ...(metadataIsSafe(entry.metadata) ? { metadata: entry.metadata } : {}),
  }
}

export function parseManifest(text: string): ManifestTask[] {
  const textValue = text.trim()
  if (!textValue) throw new Error('Manifest is empty.')
  let entries: unknown[]
  try {
    const parsed: unknown = JSON.parse(textValue)
    if (Array.isArray(parsed)) entries = parsed
    else if (
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as { tasks?: unknown }).tasks)
    ) {
      entries = (parsed as { tasks: unknown[] }).tasks
    } else
      throw new Error('JSON manifest must be an array or an object with tasks.')
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
    entries = textValue
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line, index) => {
        try {
          return JSON.parse(line)
        } catch {
          throw new Error(`Invalid JSONL entry ${index + 1}.`)
        }
      })
  }
  const ids = new Set<string>()
  return entries.map((entry) => {
    const task = parseEntry(entry)
    if (task.id && (ids.has(task.id) || !ids.add(task.id))) {
      throw new Error('Manifest contains a duplicate external ID.')
    }
    return task
  })
}

export function buildImportPlan(
  candidates: readonly ImportCandidate[],
  existing: readonly TaskRecord[],
): ImportPlan {
  const plan: ImportPlan = {
    candidates: candidates.length,
    valid: [],
    duplicates: [],
    conflicts: [],
    unresolved: [],
    invalid: [],
    unsupported: [],
  }
  const ids = new Map(
    existing
      .filter((task) => task.externalId)
      .map((task) => [task.externalId!, task]),
  )
  const paths = new Map(
    existing
      .filter((task) => task.relativePath)
      .map((task) => [task.relativePath!, task]),
  )
  const seenIds = new Set<string>()
  const seenPaths = new Set<string>()
  for (const candidate of candidates) {
    try {
      const audio = normalizeRelativePath(candidate.audio)
      const byId = candidate.id ? ids.get(candidate.id) : undefined
      const byPath = paths.get(audio)
      if (
        (candidate.id && seenIds.has(candidate.id)) ||
        seenPaths.has(audio) ||
        (byId && byPath && byId.id !== byPath.id) ||
        (byId && byId.relativePath !== audio) ||
        (byPath && candidate.id && byPath.externalId !== candidate.id)
      ) {
        plan.conflicts.push(candidate)
        continue
      }
      if (byId || byPath) {
        plan.duplicates.push(candidate)
        continue
      }
      const valid = { ...candidate, audio }
      plan.valid.push(valid)
      if (!candidate.source) plan.unresolved.push(valid)
      if (candidate.id) seenIds.add(candidate.id)
      seenPaths.add(audio)
    } catch (error) {
      plan.invalid.push(
        error instanceof Error ? error.message : 'Invalid entry.',
      )
    }
  }
  return plan
}

export function taskFromCandidate(
  projectId: string,
  candidate: ImportCandidate,
  id: string,
  timestamp: string,
): TaskRecord {
  const relativePath = normalizeRelativePath(candidate.audio)
  return {
    id,
    schemaVersion: TASK_SCHEMA_VERSION,
    projectId,
    status: 'unstarted',
    displayName:
      candidate.name?.trim() || relativePath.split('/').at(-1) || 'Audio task',
    ...(candidate.id ? { externalId: candidate.id } : {}),
    relativePath,
    primaryMedia: candidate.source ?? {
      kind: 'unresolved',
      displayName: relativePath.split('/').at(-1) || 'Audio task',
      reason: 'not-yet-linked',
    },
    metadata: candidate.metadata ?? {},
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function canTransitionTask(from: TaskStatus, to: TaskStatus): boolean {
  return (
    from === to ||
    (from === 'unstarted' && (to === 'skipped' || to === 'blocked')) ||
    ((from === 'skipped' || from === 'blocked') && to === 'unstarted') ||
    (from === 'submitted' && to === 'reopened')
  )
}
