# Local review evidence

The optional Local review panel accepts locally supplied proposal JSON and saves
review decisions, feedback ranges, and note drafts in the browser. Its proposal
queue appears after an import. Annotation labels, history, and autosave continue
through their existing workflow.

## Proposal input

Import a UTF-8 JSON file smaller than 4 MB containing up to 10000 proposals.

```json
{
  "schemaVersion": 1,
  "proposals": [
    {
      "id": "proposal-1",
      "start": 1.25,
      "end": 2.5,
      "label": "Inspect this passage",
      "source": "local-review-input",
      "score": 0.85
    }
  ]
}
```

Times are source seconds and must fit the loaded audio. IDs must be unique.
Scores are optional finite numbers, with units and interpretation owned by the
supplying source. An optional `sourceIdentity` must match the host's current
identity. Imports merge proposals by ID and reject a changed proposal using an
existing ID, preserving the original evidence and its saved decisions.

## Queue and notes

The queue is chronological. Status and optional minimum-score filters select
which rows appear. Unscored proposals remain visible under the score filter.
Show proposals controls the table visibility. Next proposal advances through the
filtered chronology. Time buttons reveal the proposal on the shared timeline.
Thirty-row pages bound the rendered table size for longer supplied queues.

Accept and Dismiss create local decisions keyed to the original proposal ID.
Undo review and Redo review affect decisions and saved feedback evidence through
an independent snapshot history. These actions leave canonical annotations under
their existing editor controls.

Focus the review region to use Ctrl/Cmd+Z, Ctrl/Cmd+Y, or Ctrl/Cmd+Shift+Z for its
history. Native input undo remains available while typing notes or numeric fields.
Enter on the focused review region accepts its selected proposal. Focused buttons
retain their normal Enter activation, and A/D keep their playback stepping role.

Feedback evidence can use the current selection or playhead, or exact start/end
fields. Reveal range navigates without starting playback. Loop feedback is
available when supplied by the host. Notes are retained as per-proposal or
unassociated drafts while navigating and after reload. Save feedback evidence
records stable UUID, proposal association, source-time bounds, and notes. Saved
evidence can be revealed or removed, with removal covered by review undo.

## Persistence and export

`storage/localReviewRepository.ts` owns the separate
`audio-annotation-workbench-review` IndexedDB database. Sessions are keyed to a
stable source identity and must match source duration before restoration.
Writes are serialized. The UI reports saving and failure states and offers Retry
save. Source audio and browser file handles remain outside these records.

Export review downloads a schema-versioned JSON document containing the original
proposals, separate decisions and feedback evidence, and unsent note drafts. The
document includes the host's source identity, which contains filename metadata
for standalone files, plus the supplied provenance and note text. Downloads are
local and occur only through the Export review action. The
ordinary project annotation backup and export formats retain their existing
contracts. The host should include the review document alongside an annotation
export when exchanging a complete local review.

## Host interface

`LocalReviewPanel` receives `sourceIdentity`, `duration`, `currentTime`, the
current `selection`, and `onReveal(start, end)`. Optional `onLoopRange(start, end)`
and `onEvidenceRangeChange(range)` connect observational evidence to the shared
timeline. Callback identities should remain stable, and the host must change the
source identity when the underlying audio changes.

Import validation, chronological ordering, immutable proposal decisions,
independent history, and IndexedDB round-trip behavior have deterministic tests.
