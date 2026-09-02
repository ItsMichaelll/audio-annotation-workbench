import styles from './ShortcutPanel.module.css'

interface ShortcutPanelProps {
  collapsed: boolean
  onToggle(): void
}

const shortcutGroups = [
  {
    title: 'Transport',
    items: [
      ['Space', 'Play / pause'],
      ['← / →', 'Step 50 ms'],
      ['Shift + ← / →', 'Step 250 ms'],
      ['A / D', 'Step 1 second'],
      ['Home / End', 'File bounds'],
    ],
  },
  {
    title: 'View',
    items: [
      ['Wheel', 'Zoom at pointer'],
      ['Alt + wheel', 'Scale waveform height'],
      ['Shift + wheel', 'Pan or nudge selected region'],
      ['Middle drag', 'Pan'],
      ['Alt + left drag', 'Pan'],
      ['F', 'Fit file'],
      ['+ / −', 'Zoom at playhead'],
    ],
  },
  {
    title: 'Regions',
    items: [
      ['Left drag', 'Create region'],
      ['Double-click', 'Play region'],
      ['Ctrl + ← / →', 'Previous / next region'],
      ['L', 'Toggle loop'],
      ['Delete / Backspace', 'Delete region'],
      ['Ctrl + D', 'Delete region'],
      ['Escape', 'Clear selection'],
      ['Ctrl + Z', 'Undo'],
      ['Ctrl + Y', 'Redo'],
    ],
  },
]

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
          {shortcutGroups.map((group) => (
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
