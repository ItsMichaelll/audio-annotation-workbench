import { describe, expect, it } from 'vitest'
import {
  listeningGainDb,
  normalizeListeningRanges,
  playbackClippingRanges,
} from './listeningNormalization'

describe('listening normalization', () => {
  it('uses one fixed difference between measured and target loudness', () => {
    expect(listeningGainDb(-30, -23)).toBe(7)
    expect(listeningGainDb(-18, -23)).toBe(-5)
    expect(listeningGainDb(-Infinity, -23)).toBeNull()
    expect(listeningGainDb(-90, -23)).toBeNull()
  })
  it('bounds ranges and avoids counting overlapping speech twice', () => {
    expect(
      normalizeListeningRanges(
        [
          { id: 'a', start: 1, end: 3 },
          { id: 'b', start: 2, end: 4 },
          { id: 'c', start: -1, end: 1 },
          { id: 'd', start: 4, end: 6 },
        ],
        5,
      ),
    ).toEqual([{ id: 'a', start: 1, end: 4 }])
  })
  it('keeps playback clipping independent of original samples', () => {
    const samples = new Float32Array([0, 0.5, 0, 0.8, 0])
    expect(playbackClippingRanges([samples], 1000, 0)).toEqual([])
    expect(playbackClippingRanges([samples], 1000, 6)).toEqual([
      { id: 'playback-clipping-3', start: 0.003, end: 0.004 },
    ])
    expect(samples[3]).toBeCloseTo(0.8)
  })
})
