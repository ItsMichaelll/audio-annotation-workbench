# ADR 0006: Shared local audio review workbench

- Status: Accepted
- Date: 2026-11-12

## Context

Standalone annotation, project tasks, and a Windows dialogue-review host need
the same waveform gestures, analysis tools, focus modes, and source-time
mapping. Review proposals and feedback have different ownership from canonical
annotations. Playback-history measurements cannot provide deterministic scope
summaries.

## Decision

Extend the existing React/WaveSurfer components, domain modules, and storage
repositories. Focus changes keep the editor mounted. Waveform viewport and
playback adapters let a paired host drive visual lanes through one authoritative
clock. The paired engine schedules AudioBufferSourceNodes against one
AudioContext and maps source offsets into mix time. It keeps source media and
original proposals intact.

Single-source playback retains exactly one guarded media-element source. Its
audible branch has a unity-default gain for optional confirmed-reference
listening. Spectrum and loudness taps precede that gain and terminate silently.
Paired playback uses equivalent source-level analysis taps. Normalized playback
clipping is separate evidence from source true peak.

Decode inspection PCM explicitly at 48 kHz through WaveSurfer's public
sampleRate option. Its default 8 kHz representation limits spectrum and
spectrogram bandwidth and is unsuitable for full-band inspection. Browser
resampling remains explicit in the UI and documentation.

Reference preferences, optional review proposals/decisions/feedback, and paired
host decisions use typed auxiliary repositories. Existing project/annotation
database and backup contracts retain their versions. Review exports preserve
supplied proposals independently from decisions. Local transcript/measurement
sidecars remain source-scoped session inputs. No audio bytes enter these stores.

Use headless, muted Chrome against production previews for acceptance testing.
Each test owns its browser process and uses generated audio. Tests never connect
to an existing desktop browser session. CI retains synthetic screenshots.

## Consequences

The Windows host can supply its existing source resolvers and decision storage
through the reusable dialogue adapter. Source IDs must change when source
content changes. Browser-origin-local review and listening preferences are
separate from project backup and require their own recovery/export handling.
Whole-source decoding and temporary aligned visual buffers consume memory for
long paired recordings.

The original observational-analysis decision in ADR 0003 still governs meter
and spectrum taps. The new optional audible gain belongs exclusively to
listening controls. Offline loudness scope boundaries and the dependency's
accuracy limits are documented in
[scope accuracy](../loudness-scope-accuracy.md). No certification is claimed.
