import { describe, expect, it } from 'vitest'
import {
  addMarker,
  adjacentMarker,
  chronologicalMarkers,
  MARKER_TIME_TOLERANCE_SECONDS,
  markerOrdinal,
  normalizeMarkers,
  removeMarker,
  seekToMarkerWithoutPlaybackChange,
  updateMarker,
} from './marker'

const markers = [
  { id: 'late', time: 8 },
  { id: 'early', time: 1 },
  { id: 'middle', time: 4 },
]

describe('marker domain', () => {
  it('creates stable markers and rejects timestamps within displayed precision', () => {
    const created = addMarker([], { id: 'stable-id', time: 2.5 }, 10)
    expect(created).toEqual([{ id: 'stable-id', time: 2.5 }])
    expect(
      addMarker(
        created,
        {
          id: 'duplicate',
          time: 2.5 + MARKER_TIME_TOLERANCE_SECONDS / 2,
        },
        10,
      ),
    ).toEqual(created)
  })

  it('navigates chronologically from selection or the playhead', () => {
    expect(chronologicalMarkers(markers).map(({ id }) => id)).toEqual([
      'early',
      'middle',
      'late',
    ])
    expect(adjacentMarker(markers, 'middle', 0, 'previous')?.id).toBe('early')
    expect(adjacentMarker(markers, 'middle', 0, 'next')?.id).toBe('late')
    expect(adjacentMarker(markers, null, 2, 'next')?.id).toBe('middle')
    expect(adjacentMarker(markers, null, 6, 'previous')?.id).toBe('middle')
    expect(markerOrdinal(markers, 'middle')).toBe(2)
  })

  it('returns no target at Tab navigation boundaries', () => {
    expect(adjacentMarker(markers, 'late', 0, 'next')).toBeNull()
    expect(adjacentMarker(markers, 'early', 0, 'previous')).toBeNull()
  })

  it('updates a dragged timestamp and deletes only the selected marker', () => {
    expect(updateMarker(markers, { id: 'middle', time: 6 }, 10)).toContainEqual(
      { id: 'middle', time: 6 },
    )
    expect(removeMarker(markers, 'middle').map(({ id }) => id)).toEqual([
      'late',
      'early',
    ])
  })

  it('defaults legacy storage to empty and protects IDs used by regions', () => {
    expect(normalizeMarkers(undefined)).toEqual([])
    expect(
      normalizeMarkers(
        [
          { id: 'region-id', time: 2 },
          { id: 'marker-id', time: 12 },
        ],
        10,
        new Set(['region-id']),
      ),
    ).toEqual([{ id: 'marker-id', time: 10 }])
  })

  it.each([true, false])(
    'seeks without changing a %s playback state',
    (playing) => {
      const playbackState = playing
      let playhead = 0
      const bounded = seekToMarkerWithoutPlaybackChange(12, 10, (time) => {
        playhead = time
      })

      expect(bounded).toBe(10)
      expect(playhead).toBe(10)
      expect(playbackState).toBe(playing)
    },
  )
})
