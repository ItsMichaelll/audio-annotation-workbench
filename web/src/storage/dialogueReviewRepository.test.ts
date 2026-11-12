import { describe, expect, it } from 'vitest'
import { createSavedDialogueReview } from '../domain/dialogueReview'
import { SYNTHETIC_DIALOGUE_REVIEW } from '../features/dialogueReview/dialogueFixture'
import { createDialogueReviewRepository } from './dialogueReviewRepository'

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key)
    },
    setItem: (key, value) => {
      values.set(key, value)
    },
  }
}

describe('dialogue review repository', () => {
  it('persists adjustment, notes, decision and active queue position across instances', () => {
    const storage = memoryStorage()
    const input = SYNTHETIC_DIALOGUE_REVIEW
    const saved = createSavedDialogueReview(input)
    saved.activeProposalId = 'handoff-two'
    saved.decisions[0]!.adjustmentSeconds = 0.025
    saved.decisions[0]!.decision = 'rejected'
    createDialogueReviewRepository(storage).save(input, saved)
    expect(createDialogueReviewRepository(storage).load(input)).toEqual(saved)
  })

  it('reports malformed persisted data without overwriting it', () => {
    const storage = memoryStorage()
    const input = SYNTHETIC_DIALOGUE_REVIEW
    const repository = createDialogueReviewRepository(storage)
    repository.save(input, createSavedDialogueReview(input))
    const key = storage.key(0)!
    storage.setItem(key, '{broken')
    expect(() => repository.load(input)).toThrow(/malformed/)
    expect(storage.getItem(key)).toBe('{broken')
  })

  it('separates reviews when source content identity changes without deleting prior decisions', () => {
    const storage = memoryStorage()
    const input = SYNTHETIC_DIALOGUE_REVIEW
    const repository = createDialogueReviewRepository(storage)
    const saved = createSavedDialogueReview(input)
    repository.save(input, saved)
    const replaced = {
      ...input,
      tracks: [
        { ...input.tracks[0], sourceId: 'replacement-a' },
        input.tracks[1],
      ] as const,
    }
    expect(repository.load(replaced)).toBeNull()
    expect(repository.load(input)).toEqual(saved)
  })
})
