import { describe, expect, it } from 'vitest'
import { parseInspectionEvidence } from './inspectionEvidence'

describe('local inspection evidence', () => {
  it('orders supplied transcript and retains score provenance', () => {
    const result = parseInspectionEvidence(
      {
        transcript: [
          {
            id: 'row',
            speaker: 'speaker',
            start: 1,
            end: 2,
            text: 'Sample text',
          },
        ],
        scores: [
          {
            id: 'score',
            name: 'Quality',
            value: 4,
            unit: 'MOS',
            source: 'local evaluator',
            start: 0,
            end: 2,
          },
        ],
      },
      3,
    )
    expect(result.transcript[0]?.start).toBe(1)
    expect(result.scores[0]?.source).toBe('local evaluator')
    expect(result.warnings).toEqual([])
  })

  it('rejects nonfinite values, missing units, invalid ranges and duplicate IDs', () => {
    const row = {
      id: 'row',
      speaker: 'speaker',
      start: 1,
      end: 2,
      text: 'Sample',
    }
    const result = parseInspectionEvidence(
      {
        transcript: [row, row, { ...row, id: 'bad', end: 9 }],
        scores: [{ id: 'x', name: 'Unverified', value: Infinity }],
      },
      3,
    )
    expect(result.transcript).toHaveLength(1)
    expect(result.scores).toEqual([])
    expect(result.warnings).toHaveLength(3)
  })

  it('does not infer evidence from unrelated metadata', () => {
    expect(parseInspectionEvidence({ note: 'sample' }, 3)).toEqual({
      transcript: [],
      scores: [],
      warnings: [],
    })
  })

  it('reports malformed containers instead of silently accepting empty evidence', () => {
    const result = parseInspectionEvidence(
      { transcript: 'text', scores: {} },
      3,
    )
    expect(result.warnings).toHaveLength(2)
    expect(result.transcript).toEqual([])
    expect(result.scores).toEqual([])
  })
})
