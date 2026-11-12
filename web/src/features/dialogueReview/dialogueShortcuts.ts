import type { EditorShortcutGroup } from '../../components/editorShortcuts'

export const DIALOGUE_REVIEW_SHORTCUTS: readonly EditorShortcutGroup[] = [
  {
    title: 'Playback',
    items: [
      ['Space', 'Play / pause both aligned tracks'],
      ['← / →', 'Step 50 ms'],
      ['Shift + ← / →', 'Step 250 ms'],
      ['Double-click region', 'Play and loop its exact bounds'],
    ],
  },
  {
    title: 'View',
    items: [
      ['M', 'Cycle focus mode'],
      ['Hold P', 'Temporarily reveal collapsed partner lanes'],
      ['Wheel', 'Zoom both lanes at pointer'],
      ['Middle / Alt + left drag', 'Pan both lanes'],
      ['Alt + wheel', 'Scale waveform height'],
      ['H / ?', 'Open keyboard help'],
    ],
  },
  {
    title: 'Listening selections',
    items: [
      ['Drag empty waveform', 'Create temporary listening region'],
      ['Drag edge / region', 'Resize / move a listening region'],
      [
        'Click proposal',
        'Select review context and seek without starting playback',
      ],
    ],
  },
  {
    title: 'Review',
    items: [
      ['Ctrl / Cmd + Z', 'Undo review decision, adjustment or notes'],
      ['Ctrl / Cmd + Shift + Z', 'Redo review edit'],
      ['Tab / Shift + Tab', 'Navigate controls in document order'],
    ],
  },
]
