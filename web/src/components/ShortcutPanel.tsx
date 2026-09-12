import styles from './ShortcutPanel.module.css'
import {
  EDITOR_SHORTCUT_GROUPS,
  type EditorShortcutGroup,
} from './editorShortcuts'

export interface ShortcutPanelProps {
  labels?: readonly { name: string; shortcut?: string }[]
}

export function ShortcutPanel({ labels }: ShortcutPanelProps) {
  const shortcutGroups: EditorShortcutGroup[] = [...EDITOR_SHORTCUT_GROUPS]
  if (labels) {
    shortcutGroups.push({
      title: 'Task workflow',
      items: [
        ['Ctrl + Enter', 'Submit and next'],
        ['Ctrl + Shift + Enter', 'Skip and next'],
        ...labels.flatMap((label): [string, string][] =>
          label.shortcut
            ? [[label.shortcut, `Select or toggle ${label.name}`]]
            : [],
        ),
      ],
    })
  }
  return (
    <div className={styles.content}>
      {shortcutGroups.map((group) => (
        <section className={styles.group} key={group.title}>
          <h3 className={styles.heading}>{group.title}</h3>
          {group.title === 'Markers' && (
            <p className={styles.scopeNote}>
              Focus the waveform for these shortcuts; Ctrl+D also works outside
              it. At either boundary, Tab navigation returns to normal focus
              movement.
            </p>
          )}
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
  )
}
