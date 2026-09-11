import { describe, expect, it } from 'vitest'
import { EDITOR_SHORTCUT_GROUPS } from './editorShortcuts'

describe('editor shortcut reference', () => {
  it('documents marker creation, navigation, and both deletion shortcuts', () => {
    const markerItems = EDITOR_SHORTCUT_GROUPS.find(
      (group) => group.title === 'Markers',
    )?.items

    expect(markerItems).toContainEqual(['T', 'Create marker at playhead'])
    expect(markerItems).toContainEqual(['Tab', 'Select next marker'])
    expect(markerItems).toContainEqual([
      'Shift + Tab',
      'Select previous marker',
    ])
    expect(markerItems).toContainEqual([
      'Delete / Backspace',
      'Delete selected marker',
    ])
    expect(markerItems).toContainEqual([
      'Ctrl + D',
      'Delete selected region or marker',
    ])
  })
})
