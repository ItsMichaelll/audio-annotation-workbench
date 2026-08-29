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
      ['Shift + wheel', 'Nudge region'],
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
    <aside className={collapsed ? 'shortcuts is-collapsed' : 'shortcuts'}>
      <button
        className="shortcuts__toggle"
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-controls="shortcut-reference"
        title={
          collapsed ? 'Show keyboard reference' : 'Hide keyboard reference'
        }
      >
        <span aria-hidden="true">⌨</span>
        {!collapsed && <span>Shortcuts</span>}
      </button>
      {!collapsed && (
        <div id="shortcut-reference" className="shortcuts__content">
          {shortcutGroups.map((group) => (
            <section key={group.title}>
              <h2>{group.title}</h2>
              <dl>
                {group.items.map(([keys, action]) => (
                  <div key={keys}>
                    <dt>{keys}</dt>
                    <dd>{action}</dd>
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
