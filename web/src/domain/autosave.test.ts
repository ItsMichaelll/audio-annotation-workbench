import { describe, expect, it } from 'vitest'
import { AutosaveRevisionGate } from './autosave'

describe('autosave revision gate', () => {
  it('rejects completion from an older asynchronous save', () => {
    const gate = new AutosaveRevisionGate()
    const older = gate.issue()
    const latest = gate.issue()
    expect(gate.isCurrent(older)).toBe(false)
    expect(gate.isCurrent(latest)).toBe(true)
  })
})
