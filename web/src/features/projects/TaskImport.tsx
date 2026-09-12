import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import {
  buildImportPlan,
  parseManifestFile,
  type ImportCandidate,
  type ImportPlan,
} from '../../domain/taskIngestion'
import type { TaskRecord } from '../../domain/models'
import {
  AUDIO_FILE_ACCEPT,
  validateAudioFile,
} from '../../domain/audioFileValidation'
import {
  registerCurrentSessionFile,
  releaseCurrentSessionFile,
} from '../../domain/mediaSources'
import styles from './TaskImport.module.css'

function sourceFor(file: File, relativePath: string) {
  const locator = `import:${crypto.randomUUID()}:${relativePath}`
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
  const pendingLocators = useRef<string[]>([])
  const releasePreview = () => {
    pendingLocators.current.forEach(releaseCurrentSessionFile)
    pendingLocators.current = []
  }
  useEffect(
    () => () => {
      pendingLocators.current.forEach(releaseCurrentSessionFile)
    },
    [],
  )
  const input = useRef<HTMLInputElement>(null)
  const directoryInput = useRef<HTMLInputElement>(null)
  const manifestInput = useRef<HTMLInputElement>(null)
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const prepareFiles = async (files: FileList | null) => {
    if (!files) return
    releasePreview()
    const candidates: ImportCandidate[] = []
    const unsupported: string[] = []
    for (const file of Array.from(files)) {
      const path = file.webkitRelativePath || file.name
      try {
        await validateAudioFile(file)
        const source = sourceFor(file, path)
        pendingLocators.current.push(source.locator)
        candidates.push({
          audio: path,
          name: file.name,
          source,
          sourceIdentity: {
            kind: 'direct-file',
            filename: file.name,
            size: file.size,
          },
        })
      } catch (reason) {
        unsupported.push(
          `${file.name}: ${reason instanceof Error ? reason.message : 'Invalid audio file.'}`,
        )
      }
    }
    const next = buildImportPlan(candidates, existing)
    next.unsupported = unsupported
    setPlan(next)
    setError(null)
  }
  const prepareManifest = async (file: File | undefined) => {
    if (!file) return
    try {
      const next = buildImportPlan(await parseManifestFile(file), existing)
      releasePreview()
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
    <section className={styles.root}>
      <input
        ref={input}
        hidden
        aria-label="Audio files to import"
        type="file"
        multiple
        accept={AUDIO_FILE_ACCEPT}
        onChange={(event) => {
          void prepareFiles(event.target.files)
          event.target.value = ''
        }}
      />
      <input
        ref={(node) => {
          directoryInput.current = node
          node?.setAttribute('webkitdirectory', '')
        }}
        hidden
        aria-label="Audio directory to import"
        type="file"
        multiple
        accept={AUDIO_FILE_ACCEPT}
        onChange={(event) => {
          void prepareFiles(event.target.files)
          event.target.value = ''
        }}
      />
      <input
        ref={manifestInput}
        hidden
        aria-label="Task manifest to import"
        type="file"
        accept=".json,.jsonl,application/json"
        onChange={(event) => {
          void prepareManifest(event.target.files?.[0])
          event.target.value = ''
        }}
      />
      <div className={styles.sourceControls}>
        <div className={styles.actions}>
          <Button
            className={styles.action}
            type="button"
            onClick={() => input.current?.click()}
          >
            Select audio files
          </Button>
          <Button
            className={styles.action}
            type="button"
            onClick={() => directoryInput.current?.click()}
          >
            Select directory
          </Button>
          <Button
            className={styles.action}
            type="button"
            onClick={() => manifestInput.current?.click()}
          >
            Select JSON/JSONL manifest
          </Button>
        </div>
        <p className={styles.helper}>
          Audio stays in its original location. Browser file selections are
          session-only and may need relinking after restart.
        </p>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {plan && (
        <div className={styles.preview} aria-live="polite">
          <strong>Import preview</strong>
          <span>
            {plan.candidates} candidates · {plan.valid.length} valid new ·{' '}
            {plan.duplicates.length} duplicates · {plan.conflicts.length}{' '}
            conflicts · {plan.unresolved.length} unresolved ·{' '}
            {plan.invalid.length} invalid · {plan.unsupported.length}{' '}
            unsupported
          </span>
          {plan.invalid.map((message) => (
            <p className={styles.error} key={message}>
              {message}
            </p>
          ))}
          {plan.unsupported.map((message) => (
            <p className={styles.error} key={message}>
              {message}
            </p>
          ))}
          <Button
            className={styles.previewAction}
            variant="primary"
            type="button"
            disabled={!plan.valid.length}
            onClick={() => {
              const retained = new Set(
                plan.valid.flatMap((candidate) =>
                  candidate.source?.kind === 'external-reference'
                    ? [candidate.source.locator]
                    : [],
                ),
              )
              pendingLocators.current
                .filter((locator) => !retained.has(locator))
                .forEach(releaseCurrentSessionFile)
              pendingLocators.current = []
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
