import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { emptyLocalReview } from '../domain/localReview'
import { loadLocalReview, saveLocalReview } from './localReviewRepository'

describe('local review persistence', () => {
  it('preserves decisions and unsent drafts while rejecting a changed source duration', async () => {
    const name = `review-${crypto.randomUUID()}`
    const session = emptyLocalReview('audio', 5)
    session.proposals = [
      { id: 'a', start: 1, end: 2, label: 'Inspect', source: 'local-model' },
    ]
    session.content.decisions = [{ proposalId: 'a', status: 'dismissed' }]
    session.drafts = { a: 'Listen again' }
    await saveLocalReview(session, name)
    expect(await loadLocalReview('audio', 5, name)).toEqual(session)
    expect((await loadLocalReview('audio', 6, name)).proposals).toEqual([])
  })
})
