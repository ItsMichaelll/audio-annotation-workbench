import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import {
  loadListeningPreference,
  saveListeningPreference,
} from './listeningPreferences'

describe('source-bound listening reference persistence', () => {
  it('round-trips reference timing and invalidates changed source geometry', async () => {
    const database = `listening-${crypto.randomUUID()}`
    const reference = {
      sourceIdentity: 'track-a',
      sampleRate: 48000,
      frames: 480000,
      channels: 1,
      ranges: [{ id: 'r', start: 1, end: 5 }],
      measuredLufs: -30,
      targetLufs: -23,
    }
    await saveListeningPreference(reference, database)
    expect(
      await loadListeningPreference(
        'track-a',
        { sampleRate: 48000, length: 480000, numberOfChannels: 1 },
        database,
      ),
    ).toEqual(reference)
    expect(
      await loadListeningPreference(
        'track-a',
        { sampleRate: 48000, length: 960000, numberOfChannels: 1 },
        database,
      ),
    ).toBeNull()
    expect(
      await loadListeningPreference(
        'track-b',
        { sampleRate: 48000, length: 480000, numberOfChannels: 1 },
        database,
      ),
    ).toBeNull()
  })
})
