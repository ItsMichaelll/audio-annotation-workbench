# Frontend architecture

Audio Annotation Workbench is a browser-only React application. A selected audio file becomes an object URL and is decoded and played locally by WaveSurfer. No file contents, annotations, filenames, or usage data are sent over a network.

## Boundaries

- `features/waveform/` owns WaveSurfer creation, official plugin registration, pointer gestures, waveform/spectrogram viewport synchronization, and teardown.
- `features/analysis/` owns the guarded shared Web Audio graph and its single media-element source.
- `features/spectrum/` owns analyzer configuration, pure spectrum math, peak-hold state, and Canvas 2D rendering.
- `features/loudness/` owns live worklet snapshots, deterministic offline scope analysis, pure loudness semantics, and the meter rail.
- `domain/` contains framework-independent time, zoom, keyboard, region, and history logic.
- React state is the source of truth for serializable region metadata. WaveSurfer region instances are a rendering and interaction layer.
- The application shell owns file selection, object URL lifetime, top-level analysis-view visibility, status readouts, transport controls, and shortcut help.

This keeps WaveSurfer integration in a focused feature boundary and prevents per-frame analysis data or plugin objects from becoming application state.

## Workspace layout

The transport bar sits above the primary waveform and timeline. Its control groups are:

1. Play or Pause
2. Fit, zoom out, zoom in, and Reset V-Scale
3. Loop and Delete
4. Spectrogram, Spectrum Analyzer, and Meter visibility

Separators divide those groups. The analysis buttons are active-state toggles, and each analysis panel also owns a close button.

Below the primary waveform and timeline, the fixed order is:

1. Minimap
2. Reserved minimap scrollbar row
3. Spectrogram, when enabled
4. Spectrum Analyzer, when enabled

The scrollbar row remains allocated even when the full file fits. This prevents the panels below it from shifting vertically when zoom creates or removes horizontal overflow.

The editor surface also reserves a stable vertical scrollbar gutter. Its content width therefore remains fixed when analysis panels add enough height to require vertical scrolling.

When enabled, the loudness meter occupies a 230 px right-side grid rail beside the complete analysis stack. It is outside every horizontally moving viewport, so opening it changes the available waveform width without covering content and horizontal navigation never moves the meter.

## Region synchronization

Creation, deletion, movement, resizing, and nudging produce complete immutable region snapshots. A history controller stores those snapshots, which avoids duplicate undo entries during continuous drag updates. WaveSurfer emits live `update` events for display, followed by one `update-end` event that commits the completed edit.

Stable IDs are created with `crypto.randomUUID()` at region creation time. The metadata shape intentionally includes a label-free `data` object so later configurable taxonomy fields can be added without coupling them to WaveSurfer objects.

## Navigation model

Time zoom is expressed as WaveSurfer's minimum pixels per second. Fit mode derives that value from viewport width and duration. Wheel zoom captures the time beneath the pointer, applies the new zoom, and restores the scroll position needed to keep that time beneath the pointer. Keyboard zoom anchors at the playhead when it is visible and otherwise at viewport center. Alt + wheel adjusts WaveSurfer's independent vertical amplitude scale without changing time zoom or audio gain.

Native horizontal scroll is used for panning. Pointer capture provides middle-button and Alt+left drag panning without relying on WaveSurfer internals. Shift+wheel is reserved for clamped region nudging and is not a pan gesture.

The minimap maps pointer positions into full-file time. Its wheel gesture drives the same main-waveform zoom path, and minimap dragging or the reserved horizontal scrollbar updates the primary viewport. The external scrollbar exchanges positions with the waveform only after their track widths match, preventing stale pre-zoom geometry from clamping and feeding an incorrect position back into the waveform. Clicking empty waveform or minimap space clears region selection and seeks without unintentionally stopping active playback.

## Spectrogram synchronization

