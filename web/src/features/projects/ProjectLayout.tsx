import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ButtonLink } from '../../components/Button'

interface ProjectLayoutProps {
  children: ReactNode
  actions?: ReactNode
}

export function ProjectLayout({ children, actions }: ProjectLayoutProps) {
  return (
    <div className="project-app-shell">
      <header className="project-header">
        <Link
          className="brand brand--link"
          to="/"
          aria-label="Projects dashboard"
        >
          <span className="brand__mark" aria-hidden="true">
            AAW
          </span>
          <div>
            <span className="brand__title">Audio Annotation Workbench</span>
            <span className="brand__subtitle">
              A minimalistic audio annotation tool
            </span>
          </div>
        </Link>
        <div className="project-header__actions">
          <span className="privacy-note">Data stays in this browser</span>
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
      className={`page-notice page-notice--${tone}`}
      role={tone === 'error' ? 'alert' : undefined}
    >
      <strong>{title}</strong>
      <div>{children}</div>
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
      <main className="project-page project-page--narrow">
        <div className="state-panel">
          <h1>{title}</h1>
          <p>{message}</p>
          <ButtonLink variant="primary" to="/projects">
            Back to projects
          </ButtonLink>
        </div>
      </main>
    </ProjectLayout>
  )
}
