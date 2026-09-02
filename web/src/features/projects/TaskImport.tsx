import { useRef, useState } from 'react'
import { Button } from '../../components/Button'
import {
  buildImportPlan,
  parseManifest,
  type ImportCandidate,
  type ImportPlan,
} from '../../domain/taskIngestion'
import type { TaskRecord } from '../../domain/models'
import { registerCurrentSessionFile } from '../../domain/mediaSources'

const AUDIO = /\.(wav|mp3|flac|ogg|m4a|aac|aiff?)$/i

function sourceFor(file: File, relativePath: string) {
  const locator = `${relativePath}:${file.size}:${file.lastModified}`
  registerCurrentSessionFile(locator, file)
  return {
    kind: 'external-reference' as const,
    locator,
    displayName: file.name,
    permission: 'prompt' as const,
  }
}

export function TaskImport({
  existing = [],
  onReady,
}: {
  existing?: readonly TaskRecord[]
  onReady: (tasks: ImportCandidate[]) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const directoryInput = useRef<HTMLInputElement>(null)
  const manifestInput = useRef<HTMLInputElement>(null)
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const prepareFiles = (files: FileList | null) => {
    if (!files) return
    const candidates: ImportCandidate[] = []
    const unsupported: string[] = []
    for (const file of Array.from(files)) {
      const path = file.webkitRelativePath || file.name
      if (AUDIO.test(file.name))
        candidates.push({
          audio: path,
          name: file.name,
          source: sourceFor(file, path),
          sourceIdentity: {
            kind: 'direct-file',
            filename: file.name,
            size: file.size,
          },
        })
      else unsupported.push(file.name)
    }
    const next = buildImportPlan(candidates, existing)
    next.unsupported = unsupported
    setPlan(next)
    setError(null)
  }
  const prepareManifest = async (file: File | undefined) => {
    if (!file) return
    try {
      const next = buildImportPlan(parseManifest(await file.text()), existing)
      setPlan(next)
      setError(null)
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Manifest could not be read.',
      )
      setPlan(null)
    }
  }
  return (
    <section className="task-import">
      <input
        ref={input}
        className="visually-hidden"
        type="file"
        multiple
        accept="audio/*,.wav,.flac"
        onChange={(event) => {
          prepareFiles(event.target.files)
          event.target.value = ''
        }}
      />
      <input
        ref={(node) => {
          directoryInput.current = node
          node?.setAttribute('webkitdirectory', '')
        }}
        className="visually-hidden"
        type="file"
        multiple
        accept="audio/*,.wav,.flac"
        onChange={(event) => {
          prepareFiles(event.target.files)
          event.target.value = ''
        }}
      />
      <input
        ref={manifestInput}
        className="visually-hidden"
        type="file"
        accept=".json,.jsonl,application/json"
        onChange={(event) => {
          void prepareManifest(event.target.files?.[0])
          event.target.value = ''
        }}
      />
      <div className="task-import__source-controls">
        <div className="task-import__actions">
          <Button type="button" onClick={() => input.current?.click()}>
            Select audio files
          </Button>
          <Button type="button" onClick={() => directoryInput.current?.click()}>
            Select directory
          </Button>
          <Button type="button" onClick={() => manifestInput.current?.click()}>
            Select JSON/JSONL manifest
          </Button>
        </div>
        <p className="task-import__helper">
          Audio stays in its original location. Browser file selections are
          session-only and may need relinking after restart.
        </p>
      </div>
      {error && <p className="field-error">{error}</p>}
      {plan && (
        <div className="import-preview" aria-live="polite">
          <strong>Import preview</strong>
          <span>
            {plan.candidates} candidates · {plan.valid.length} valid new ·{' '}
            {plan.duplicates.length} duplicates · {plan.conflicts.length}{' '}
            conflicts · {plan.unresolved.length} unresolved ·{' '}
            {plan.invalid.length} invalid · {plan.unsupported.length}{' '}
            unsupported
          </span>
          {plan.invalid.map((message) => (
            <p className="field-error" key={message}>
              {message}
            </p>
          ))}
          <Button
            variant="primary"
            type="button"
            disabled={!plan.valid.length}
            onClick={() => {
              onReady(plan.valid)
              setPlan(null)
            }}
          >
            Confirm import
          </Button>
        </div>
      )}
    </section>
  )
}
