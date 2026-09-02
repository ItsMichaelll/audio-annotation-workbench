import { useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router'
import { Button, ButtonLink } from '../../components/Button'
import { useConfirmation } from '../../components/confirmationContext'
import {
  PROJECT_BACKUP_MAX_BYTES,
  backupRecordCounts,
  mediaRelinkCount,
  parseProjectBackup,
  type ProjectBackup,
} from '../../domain/projectBackup'
import { projectPath } from '../../routes'
import { formatTimestamp } from './format'
import { PageNotice, ProjectLayout } from './ProjectLayout'
import {
  isProjectRestoreCollision,
  restoreProjectBackup,
} from './projectActions'

const MAX_SIZE_LABEL = '10 MB'

export function ProjectRestorePreview({
  backup,
  busy,
  onRestore,
}: {
  backup: ProjectBackup
  busy: boolean
  onRestore: () => void
}) {
  const counts = backupRecordCounts(backup)
  return (
    <section className="detail-section restore-preview">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Validated preview</p>
          <h2>{backup.project.name}</h2>
        </div>
      </div>
      <dl className="restore-counts">
        <div>
          <dt>Exported</dt>
          <dd>{formatTimestamp(backup.exportedAt)}</dd>
        </div>
        <div>
          <dt>Taxonomy versions</dt>
          <dd>{counts.taxonomyVersions}</dd>
        </div>
        <div>
          <dt>Instructions</dt>
          <dd>{counts.instructions}</dd>
        </div>
        <div>
          <dt>Tasks</dt>
          <dd>{counts.tasks}</dd>
        </div>
        <div>
          <dt>Annotations</dt>
          <dd>{counts.annotations}</dd>
        </div>
        <div>
          <dt>Media to relink</dt>
          <dd>{mediaRelinkCount(backup)}</dd>
        </div>
      </dl>
      <Button
        variant="primary"
        type="button"
        disabled={busy}
        onClick={onRestore}
      >
        {busy ? 'Restoring…' : 'Restore backup'}
      </Button>
    </section>
  )
}

export function ProjectRestore() {
  const navigate = useNavigate()
  const confirm = useConfirmation()
  const backupInput = useRef<HTMLInputElement>(null)
  const [backup, setBackup] = useState<ProjectBackup | null>(null)
  const [filename, setFilename] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const selectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    setBackup(null)
    setError(null)
    setFilename(file?.name ?? '')
    if (!file) return
    if (file.size > PROJECT_BACKUP_MAX_BYTES) {
      setError(`The backup exceeds the ${MAX_SIZE_LABEL} restore limit.`)
      return
    }
    try {
      setBackup(parseProjectBackup(await file.text()))
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'The backup is invalid.',
      )
    }
  }

  const restore = async () => {
    if (!backup || busy) return
    setBusy(true)
    setError(null)
    try {
      try {
        await restoreProjectBackup(backup)
      } catch (reason) {
        if (!isProjectRestoreCollision(reason)) throw reason
        const accepted = await confirm({
          title: `Replace “${backup.project.name}”?`,
          message:
            'A project with this stable ID already exists. Replacing it atomically removes that project and restores this backup. Other projects are not affected.',
          confirmLabel: 'Replace project',
          tone: 'danger',
        })
        if (!accepted) {
          setError('Restore cancelled because the project ID already exists.')
          return
        }
        await restoreProjectBackup(backup, true)
      }
      const relinkCount = mediaRelinkCount(backup)
      navigate(projectPath(backup.project.id), {
        replace: true,
        state: {
          completionMessage: `Backup restored. ${relinkCount} media ${
            relinkCount === 1 ? 'source needs' : 'sources need'
          } relinking.`,
        },
      })
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Project restoration failed.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <ProjectLayout
      actions={<ButtonLink to="/projects">Back to projects</ButtonLink>}
    >
      <main className="project-page restore-page">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Recovery</p>
            <h1>Restore project backup</h1>
            <p>
              Validate and preview a project backup before writing any browser
              data.
            </p>
          </div>
        </div>

        <section className="detail-section restore-panel">
          <label htmlFor="backup-file">Project backup JSON</label>
          <input
            ref={backupInput}
            id="backup-file"
            className="visually-hidden"
            type="file"
            accept=".json,application/json"
            disabled={busy}
            onChange={(event) => void selectFile(event)}
          />
          <Button
            size="square"
            type="button"
            disabled={busy}
            onClick={() => backupInput.current?.click()}
          >
            {filename ? 'Choose another backup' : 'Choose backup file'}
          </Button>
          <span style={{ maxWidth: '420px' }}>
            <p className="muted-copy">Maximum file size: {MAX_SIZE_LABEL}</p>
            <p className="muted-copy">
              Imported content is treated as untrusted JSON. Source audio is not
              part of a backup.
            </p>
          </span>
          {filename && (
            <div className="file-selection">
              <strong>{filename}</strong>
              <span>Selected backup</span>
            </div>
          )}
        </section>

        {error && (
          <PageNotice title="Backup could not be restored" tone="error">
            <p>{error}</p>
          </PageNotice>
        )}

        {backup && (
          <ProjectRestorePreview
            backup={backup}
            busy={busy}
            onRestore={() => void restore()}
          />
        )}
      </main>
    </ProjectLayout>
  )
}
