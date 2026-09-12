import { useRef, useState, type ChangeEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { useConfirmation } from '../../components/confirmationContext'
import {
  backupRecordCounts,
  mediaRelinkCount,
  parseProjectBackupFile,
  type ProjectBackup,
} from '../../domain/projectBackup'
import { projectPath } from '../../routes'
import { formatTimestamp } from './format'
import { PageNotice, ProjectLayout } from './ProjectLayout'
import layoutStyles from './ProjectLayout.module.css'
import styles from './ProjectRestore.module.css'
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
    <section className={styles.preview}>
      <div className={styles.sectionHeading}>
        <div>
          <p className={`${layoutStyles.eyebrow} ${styles.eyebrow}`}>
            Validated preview
          </p>
          <h2 className={styles.sectionTitle}>{backup.project.name}</h2>
        </div>
      </div>
      {!!backup.project.sourceFolders?.length && (
        <p>
          Reconnect {backup.project.sourceFolders.length} source folder(s) after
          restoration to recover all matching tasks. Audio and folder
          permissions are not included in backups.
        </p>
      )}
      <dl className={styles.counts}>
        <div className={styles.count}>
          <dt className={styles.countLabel}>Exported</dt>
          <dd className={styles.countValue}>
            {formatTimestamp(backup.exportedAt)}
          </dd>
        </div>
        <div className={styles.count}>
          <dt className={styles.countLabel}>Taxonomy versions</dt>
          <dd className={styles.countValue}>{counts.taxonomyVersions}</dd>
        </div>
        <div className={styles.count}>
          <dt className={styles.countLabel}>Instructions</dt>
          <dd className={styles.countValue}>{counts.instructions}</dd>
        </div>
        <div className={styles.count}>
          <dt className={styles.countLabel}>Tasks</dt>
          <dd className={styles.countValue}>{counts.tasks}</dd>
        </div>
        <div className={styles.count}>
          <dt className={styles.countLabel}>Annotations</dt>
          <dd className={styles.countValue}>{counts.annotations}</dd>
        </div>
        <div className={styles.count}>
          <dt className={styles.countLabel}>Media to relink</dt>
          <dd className={styles.countValue}>{mediaRelinkCount(backup)}</dd>
        </div>
      </dl>
      <Button
        className={styles.restoreAction}
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
    try {
      setBackup(await parseProjectBackupFile(file))
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
          } relinking.${backup.project.sourceFolders?.length ? ' Reconnect the saved source folders to restore all matching tasks.' : ''}`,
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
    <ProjectLayout>
      <main className={layoutStyles.page}>
        <div className={layoutStyles.breadcrumbs}>
          <Link to="/projects">Projects</Link>
          <span aria-hidden="true">/</span>
          <span>Restore backup</span>
        </div>
        <div className={layoutStyles.pageHeading}>
          <div>
            <p className={layoutStyles.eyebrow}>Recovery</p>
            <h1 className={layoutStyles.pageHeadingTitle}>
              Restore project backup
            </h1>
            <p className={layoutStyles.pageHeadingDescription}>
              Validate and preview a project backup before writing any browser
              data.
            </p>
          </div>
        </div>

        <div className={styles.workspace}>
          <section className={styles.panel}>
            <Icon name="upload" size={28} />
            <h2 className={styles.sectionTitle}>Choose your recovery file</h2>
            <label className={styles.fieldLabel} htmlFor="backup-file">
              Project backup JSON
            </label>
            <input
              ref={backupInput}
              id="backup-file"
              hidden
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
            <div className={styles.helper}>
              <p className={styles.mutedCopy}>
                Maximum file size: {MAX_SIZE_LABEL}
              </p>
              <p className={styles.mutedCopy}>
                We’ll check the file before restoring anything. Backups don’t
                include source audio; keep your original recordings available.
              </p>
            </div>
            {filename && (
              <div className={styles.fileSelection}>
                <strong>{filename}</strong>
                <span className={styles.fileSelectionName}>
                  Selected backup
                </span>
              </div>
            )}
          </section>
          <div>
            {error && (
              <PageNotice title="Backup could not be restored" tone="error">
                <p>{error}</p>
              </PageNotice>
            )}

            {backup ? (
              <ProjectRestorePreview
                backup={backup}
                busy={busy}
                onRestore={() => void restore()}
              />
            ) : (
              <section className={styles.emptyPreview}>
                <Icon name="folder" size={32} />
                <h2>Review before you restore</h2>
                <p>
                  Select a backup to review its project, annotations, and media
                  requirements here. Nothing changes until you confirm.
                </p>
              </section>
            )}
          </div>
        </div>
      </main>
    </ProjectLayout>
  )
}
