import {
  dialogueReviewStorageKey,
  parseSavedDialogueReview,
  type DialogueReviewInput,
  type SavedDialogueReview,
} from '../domain/dialogueReview'

/** Review decisions are separate from canonical project annotation documents. */
export interface DialogueReviewRepository {
  load(input: DialogueReviewInput): SavedDialogueReview | null
  save(
    input: DialogueReviewInput,
    review: SavedDialogueReview,
  ): void | Promise<void>
}

export function createDialogueReviewRepository(
  storage: Storage,
): DialogueReviewRepository {
  const key = (input: DialogueReviewInput) =>
    `aaw:dialogue-review:v1:${dialogueReviewStorageKey(input)}`
  return {
    load(input) {
      const stored = storage.getItem(key(input))
      if (stored === null) return null
      let parsed: unknown
      try {
        parsed = JSON.parse(stored)
      } catch {
        throw new Error(
          'The saved dialogue review is malformed. Export its browser storage before replacing it.',
        )
      }
      const result = parseSavedDialogueReview(parsed, input)
      if (!result)
        throw new Error(
          'The saved dialogue review does not match this handoff or supported schema.',
        )
      return result
    },
    save(input, review) {
      const normalized = parseSavedDialogueReview(review, input)
      if (!normalized)
        throw new Error('Dialogue review could not be validated for saving.')
      storage.setItem(key(input), JSON.stringify(normalized))
    },
  }
}
