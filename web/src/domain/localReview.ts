export interface LocalProposal {
  id: string
  start: number
  end: number
  label: string
  source: string
  score?: number
}

export interface ReviewDecision {
  proposalId: string
  status: 'accepted' | 'dismissed'
}

export interface FeedbackEvidence {
  id: string
  proposalId: string | null
  start: number
  end: number
  notes: string
}

export interface LocalReviewContent {
  decisions: ReviewDecision[]
  feedback: FeedbackEvidence[]
}

export interface LocalReviewSession {
  schemaVersion: 1
  sourceIdentity: string
  duration: number
  proposals: LocalProposal[]
  content: LocalReviewContent
  drafts: Record<string, string>
}

export function emptyLocalReview(
  sourceIdentity: string,
  duration: number,
): LocalReviewSession {
  return {
    schemaVersion: 1,
    sourceIdentity,
    duration,
    proposals: [],
    content: { decisions: [], feedback: [] },
    drafts: {},
  }
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 10000)
    throw new Error(
      `${field} must be a non-empty string of at most 10000 characters.`,
    )
  return value
}

export function validEvidenceBounds(
  start: number,
  end: number,
  duration: number,
): boolean {
  return (
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    start >= 0 &&
    end > start &&
    end <= duration
  )
}

export function parseLocalProposals(
  raw: string,
  sourceIdentity: string,
  duration: number,
): LocalProposal[] {
  const data: unknown = JSON.parse(raw)
  if (
    !object(data) ||
    data.schemaVersion !== 1 ||
    !Array.isArray(data.proposals)
  )
    throw new Error('Expected a schemaVersion 1 object with a proposals array.')
  if (
    data.sourceIdentity !== undefined &&
    data.sourceIdentity !== sourceIdentity
  )
    throw new Error('The proposal file identifies a different audio source.')
  if (data.proposals.length > 10000)
    throw new Error('Import at most 10000 proposals at once.')
  const ids = new Set<string>()
  const proposals = data.proposals.map((item: unknown): LocalProposal => {
    if (!object(item)) throw new Error('Each proposal must be an object.')
    const id = text(item.id, 'Proposal id')
    if (ids.has(id)) throw new Error(`Duplicate proposal id ${id}.`)
    ids.add(id)
    if (
      typeof item.start !== 'number' ||
      typeof item.end !== 'number' ||
      !validEvidenceBounds(item.start, item.end, duration)
    )
      throw new Error(`Proposal ${id} has invalid source-time bounds.`)
    const proposal: LocalProposal = {
      id,
      start: item.start,
      end: item.end,
      label: text(item.label, 'Label'),
      source: text(item.source, 'Source'),
    }
    if (item.score !== undefined) {
      if (typeof item.score !== 'number' || !Number.isFinite(item.score))
        throw new Error(`Proposal ${id} has an invalid score.`)
      proposal.score = item.score
    }
    return proposal
  })
  return proposals.sort(
    (a, b) => a.start - b.start || a.end - b.end || a.id.localeCompare(b.id),
  )
}

export function decideProposal(
  content: LocalReviewContent,
  proposalId: string,
  status: ReviewDecision['status'],
): LocalReviewContent {
  return {
    ...content,
    decisions: [
      ...content.decisions.filter(
        (decision) => decision.proposalId !== proposalId,
      ),
      { proposalId, status },
    ],
  }
}

export function exportLocalReview(session: LocalReviewSession): string {
  return JSON.stringify(session, null, 2)
}
