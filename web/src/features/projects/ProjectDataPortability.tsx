import { useId, useState } from 'react'
import { Button } from '../../components/Button'
import {
  Modal,
  ModalActions,
  ModalDescription,
  ModalTitle,
} from '../../components/Modal'
import {
  serializeAnnotationCsv,
  serializeAnnotationJsonl,
  type AnnotationExportFormat,
  type AnnotationExportMode,
} from '../../domain/annotationExport'
import {
  createProjectBackup,
  safeExportFilename,
  serializeProjectBackup,
} from '../../domain/projectBackup'
import { downloadText } from './editorBehavior'
import { loadProjectBackupRecords } from './projectActions'
import layoutStyles from './ProjectLayout.module.css'
import styles from './ProjectDataPortability.module.css'

export function ProjectDataPortability({
  projectId,
  projectName,
}: {
  projectId: string
  projectName: string
}) {
  const titleId = useId()
  const descriptionId = useId()
  const [open, setOpen] = useState(false)
  const [format, setFormat] = useState<AnnotationExportFormat>('jsonl')
  const [mode, setMode] = useState<AnnotationExportMode>('submitted')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const runDownload = async (
    build: () => Promise<{ source: string; filename: string; type: string }>,
  ) => {
    setBusy(true)
    setStatus(null)
    try {
      const output = await build()
      downloadText(output.source, output.filename, output.type)
      setStatus(`Download started: ${output.filename}`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'The download failed.')
    } finally {
      setBusy(false)
      setStatus('Download completed.')
      setTimeout(() => setStatus(null), 5000)
    }
  }

  const downloadBackup = () =>
    runDownload(async () => {
      const records = await loadProjectBackupRecords(projectId)
      const backup = createProjectBackup(records)
      return {
        source: serializeProjectBackup(backup),
        filename: safeExportFilename(projectName, 'backup.json'),
        type: 'application/json;charset=utf-8',
      }
    })

  const downloadAnnotations = () =>
    runDownload(async () => {
      const records = await loadProjectBackupRecords(projectId)
      const source = {
        project: records.project,
        taxonomyVersions: records.taxonomyVersions,
        tasks: records.tasks,
        annotations: records.annotations,
      }
      return format === 'jsonl'
        ? {
            source: serializeAnnotationJsonl(source, mode),
            filename: safeExportFilename(projectName, `${mode}.jsonl`),
            type: 'application/x-ndjson;charset=utf-8',
          }
        : {
            source: serializeAnnotationCsv(source, mode),
            filename: safeExportFilename(projectName, `${mode}.csv`),
            type: 'text/csv;charset=utf-8',
          }
    })

  return (
    <section className={styles.section}>
      <div className={styles.heading}>
        <div>
          <p className={`${layoutStyles.eyebrow} ${styles.headingEyebrow}`}>
            Data portability
          </p>
          <h2 className={styles.headingTitle}>Backup and export</h2>
        </div>
      </div>
      <p className={styles.description}>
        Backups contain project configuration, tasks, and annotations. Source
        audio is never included and must be relinked after restoration.
      </p>
      <div className={styles.actions}>
        <Button
          type="button"
          disabled={busy}
          onClick={() => void downloadBackup()}
        >
          {busy ? 'Preparing…' : 'Download backup'}
        </Button>
        <Button type="button" disabled={busy} onClick={() => setOpen(true)}>
          Export annotations
        </Button>
      </div>
      {status && <p role="status">{status}</p>}

      <Modal
        open={open}
        titleId={titleId}
        descriptionId={descriptionId}
        onClose={() => !busy && setOpen(false)}
      >
        <ModalTitle id={titleId}>Export annotations</ModalTitle>
        <ModalDescription id={descriptionId}>
          Choose a versioned machine-readable export. Audio is not included.
        </ModalDescription>
        <fieldset className={styles.options}>
          <legend>Format</legend>
          <label className={styles.option}>
            <input
              type="radio"
              className={styles.radio}
              name="export-format"
              value="jsonl"
              checked={format === 'jsonl'}
              onChange={() => setFormat('jsonl')}
            />
            JSONL
          </label>
          <label className={styles.option}>
            <input
              type="radio"
              className={styles.radio}
              name="export-format"
              value="csv"
              checked={format === 'csv'}
              onChange={() => setFormat('csv')}
            />
            Flattened CSV
          </label>
        </fieldset>
        <fieldset className={styles.options}>
          <legend>Tasks</legend>
          <label className={styles.option}>
            <input
              type="radio"
              className={styles.radio}
              name="export-mode"
              value="submitted"
              checked={mode === 'submitted'}
              onChange={() => setMode('submitted')}
            />
            Submitted only
          </label>
          <label className={styles.option}>
            <input
              type="radio"
              className={styles.radio}
              name="export-mode"
              value="all"
              checked={mode === 'all'}
              onChange={() => setMode('all')}
            />
            All tasks
          </label>
        </fieldset>
        {status && <p role="status">{status}</p>}
        <ModalActions>
          <Button type="button" disabled={busy} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="button"
            disabled={busy}
            onClick={() => void downloadAnnotations()}
          >
            {busy ? 'Preparing…' : `Download ${format.toUpperCase()}`}
          </Button>
        </ModalActions>
      </Modal>
    </section>
  )
}
