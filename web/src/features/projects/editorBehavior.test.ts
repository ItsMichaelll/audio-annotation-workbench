import { describe, expect, it } from 'vitest'
import { isSaveShortcut, shouldProtectLinkNavigation } from './editorBehavior'

describe('configuration editor keyboard behavior', () => {
  it('recognizes Ctrl+S and Command+S while an editor is focused', () => {
    expect(
      isSaveShortcut({
        key: 's',
        ctrlKey: true,
        metaKey: false,
        altKey: false,
      }),
    ).toBe(true)
    expect(
      isSaveShortcut({
        key: 'S',
        ctrlKey: false,
        metaKey: true,
        altKey: false,
      }),
    ).toBe(true)
  })

  it('protects only ordinary same-tab, same-origin link navigation', () => {
    const intent = {
      button: 0,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      download: false,
      target: '',
      linkOrigin: 'https://workbench.test',
      pageOrigin: 'https://workbench.test',
    }
    expect(shouldProtectLinkNavigation(intent)).toBe(true)
    expect(shouldProtectLinkNavigation({ ...intent, ctrlKey: true })).toBe(
      false,
    )
    expect(shouldProtectLinkNavigation({ ...intent, target: '_blank' })).toBe(
      false,
    )
    expect(
      shouldProtectLinkNavigation({
        ...intent,
        linkOrigin: 'https://example.test',
      }),
    ).toBe(false)
    expect(shouldProtectLinkNavigation({ ...intent, download: true })).toBe(
      false,
    )
  })

  it('does not claim unrelated or Alt-modified shortcuts', () => {
    expect(
      isSaveShortcut({
        key: 's',
        ctrlKey: false,
        metaKey: false,
        altKey: false,
      }),
    ).toBe(false)
    expect(
      isSaveShortcut({ key: 's', ctrlKey: true, metaKey: false, altKey: true }),
    ).toBe(false)
  })
})
