import { useEffect, useState } from 'react'
import { Button } from '../../components/Button'
import { detectMediaSourceCapabilities } from '../../domain/mediaSources'
import {
  FolderSourceAdapter,
  pickSourceFolder,
  scanSourceFolder,
  type DirectoryHandle,
} from '../../domain/folderSources'
import type { Project, TaskRecord } from '../../domain/models'
import { buildImportPlan, type ImportPlan } from '../../domain/taskIngestion'
import { getProjectRepository } from '../../storage/projectRepository'
import styles from './TaskImport.module.css'

export function SourceFolders({
  project,
  tasks,
  onChanged,
}: {
  project: Project
  tasks: readonly TaskRecord[]
  onChanged: () => void
}) {
  const [handles, setHandles] = useState<Record<string, DirectoryHandle>>({})
  const [statuses, setStatuses] = useState<Record<string, string>>({})
  const [taskStatuses, setTaskStatuses] = useState<Record<string, string>>({})
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<ImportPlan | null>(null)
  const supported = detectMediaSourceCapabilities().persistentHandles
  useEffect(() => {
    let active = true
    void (async () => {
      const repository = await getProjectRepository()
      const nextHandles: Record<string, DirectoryHandle> = {}
      const nextStatuses: Record<string, string> = {}
      const nextTasks: Record<string, string> = {}
      const adapter = new FolderSourceAdapter((projectId, id) =>
        repository.getSourceFolder(projectId, id),
      )
      for (const folder of project.sourceFolders ?? []) {
        try {
          const handle = await repository.getSourceFolder(project.id, folder.id)
          if (handle) nextHandles[folder.id] = handle
          const permission = handle?.queryPermission
            ? await handle.queryPermission({ mode: 'read' })
            : 'unknown'
          nextStatuses[folder.id] =
            permission === 'granted'
              ? 'Connected'
              : permission === 'prompt'
                ? 'Reconnect required'
                : permission === 'denied'
                  ? 'Permission denied'
                  : 'Disconnected'
          for (const task of tasks) {
            if (!active) return
            if (
              task.primaryMedia.kind !== 'folder' ||
              task.primaryMedia.sourceId !== folder.id
            )
              continue
            if (permission !== 'granted')
              nextTasks[task.id] =
                `${task.primaryMedia.relativePath}: unresolved — ${nextStatuses[folder.id]}`
            else {
              try {
                await adapter.resolve(task.primaryMedia)
              } catch (reason) {
                nextTasks[task.id] =
                  reason instanceof Error ? reason.message : 'Audio unavailable'
              }
            }
          }
        } catch (reason) {
          nextStatuses[folder.id] =
            reason instanceof Error ? reason.message : 'Folder unavailable'
        }
      }
      if (active) {
        setHandles(nextHandles)
        setStatuses(nextStatuses)
        setTaskStatuses(nextTasks)
      }
    })().catch((reason: unknown) => {
      if (active)
        setError(
          reason instanceof Error ? reason.message : 'Unable to read folders',
        )
    })
    return () => {
      active = false
    }
  }, [project, tasks, revision])

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
      onChanged()
    } catch (reason) {
      if (!(reason instanceof Error && reason.name === 'AbortError'))
        setError(
          reason instanceof Error ? reason.message : 'Folder operation failed',
        )
    } finally {
      setRevision((value) => value + 1)
      setBusy(false)
    }
  }
  const connect = async (sourceId?: string) => {
    // Invoke the picker before any awaits to preserve the user gesture.
    const handle = await pickSourceFolder()
    const repository = await getProjectRepository()
    await repository.saveSourceFolder(
      project.id,
      sourceId ?? crypto.randomUUID(),
      handle,
    )
    setPreview(null)
  }
  return (
    <section
      className={styles.sourceControls}
      aria-label="Connected source folders"
    >
      <h3>Source folders</h3>
      <p>
        Connect a local folder once. Audio stays in place; access is read-only.
        If permission expires, reconnect the folder to restore every matching
        task.
      </p>
      {supported ? (
        <Button disabled={busy} onClick={() => void run(() => connect())}>
          Connect folder
        </Button>
      ) : (
        <p>
          Persistent folders are unavailable in this browser. Use Select
          directory or Select audio files below; those selections last for this
          session.
        </p>
      )}
      {(project.sourceFolders ?? []).map((folder) => (
        <div key={folder.id}>
          <p>
            <strong>{folder.name}</strong> —{' '}
            {statuses[folder.id] ?? 'Checking access…'}
          </p>
          <div className={styles.actions}>
            <Button
              disabled={busy || !supported}
              onClick={() =>
                void run(async () => {
                  const handle = handles[folder.id]
                  if (!handle?.requestPermission) return connect(folder.id)
                  const permission = await handle.requestPermission({
                    mode: 'read',
                  })
                  if (permission !== 'granted')
                    throw new Error(
                      'Folder permission was not granted. Allow access in browser settings or replace the folder.',
                    )
                })
              }
            >
              Reconnect folder
            </Button>
            <Button
              disabled={busy || !supported}
              onClick={() => void run(() => connect(folder.id))}
            >
              Replace folder
            </Button>
            <Button
              disabled={busy || !handles[folder.id]}
              onClick={() =>
                void run(async () => {
                  await (
                    await getProjectRepository()
                  ).forgetSourceFolder(project.id, folder.id)
                  setPreview(null)
                })
              }
            >
              Forget access
            </Button>
            <Button
              disabled={busy || statuses[folder.id] !== 'Connected'}
              onClick={() =>
                void run(async () => {
                  const { candidates, unsupported } = await scanSourceFolder(
                    handles[folder.id]!,
                    project.id,
                    folder.id,
                  )
                  const repository = await getProjectRepository()
                  await repository.linkFolderTasks(
                    project.id,
                    folder.id,
                    candidates.map((candidate) => candidate.audio),
                  )
                  const current = await repository.listTasks(project.id)
                  const plan = buildImportPlan(candidates, current)
                  plan.unsupported = unsupported
                  setPreview(plan)
                })
              }
            >
              Scan folder / link matching tasks
            </Button>
          </div>
        </div>
      ))}
      {preview && (
        <div className={styles.preview}>
          <strong>Folder import preview</strong>
          <p>
            {preview.valid.length} new · {preview.duplicates.length} existing ·{' '}
            {preview.unsupported.length} unsupported
          </p>
          {preview.unsupported.map((path) => (
            <p key={path}>Unsupported audio file: {path}</p>
          ))}
          <Button
            disabled={busy || !preview.valid.length}
            onClick={() =>
              void run(async () => {
                await (
                  await getProjectRepository()
                ).importTasks(project.id, preview.valid)
                setPreview(null)
              })
            }
          >
            Confirm folder import
          </Button>
          <Button disabled={busy} onClick={() => setPreview(null)}>
            Dismiss preview
          </Button>
        </div>
      )}
      {Object.entries(taskStatuses).map(([id, message]) => (
        <p key={id}>{message}</p>
      ))}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </section>
  )
}
