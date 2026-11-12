import { describe, expect, it } from 'vitest'
import { SnapshotHistory } from './history'
import {
  decideProposal,
  emptyLocalReview,
  exportLocalReview,
  parseLocalProposals,
} from './localReview'

describe('local proposal review', () => {
  const proposal = {
    id: 'a',
    start: 1,
    end: 2,
    label: 'Inspect',
    source: 'local-model',
    score: 0.8,
  }
  it('validates local evidence, source identity and chronology', () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      sourceIdentity: 'audio',
      proposals: [{ ...proposal, id: 'b', start: 3, end: 4 }, proposal],
    })
    expect(parseLocalProposals(raw, 'audio', 5).map((item) => item.id)).toEqual(
      ['a', 'b'],
    )
    expect(() => parseLocalProposals(raw, 'other', 5)).toThrow(
      /different audio/,
    )
    expect(() => parseLocalProposals(raw, 'audio', 2)).toThrow(/bounds/)
  })
  it('keeps immutable proposals separate from undoable decisions and exports', () => {
    const session = emptyLocalReview('audio', 5)
    session.proposals = [proposal]
    const history = new SnapshotHistory(session.content)
    const accepted = history.commit(
      decideProposal(session.content, 'a', 'accepted'),
    )
    expect(accepted.present.decisions[0]?.status).toBe('accepted')
    expect(history.undo().present.decisions).toEqual([])
    expect(history.redo().present.decisions[0]?.status).toBe('accepted')
    const result = JSON.parse(
      exportLocalReview({ ...session, content: accepted.present }),
    )
    expect(result.proposals[0]).toEqual(proposal)
    expect(result.content.decisions[0].status).toBe('accepted')
  })
  it('rejects duplicate ids and nonfinite scores', () => {
    expect(() =>
      parseLocalProposals(
        JSON.stringify({ schemaVersion: 1, proposals: [proposal, proposal] }),
        'audio',
        5,
      ),
    ).toThrow(/Duplicate/)
    expect(() =>
      parseLocalProposals(
        JSON.stringify({
          schemaVersion: 1,
          proposals: [{ ...proposal, score: '0.8' }],
        }),
        'audio',
        5,
      ),
    ).toThrow(/score/)
  })
})
