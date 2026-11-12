export interface ReviewRange {
  start: number
  end: number
}

export interface DialogueTrack {
  id: string
  name: string
  sourceId: string
  /** Mix time at which source sample zero appears. */
  offsetSeconds: number
}

export interface TimingProposal {
  id: string
  trackId: string
  original: ReviewRange
  proposed: ReviewRange
  shiftSeconds: number
  provenance: string
}

export interface DialogueReviewInput {
  schemaVersion: 1
  sessionId: string
  exportId: string
  handoffId: string
  title: string
  tracks: readonly [DialogueTrack, DialogueTrack]
  activeRange: ReviewRange
  proposals: readonly TimingProposal[]
}

export type ReviewDecision = 'pending' | 'accepted' | 'rejected'
export type ReviewVersion = 'original' | 'proposed'

export interface SavedTimingDecision {
  proposalId: string
  decision: ReviewDecision
  adjustmentSeconds: number
  notes: string
}

export interface SavedDialogueReview {
  schemaVersion: 1
  sessionId: string
  exportId: string
  handoffId: string
  sourceIds: [string, string]
  activeProposalId: string | null
  decisions: SavedTimingDecision[]
}

export function sourceTimeAtMixTime(
  mixTime: number,
  offsetSeconds: number,
): number {
  return mixTime - offsetSeconds
}

export function planPairedSegment(
  sourceDuration: number,
  offsetSeconds: number,
  mixRange: ReviewRange,
  contextStart: number,
  rate: number,
): {
  contextStart: number
  sourceStart: number
  sourceDuration: number
} | null {
  if (!(rate > 0) || !(sourceDuration > 0)) return null
  const start = Math.max(mixRange.start, offsetSeconds)
  const end = Math.min(mixRange.end, offsetSeconds + sourceDuration)
  if (end <= start) return null
  return {
    contextStart: contextStart + (start - mixRange.start) / rate,
    sourceStart: start - offsetSeconds,
    sourceDuration: end - start,
  }
}

export function effectiveTrackOffset(
  track: DialogueTrack,
  proposal: TimingProposal | null,
  version: ReviewVersion,
  adjustmentSeconds: number,
): number {
  const shift =
    proposal?.trackId === track.id && version === 'proposed'
      ? proposal.shiftSeconds + adjustmentSeconds
      : 0
  return track.offsetSeconds + shift
}

export function proposedReviewRange(
  proposal: TimingProposal,
  adjustmentSeconds: number,
): ReviewRange {
  return {
    start: proposal.proposed.start + adjustmentSeconds,
    end: proposal.proposed.end + adjustmentSeconds,
  }
}

export function clampReviewTime(time: number, range: ReviewRange): number {
  return Math.max(
    range.start,
    Math.min(range.end, Number.isFinite(time) ? time : range.start),
  )
}

export function clampReviewAdjustment(
  input: DialogueReviewInput,
  proposal: TimingProposal,
  seconds: number,
): number {
  const chronological = orderedTimingProposals(input.proposals).filter(
    (item) => item.trackId === proposal.trackId,
  )
  const index = chronological.findIndex((item) => item.id === proposal.id)
  const previous = chronological[index - 1]
  const next = chronological[index + 1]
  const lower =
    Math.max(
      input.activeRange.start,
      previous?.original.end ?? input.activeRange.start,
    ) - proposal.proposed.start
  const upper =
    Math.min(
      input.activeRange.end,
      next?.original.start ?? input.activeRange.end,
    ) - proposal.proposed.end
  return Math.max(
    lower,
    Math.min(upper, Number.isFinite(seconds) ? seconds : 0),
  )
}

export function orderedTimingProposals(
  proposals: readonly TimingProposal[],
): TimingProposal[] {
  return [...proposals].sort(
    (a, b) => a.original.start - b.original.start || a.id.localeCompare(b.id),
  )
}

export function createSavedDialogueReview(
  input: DialogueReviewInput,
): SavedDialogueReview {
  return {
    schemaVersion: 1,
    sessionId: input.sessionId,
    exportId: input.exportId,
    handoffId: input.handoffId,
    sourceIds: [input.tracks[0].sourceId, input.tracks[1].sourceId],
    activeProposalId: orderedTimingProposals(input.proposals)[0]?.id ?? null,
    decisions: input.proposals.map((proposal) => ({
      proposalId: proposal.id,
      decision: 'pending',
      adjustmentSeconds: 0,
      notes: '',
    })),
  }
}

export function dialogueReviewStorageKey(
  input: Pick<
    DialogueReviewInput,
    'sessionId' | 'exportId' | 'handoffId' | 'tracks'
  >,
): string {
  return JSON.stringify([
    input.sessionId,
    input.exportId,
    input.handoffId,
    input.tracks.map((track) => track.sourceId),
  ])
}

export function parseSavedDialogueReview(
  value: unknown,
  input: DialogueReviewInput,
): SavedDialogueReview | null {
  if (!value || typeof value !== 'object') return null
  if (
    !('schemaVersion' in value) ||
    value.schemaVersion !== 1 ||
    !('sessionId' in value) ||
    value.sessionId !== input.sessionId ||
    !('exportId' in value) ||
    value.exportId !== input.exportId ||
    !('handoffId' in value) ||
    value.handoffId !== input.handoffId ||
    !('sourceIds' in value) ||
    !Array.isArray(value.sourceIds) ||
    value.sourceIds.length !== 2 ||
    value.sourceIds[0] !== input.tracks[0].sourceId ||
    value.sourceIds[1] !== input.tracks[1].sourceId ||
    !('decisions' in value) ||
    !Array.isArray(value.decisions)
  )
    return null
  const initial = createSavedDialogueReview(input)
  for (const entry of value.decisions) {
    if (
      !entry ||
      typeof entry !== 'object' ||
      !('proposalId' in entry) ||
      typeof entry.proposalId !== 'string' ||
      !('decision' in entry) ||
      !['pending', 'accepted', 'rejected'].includes(String(entry.decision)) ||
      !('adjustmentSeconds' in entry) ||
      typeof entry.adjustmentSeconds !== 'number' ||
      !Number.isFinite(entry.adjustmentSeconds) ||
      !('notes' in entry) ||
      typeof entry.notes !== 'string'
    )
      return null
    const decision = initial.decisions.find(
      (item) => item.proposalId === entry.proposalId,
    )
    if (!decision) continue
    decision.decision =
      entry.decision === 'accepted'
        ? 'accepted'
        : entry.decision === 'rejected'
          ? 'rejected'
          : 'pending'
    decision.adjustmentSeconds = entry.adjustmentSeconds
    decision.notes = entry.notes
  }
  if (
    'activeProposalId' in value &&
    typeof value.activeProposalId === 'string' &&
    input.proposals.some((proposal) => proposal.id === value.activeProposalId)
  )
    initial.activeProposalId = value.activeProposalId
  return initial
}
