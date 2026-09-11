import styles from './ShortcutPanel.module.css'

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
    title: 'Task workflow',
    items: [
      ['Ctrl + Enter', 'Submit and next'],
      ['Ctrl + Shift + Enter', 'Skip and next'],
      ['1–9 / assigned key', 'Apply taxonomy label'],
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

export function ShortcutPanel() {
  return (
    <div className={styles.content}>
      {shortcutGroups.map((group) => (
        <section className={styles.group} key={group.title}>
          <h3 className={styles.heading}>{group.title}</h3>
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
