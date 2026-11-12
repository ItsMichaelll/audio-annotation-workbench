import { describe, expect, it } from 'vitest'
import { sameOfflineScope } from './offlineAnalysisIdentity'

describe('offline analysis result identity', () => {
  it('accepts only matching source, scope and exact boundaries', () => {
    const buffer = {}
    const request = { buffer, scope: 'selection' as const, start: 1, end: 2 }
    expect(sameOfflineScope(request, { ...request })).toBe(true)
    expect(sameOfflineScope(request, { ...request, buffer: {} })).toBe(false)
    expect(sameOfflineScope(request, { ...request, scope: 'range' })).toBe(
      false,
    )
    expect(sameOfflineScope(request, { ...request, end: 2.001 })).toBe(false)
  })
})
