import { describe, expect, it } from 'vitest'
import { nextEditorFocus } from './editorFocus'

describe('editor focus', () => {
  it('cycles through normal, annotations, waveform and back', () => {
    expect(nextEditorFocus('normal')).toBe('annotations')
    expect(nextEditorFocus('annotations')).toBe('waveform')
    expect(nextEditorFocus('waveform')).toBe('normal')
  })
})
