# Editor workspace

The standalone editor and project annotation route share a workspace system:
warm white surfaces, vibrant cornflower-blue actions and selections, sunset-orange
timing accents, and tabular monospace timing. A deeper blue text role preserves
contrast on tinted controls. Source audio, annotation persistence,
taxonomy versions, transport, history, and analysis remain in their existing
domain and feature layers. No runtime dependencies were introduced.

## Information architecture

- The application header exposes the actual product destinations: Projects and
  the standalone Editor. In an annotation task it supplies project context and
  flushes pending changes before navigating.
- The document bar identifies the recording. Task position, project completion,
  local save status, and submission are persistent project context.
- The waveform owns the main composition. Analysis toggles sit directly above
  it; the full-recording overview stays aligned below it.
- Playback, current time, region navigation, loop, deletion, fit, time zoom,
  and amplitude reset are grouped in a persistent transport dock outside the
  scrolling workspace, so analysis panels never displace playback controls.
- A chronological region ledger replaces the permanent shortcut reference.
  It selects and reveals regions, exposes annotation state, filters unlabeled
  regions, and supplies visible undo, redo, and Add region actions.
- A collapsible, resizable task inspector provides Region, Clip & info, and
  Guide tabs. Region labels and bounds belong to the selected time interval;
  clip labels, task notes, and source metadata belong to the entire recording.
- Keyboard help uses the existing accessible modal, with contained focus,
  Escape dismissal, background inertness, and focus restoration.

There is no permanent global navigation sidebar. Projects is the global
destination; task management, taxonomy, instructions, and portability are
project-specific destinations accessed through the project. The editor's right
rail is a working inspector, justified by persistent annotation controls.

## Deliberate interaction changes

- Add region creates a one-second interval at the playhead, clamped to the
  recording. It selects and reveals that interval without autoplay. This gives
  keyboard and touch users a complete alternative to dragging.
- Start and end fields accept seconds to millisecond precision. Blur or Enter
  commits one undoable edit. Invalid bounds restore the previous value and
  expose an inline error without changing annotations.
- Task validation reuses the domain validator. User-facing errors show region
  numbers in chronological order instead of internal UUIDs. Save failures have
  an explicit retry action.
- An unsaved task warns before browser unload. Controlled project navigation
  continues to flush the draft and stop when saving fails.
- The project snapshot reloads at each task boundary, keeping submission progress
  and the next-task queue current throughout a multi-task annotation session.
- Fitted waveforms stay fitted as the viewport or inspector width changes.
  Explicitly zoomed views retain their zoom. Local keyboard controls take
  precedence over global transport shortcuts.
- Standalone session limits are explicit: these regions are temporary; saved
  taxonomy annotations require a project.

## Responsive and accessibility foundations

The root no longer forces a 960 px viewport. At 700 px and below, the inspector
follows the audio workspace in a single scrollable flow; transport groups wrap,
and the waveform reduces its height. At intermediate widths, the loudness
meter follows the waveform stack to preserve usable horizontal space.

Controls retain native semantics, accessible names, disabled and pressed states,
and visible focus. Inspector tabs support arrows, Home, and End. The existing
resize separator remains keyboard-operable on desktop. The waveform itself is
focusable for transport shortcuts. Reduced-motion preferences disable loading
animation and control transitions.

Shared foundations live in `styles/tokens.css`; the shell and workspace live
in `ApplicationHeader` and `EditorWorkspace.module.css`. Small reusable
components own icons, transport, region ledger, exact timing, status, and help.
The editor opts into the light tokens at the root (including portaled dialogs).
The shared application header uses the same light theme. Unrelated project pages
retain their existing route bodies, dark theme, and workflows until their own
redesign. Analysis-panel chrome follows the light theme; spectrum and spectrogram
plots retain dark technical surfaces for trace and intensity discrimination.

## Verification

An isolated browser uses synthetic WAV files and a real imported taxonomy to
exercise the application and IndexedDB persistence. No mock application state
or user projects are used. Desktop, tablet, and phone screenshots drive visual
iteration. Checks cover keyboard/pointer annotation, timing and required-field
validation, labels and notes, history, playback and analysis, inspector navigation,
autosave/relink, task transitions, and read-only review. Automated accessibility
scans complement checks of visible focus, responsive overflow, and native controls.

## Materially changed files

Paths below are relative to the repository root. Component names include their
colocated `.module.css` files where present.

- Editor entry points: `web/src/App.tsx`,
  `web/src/features/annotation/AnnotationWorkspace.tsx`.
- Annotation and audio surfaces: `AnnotationInspector.tsx` under
  `web/src/features/annotation/`; `WaveformEditor.tsx` under
  `web/src/features/waveform/`; `SpectrumAnalyzer.tsx` under
  `web/src/features/spectrum/`; `web/src/features/loudness/LoudnessMeter.module.css`.
- Shared components under `web/src/components/`: `ApplicationHeader`,
  `TransportBar`, `RegionList`, `RegionTiming`, `KeyboardHelp`, `ShortcutPanel`,
  `StatusReadout`, `Icon.tsx`, `EditorWorkspace.module.css`, and
  `CustomSelect.module.css`.
- Shared project shell: `web/src/features/projects/ProjectLayout.tsx` and its
  stylesheet; `web/src/features/projects/MarkdownInstructions.module.css`.
- Foundations: `web/src/styles/tokens.css`, `base.css`, and `reset.css`;
  `web/index.html` and `web/public/favicon.svg`.
- Documentation: `README.md`, `docs/interaction-model.md`, this document.
- Tooling: `pnpm-lock.yaml` synchronized with the already-declared stylelint
  development dependencies. No new runtime dependencies.
- Replaced stylesheets: `web/src/App.module.css` and
  `web/src/features/annotation/AnnotationWorkspace.module.css` are removed in
  favor of `EditorWorkspace.module.css`; their previous versions remain in Git.
