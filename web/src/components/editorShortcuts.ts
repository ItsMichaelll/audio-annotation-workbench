export interface EditorShortcutGroup {
  title: string
  items: readonly (readonly [keys: string, action: string])[]
}

export const EDITOR_SHORTCUT_GROUPS: readonly EditorShortcutGroup[] = [
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
      ['Ctrl / Cmd + A', 'Select all regions in the editor'],
      ['Ctrl / Cmd + click', 'Toggle region selection'],
      ['L', 'Toggle loop'],
      ['Delete / Backspace', 'Delete selected regions'],
      ['Ctrl + D', 'Delete selected region or marker'],
      ['Escape', 'Clear selection'],
      ['Ctrl + Z', 'Undo'],
      ['Ctrl + Y / Ctrl + Shift + Z', 'Redo'],
    ],
  },
  {
    title: 'Markers',
    items: [
      ['T', 'Create marker at playhead'],
      ['Tab', 'Select next marker'],
      ['Shift + Tab', 'Select previous marker'],
      ['Delete / Backspace', 'Delete selected marker'],
      ['Ctrl + D', 'Delete selected region or marker'],
    ],
  },
]
