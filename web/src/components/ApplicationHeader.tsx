import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import { Icon } from './Icon'
import styles from './ApplicationHeader.module.css'

export function ApplicationHeader({
  children,
  onNavigate,
  projectName,
  skipTarget = 'editor-workspace',
}: {
  children?: ReactNode
  onNavigate?: (path: string) => Promise<void>
  projectName?: string
  skipTarget?: string
}) {
  return (
    <header className={styles.root} data-theme="light">
      <a className={styles.skip} href={`#${skipTarget}`}>
        Skip to workspace
      </a>
      <NavLink
        className={styles.brand ?? ''}
        to="/projects"
        aria-label="Audio Workbench · Projects"
        onClick={
          onNavigate
            ? (event) => {
                event.preventDefault()
                void onNavigate('/projects')
              }
            : undefined
        }
      >
        <span className={styles.mark}>
          <Icon name="waveform" size={22} />
        </span>
        <span>
          Audio<span className={styles.brandLight}> Workbench</span>
        </span>
      </NavLink>
      <nav className={styles.navigation} aria-label="Application">
        <NavLink
          to="/projects"
          className={styles.destination ?? ''}
          onClick={
            onNavigate
              ? (event) => {
                  event.preventDefault()
                  void onNavigate('/projects')
                }
              : undefined
          }
        >
          <Icon name="folder" />
          Projects
        </NavLink>
        {projectName ? (
          <span className={styles.context} title={projectName}>
            {projectName}
          </span>
        ) : (
          <NavLink to="/editor" className={styles.destination ?? ''}>
            Editor
          </NavLink>
        )}
      </nav>
      <div className={styles.actions}>
        <span className={styles.local}>
          <span />
          Local workspace
        </span>
        {children}
      </div>
    </header>
  )
}
