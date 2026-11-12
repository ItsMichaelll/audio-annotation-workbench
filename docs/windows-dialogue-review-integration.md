# Windows Dialogue Review integration

## Running the shared editor

The runnable generated fixture lives at `/editor/dialogue-review`. It creates
two 48 kHz mono tone tracks in browser memory. Select **Load generated fixture**
to initialize Web Audio after a user gesture. No audio fixture is checked into
the repository.

```powershell
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

For production-preview acceptance checks, run the following from the repository
root. The browser tests use a separate muted headless Chrome process.

```powershell
pnpm build
pnpm --dir web test:e2e
pnpm --dir web exec vite preview --host 127.0.0.1 --port 4173
```

Open `http://127.0.0.1:4173/editor/dialogue-review` for the preview.

## Host contract

Reuse `features/dialogueReview/DialogueReviewWorkbench.tsx` and its exported
`DialogueReviewWorkbenchProps`. The input type is `DialogueReviewInput` from
`domain/dialogueReview.ts`.

- Supply stable `sessionId`, `exportId`, and `handoffId` values from the existing
  Windows review data. These identify the saved review independently from a
  display name or audio URL.
- Supply exactly two tracks with stable IDs and source identities. Each
  `offsetSeconds` maps source sample zero into mix time.
  Source identity must change when underlying audio content changes, including
  replacement at the same filename or Python URL. Saved decisions validate both
  source identities before loading.
- Supply an explicit `activeRange` in mix seconds and chronological timing
  proposals containing original bounds, proposed bounds, shift, track identity,
  and provenance. The original proposal remains unchanged after an adjustment.
- Supply `sources` containing browser `File` objects or local service URLs keyed
  by source identity. Local Python URLs must be served from the application
  origin or a loopback host and allow the application's origin through CORS.
- Supply a `DialogueReviewRepository` adapter to read and write the Windows
  application's existing decisions. Its `load` and `save` methods use the typed
  `SavedDialogueReview` contract. Keep translation to the existing Python saved
  decision format inside this adapter.
  Preload asynchronous Python data before mounting the editor and return that
  snapshot from `load`. `save` can return a Promise. The workbench serializes
  saves in edit order and displays rejected writes, including network failures.

The host can wrap the workbench in its existing route and enumerate its existing
20 handoffs. Selecting a different handoff should mount the workbench with a new
React `key` derived from its stable identity. The exported workbench also keys
its owned session from the complete input and source identities, including
browser File object identity. This releases buffers, graph nodes,
timers, and visual URLs before opening the next pair. The adapter should preserve
the host's original files and existing decision format. AAW has no knowledge of
Windows-specific path layouts or Python endpoint names.

## Playback and timeline ownership

`PairedAudioEngine` schedules both decoded source buffers on one `AudioContext`
clock. Each source uses its mix offset. Listening controls choose both tracks or
one track, each lane can be muted or collapsed, and playback rate ranges from
0.5× to 2×. Hold P to temporarily reveal collapsed partner lanes. Original and Proposed switch
the affected track's offset while retaining the same shared mix-time position.
Selection loops schedule against the same clock. Explicitly seeking outside a
loop clears it.

The workbench renders the existing `WaveformEditor` for each lane through its
external playback controller interface. WaveSurfer's media elements stay muted
and paused. Shared controlled cursor time and viewport geometry align both
lanes, minimaps, and navigation. Visible waveforms use temporary aligned WAV
representations. The engine always plays the unchanged original decoded buffers.
Each track has independent spectrum and loudness analysis taps ending at a
zero-gain bus. The active lane drives Spectrogram, Spectrum, and Meter. Offline
measurements subtract the displayed alignment offset from selected mix bounds.
File analysis uses the complete original source buffer. Live loudness comes
from the paired context's worklet.
Live spectrum and loudness follow the scheduled playback rate. Deterministic
File, Range, and Selection statistics always analyze original source PCM at its
native decoded sample rate.
The browser decodes both files at the paired AudioContext's sample rate, which
can differ from the encoded file's original rate. Source metadata should retain
the original file properties separately when the host supplies them.

## Decisions and annotations

Accept, Reject, adjustment, notes, and Next persist independently from canonical
annotations. Undo and redo restore review snapshots. The default browser adapter
uses local storage keyed by all three handoff identities and both source identities and validates data on
load. Failed or malformed storage is reported and is preserved for recovery.
Export writes the portable review state as JSON.

Existing standalone and project-task annotation routes remain available. Regions
drawn inside the paired fixture are temporary listening selections. They are not
saved into project annotations by this fixture. A host that needs canonical
labels should connect its annotation adapter to the existing project workflow.

## Current boundaries

Speech-reference normalization controls and reference/clipping overlays are
available in standalone and project-task editors. The paired playback adapter
exposes per-track gain, but its normalization UI and overlays remain pending.
The complete requested workbench milestone is therefore still in progress.

The paired adapter currently decodes both complete sources and constructs
temporary aligned waveform representations. Very long pairs require meaningful
browser memory and waveform regeneration when alignment changes. The shared
engine's playback-rate control changes pitch with speed. Analysis tools remain
available in the paired, standalone, and project-task editors. The fixture's two-track listening mode is an additive
mix, so simultaneous track content can exceed a single track's level.

No browser audio or review state is uploaded. Local Python service requests
only fetch the audio sources explicitly supplied by the host.
