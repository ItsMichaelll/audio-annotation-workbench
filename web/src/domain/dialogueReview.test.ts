import { describe, expect, it } from 'vitest'
import {
  clampReviewAdjustment,
  clampReviewTime,
  createSavedDialogueReview,
  effectiveTrackOffset,
  parseSavedDialogueReview,
  planPairedSegment,
  proposedReviewRange,
  sourceTimeAtMixTime,
} from './dialogueReview'
import { SYNTHETIC_DIALOGUE_REVIEW } from '../features/dialogueReview/dialogueFixture'

describe('paired dialogue timing', () => {
  const input = SYNTHETIC_DIALOGUE_REVIEW
  const proposal = input.proposals[0]!

  it('maps mix time into source time without changing source samples', () => {
    expect(sourceTimeAtMixTime(3, -0.2)).toBe(3.2)
    expect(
      effectiveTrackOffset(input.tracks[1], proposal, 'original', 0.05),
    ).toBe(0)
    expect(
      effectiveTrackOffset(input.tracks[1], proposal, 'proposed', 0.05),
    ).toBeCloseTo(-0.15)
    expect(
      effectiveTrackOffset(input.tracks[0], proposal, 'proposed', 0.05),
    ).toBe(0)
  })

  it('schedules both tracks against one context clock at any playback rate', () => {
    expect(planPairedSegment(10, 0, { start: 2, end: 5 }, 100, 2)).toEqual({
      contextStart: 100,
      sourceStart: 2,
      sourceDuration: 3,
    })
    expect(planPairedSegment(10, 3, { start: 2, end: 5 }, 100, 2)).toEqual({
      contextStart: 100.5,
      sourceStart: 0,
      sourceDuration: 2,
    })
    expect(planPairedSegment(1, 8, { start: 2, end: 5 }, 100, 1)).toBeNull()
  })

  it('preserves the original proposal when applying an adjustment', () => {
    expect(proposedReviewRange(proposal, 0.025)).toEqual({
      start: 3.025,
      end: 4.625,
    })
    expect(proposal.original).toEqual({ start: 3.2, end: 4.8 })
  })

  it('clamps navigation to the declared active range', () => {
    expect(clampReviewTime(-1, input.activeRange)).toBe(0)
    expect(clampReviewTime(20, input.activeRange)).toBe(12)
    expect(clampReviewTime(Number.NaN, { start: 2, end: 10 })).toBe(2)
  })

  it('bounds adjustments to the active range and preserves proposal chronology', () => {
    expect(clampReviewAdjustment(input, proposal, -99)).toBe(-3)
    expect(clampReviewAdjustment(input, proposal, 99)).toBeCloseTo(2.8)
  })

  it('round trips decisions separately from proposals and source media', () => {
    const saved = createSavedDialogueReview(input)
    saved.decisions[0]!.decision = 'accepted'
    saved.decisions[0]!.notes = 'Synthetic review note'
    expect(
      parseSavedDialogueReview(JSON.parse(JSON.stringify(saved)), input),
    ).toEqual(saved)
    expect(JSON.stringify(saved)).not.toContain('AudioBuffer')
  })

  it('rejects stale identities and malformed adjustment values', () => {
    const saved = createSavedDialogueReview(input)
    expect(
      parseSavedDialogueReview({ ...saved, exportId: 'another-export' }, input),
    ).toBeNull()
    expect(
      parseSavedDialogueReview(
        { ...saved, sourceIds: ['replaced-source', saved.sourceIds[1]] },
        input,
      ),
    ).toBeNull()
    expect(
      parseSavedDialogueReview(
        {
          ...saved,
          decisions: [{ ...saved.decisions[0], adjustmentSeconds: Number.NaN }],
        },
        input,
      ),
    ).toBeNull()
  })
})
