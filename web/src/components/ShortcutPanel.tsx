import styles from './ShortcutPanel.module.css'
import { EDITOR_SHORTCUT_GROUPS } from './editorShortcuts'

interface ShortcutPanelProps {
  collapsed: boolean
  onToggle(): void
}

export function ShortcutPanel({ collapsed, onToggle }: ShortcutPanelProps) {
  return (
    <aside
      className={`${styles.root}${collapsed ? ` ${styles.collapsed}` : ''}`}
    >
      <button
        className={styles.toggle}
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-controls="shortcut-reference"
        title={
          collapsed ? 'Show keyboard reference' : 'Hide keyboard reference'
        }
      >
        <span className={styles.icon} aria-hidden="true">
          ⌨
        </span>
        {!collapsed && <span>Shortcuts</span>}
      </button>
      {!collapsed && (
        <div id="shortcut-reference" className={styles.content}>
          {EDITOR_SHORTCUT_GROUPS.map((group) => (
            <section className={styles.group} key={group.title}>
              <h2 className={styles.heading}>{group.title}</h2>
              <dl className={styles.list}>
                {group.items.map(([keys, action]) => (
                  <div className={styles.item} key={keys}>
                    <dt className={styles.keys}>{keys}</dt>
                    <dd className={styles.action}>{action}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      )}
    </aside>
  )
}