The spectrogram uses WaveSurfer's official Spectrogram plugin in a dedicated viewport. The plugin renders content for the complete audio duration; application code then synchronizes that content's width and horizontal translation with the primary waveform's scroll geometry.

The pure helpers in `features/waveform/spectrogramSync.ts` clamp content width and scroll offsets and implement logarithmic frequency-to-Y mapping. The waveform refreshes spectrogram geometry on plugin readiness, WaveSurfer redraw and scroll events, zoom changes, and viewport resize. Frequency labels are rendered outside the moving content and omit values above the decoded audio's Nyquist frequency.

## Shared analysis audio lifecycle

The waveform component creates one WaveSurfer instance per mounted editor, registers plugins and DOM listeners, and returns a cleanup function that removes listeners and destroys the instance. It exposes WaveSurfer's media element to the analyzer through the documented `getMediaElement()` API. Object URLs are owned and revoked by the application shell.

The shared analysis controller lazily creates one `AudioContext` and exactly one `MediaElementAudioSourceNode` for WaveSurfer's public media element after a user interaction. The only audible route is `media source -> destination`. Independent branches connect the source to the spectrum `AnalyserNode` and loudness `AudioWorkletNode`; both terminate at one zero-gain analysis bus before the destination. The zero-gain branches keep processors active but cannot add to, filter, or otherwise alter the audible route. A guard prevents repeated `createMediaElementSource()` calls for the same element.

The loudness worklet loads only when Meter is requested. Closing Meter disconnects that tap and stops the 10 Hz React snapshot interval; Spectrum remains independent. Reopening it reconnects the existing node without creating another media source. On permanent WaveSurfer disposal, all graph nodes and message ports disconnect and the context closes. New files receive a new media element and graph. This ownership covers file replacement and React Strict Mode remounts without duplicate routing.

## Loudness measurement lifecycle

Live metering uses `loudness-worklet` in the shared real-time graph. DSP runs sample-accurately in an `AudioWorkletProcessor`; the main thread copies one compact metric snapshot every 100 ms only while Meter is visible and playback is active. The processor applies K-weighting, channel-energy summation, 400 ms Momentary and three-second Short-term windows, two-stage Integrated gating, LRA gating/percentiles, and oversampled true-peak detection. No FFT polling is used for loudness.

File and Selection summaries use a separate `OfflineAudioContext` fed from WaveSurfer's decoded `AudioBuffer`. The source starts at explicit sample-frame bounds and is unrelated to the live media-element route. Region-boundary changes are debounced; a monotonically increasing generation ignores superseded results. An offline render already in progress cannot be force-cancelled through current browser APIs, but stale data never reaches the UI. This avoids transferring or permanently duplicating decoded PCM while keeping rendering outside the real-time playback graph.

PSR is maximum true peak minus maximum Short-term loudness. PLR is maximum true peak minus Integrated loudness. LRA is shown only when a scope is at least three seconds and the processor returns a finite gated range. Mono and stereo are supported; aggregate analysis rejects larger channel layouts rather than applying unverified channel assignments.

The spectrum canvas owns one visible animation loop. FFT and display buffers are typed arrays reused across frames, while `ResizeObserver` keeps the backing canvas aligned with CSS size and device pixel ratio. React state controls only panel settings; per-frame FFT data never enters React state. Freeze preserves the current frame without affecting playback, and paused playback retains the most recent analyzed frame. These ownership rules make file replacement and React Strict Mode remounts safe.

## Automated validation

The current suite has 53 Vitest tests across 12 files. It covers transport clamping and increments, keyboard commands, fit and pointer-centered zoom math, region normalization and undo/redo, logarithmic spectrum mapping and aggregation, peak-hold timing, response configuration, media-source reuse guards, loudness conversion/gating/ratios, scope and target validation, EBU window lengths, scrollbar geometry synchronization, and spectrogram geometry synchronization.

`pnpm validate` runs formatting checks, ESLint, strict TypeScript checking, the Vitest suite, and the Vite production build.
