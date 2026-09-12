import { useId, useState } from 'react'
import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
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
  const [status, setStatus] = useState<{
    phase: 'preparing' | 'started' | 'failed'
    kind: 'Backup' | 'Export'
    message: string
  } | null>(null)

  const runDownload = async (
    kind: 'Backup' | 'Export',
    build: () => Promise<{ source: string; filename: string; type: string }>,
  ) => {
    setBusy(true)
    setStatus({
      phase: 'preparing',
      kind,
      message: `Preparing ${kind.toLowerCase()}…`,
    })
    try {
      const output = await build()
      downloadText(output.source, output.filename, output.type)
      setStatus({
        phase: 'started',
        kind,
        message: `Download started: ${output.filename}`,
      })
    } catch (error) {
      setStatus({
        phase: 'failed',
        kind,
        message: `${kind} failed. ${error instanceof Error ? error.message : 'Unable to prepare the download.'} Please try again.`,
      })
    } finally {
      setBusy(false)
    }
  }

  const downloadBackup = () =>
    runDownload('Backup', async () => {
      const records = await loadProjectBackupRecords(projectId)
      const backup = createProjectBackup(records)
      return {
        source: serializeProjectBackup(backup),
        filename: safeExportFilename(projectName, 'backup.json'),
        type: 'application/json;charset=utf-8',
      }
    })

  const downloadAnnotations = () =>
    runDownload('Export', async () => {
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

  const feedback = (
    <div
      className={styles.feedback}
      aria-live="polite"
      aria-atomic="true"
      data-phase={status?.phase}
    >
      {status?.message}
    </div>
  )

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
        <div className={styles.downloadOption}>
          <Icon name="folder" size={24} />
          <h3>Keep a recovery copy</h3>
          <p>
            Save the full project, including every taxonomy version and
            annotation, in one backup file.
          </p>
          <Button
            type="button"
            disabled={busy}
            onClick={() => void downloadBackup()}
          >
            {busy && status?.kind === 'Backup'
              ? 'Preparing backup…'
              : 'Download backup'}
          </Button>
        </div>
        <div className={styles.downloadOption}>
          <Icon name="download" size={24} />
          <h3>Use your annotations</h3>
          <p>
            Export submitted work or all tasks as JSONL or CSV for analysis and
            downstream tools.
          </p>
          <Button
            type="button"
            disabled={busy}
            onClick={() => {
              setStatus(null)
              setOpen(true)
            }}
          >
            Export annotations
          </Button>
        </div>
      </div>
      {!open && feedback}

      <Modal
        open={open}
        titleId={titleId}
        descriptionId={descriptionId}
        onClose={() => setOpen(false)}
      >
        <ModalTitle id={titleId}>Export annotations</ModalTitle>
        <ModalDescription id={descriptionId}>
          Choose a versioned machine-readable export. Audio is not included.
        </ModalDescription>
        <fieldset className={styles.options} disabled={busy}>
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
        <fieldset className={styles.options} disabled={busy}>
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
        {feedback}
        <ModalActions>
          <Button type="button" onClick={() => setOpen(false)}>
            {busy ? 'Close' : 'Cancel'}
          </Button>
          <Button
            variant="primary"
            type="button"
            disabled={busy}
            onClick={() => void downloadAnnotations()}
          >
            {busy ? 'Preparing export…' : `Download ${format.toUpperCase()}`}
          </Button>
        </ModalActions>
      </Modal>
    </section>
  )
}
