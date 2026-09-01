import type { TaskRecord, TaskSourceIdentity } from './models'
import { normalizeRelativePath } from './taskIngestion'

export interface RelinkSelection {
  name: string
  size: number
  relativePath?: string
}

export class RelinkMismatchError extends Error {
  constructor(readonly message: string) {
    super(message)
    this.name = 'RelinkMismatchError'
  }
}

function formatSize(size: number): string {
  return size < 1024
    ? `${size} bytes`
    : size < 1024 * 1024
      ? `${(size / 1024).toFixed(2)} KB`
      : size < 1024 * 1024 * 1024
        ? `${(size / 1024 / 1024).toFixed(2)} MB`
        : `${(size / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function legacyIdentity(task: TaskRecord): TaskSourceIdentity {
  if (task.primaryMedia.kind === 'external-reference') {
    const size = /:(\d+):\d+$/.exec(task.primaryMedia.locator)?.[1]
    if (size !== undefined) {
      return {
        kind: 'direct-file',
        filename: task.primaryMedia.displayName,
        size: Number(size),
      }
    }
  }
  return {
    kind: 'manifest',
    relativePath: task.relativePath ?? task.primaryMedia.displayName,
  }
}

export function assertRelinkSelectionMatchesTask(
  task: TaskRecord,
  selection: RelinkSelection,
): void {
  const identity = task.sourceIdentity ?? legacyIdentity(task)
  if (identity.kind === 'direct-file') {
    if (
      selection.name !== identity.filename ||
      selection.size !== identity.size
    ) {
      const formattedSize = formatSize(identity.size)
      throw new RelinkMismatchError(
        `Expected: "${identity.filename}" (${formattedSize})`,
      )
    }
    return
  }

  const expectedPath = normalizeRelativePath(identity.relativePath)
  const expectedFilename = expectedPath.split('/').at(-1) ?? expectedPath
  const selectedPath = selection.relativePath?.trim()
  const matches = selectedPath
    ? normalizeRelativePath(selectedPath) === expectedPath
    : selection.name === expectedFilename
  if (!matches) {
    throw new RelinkMismatchError(
      `Expected: "${expectedPath}" (or a file named ${expectedFilename}).`,
    )
  }
}
