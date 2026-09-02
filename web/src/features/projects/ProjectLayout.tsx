import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ButtonLink } from '../../components/Button'
import styles from './ProjectLayout.module.css'

interface ProjectLayoutProps {
  children: ReactNode
  actions?: ReactNode
}

export function ProjectLayout({ children, actions }: ProjectLayoutProps) {
  return (
    <div className={`${styles.shell} project-app-shell`}>
      <header className={styles.header}>
        <Link
          className={`${styles.brand} ${styles.brandLink}`}
          to="/"
          aria-label="Projects dashboard"
        >
          <span className={styles.brandMark} aria-hidden="true">
            AAW
          </span>
          <div>
            <span className={styles.brandTitle}>
              Audio Annotation Workbench
            </span>
            <span className={styles.brandSubtitle}>
              A minimalistic audio annotation tool
            </span>
          </div>
        </Link>
        <div className={styles.headerActions}>
          <span className={styles.privacyNote}>Data stays in this browser</span>
          {actions}
        </div>
      </header>
      {children}
    </div>
  )
}

export function PageNotice({
  title,
  children,
  tone = 'neutral',
}: {
  title: string
  children: ReactNode
  tone?: 'neutral' | 'error' | 'warning'
}) {
  return (
    <div
      className={`${styles.notice} ${
        tone === 'warning'
          ? styles.noticeWarning
          : tone === 'error'
            ? styles.noticeError
            : ''
      }`}
      role={tone === 'error' ? 'alert' : undefined}
    >
      <strong className={styles.noticeTitle}>{title}</strong>
      <div className={styles.noticeBody}>{children}</div>
    </div>
  )
}

export function ProjectPageState({
  title,
  message,
}: {
  title: string
  message: string
}) {
  return (
    <ProjectLayout>
      <main className={`${styles.page} ${styles.pageNarrow}`}>
        <div className={styles.statePanel}>
          <h1 className={styles.statePanelTitle}>{title}</h1>
          <p className={styles.statePanelDescription}>{message}</p>
          <ButtonLink variant="primary" to="/projects">
            Back to projects
          </ButtonLink>
        </div>
      </main>
    </ProjectLayout>
  )
}
