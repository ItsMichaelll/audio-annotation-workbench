# Frontend architecture

Audio Annotation Workbench is a browser-only React application. A selected audio file becomes an object URL and is decoded and played locally by WaveSurfer. No file contents, annotations, filenames, or usage data are sent over a network.

## Boundaries

- `features/waveform/` owns WaveSurfer creation, official plugin registration, pointer gestures, waveform/spectrogram viewport synchronization, and teardown.
- `features/spectrum/` owns the pass-through Web Audio analysis graph, analyzer configuration, pure spectrum math, peak-hold state, and Canvas 2D rendering.
- `domain/` contains framework-independent time, zoom, keyboard, region, and history logic.
- React state is the source of truth for serializable region metadata. WaveSurfer region instances are a rendering and interaction layer.
- The application shell owns file selection, object URL lifetime, top-level analysis-view visibility, status readouts, transport controls, and shortcut help.

This keeps WaveSurfer integration in a focused feature boundary and prevents per-frame analysis data or plugin objects from becoming application state.

## Workspace layout

The transport bar sits above the primary waveform and timeline. Its control groups are:

1. Play or Pause
2. Fit, zoom out, zoom in, and Reset V-Scale
3. Loop and Delete
4. Spectrogram and Spectrum Analyzer visibility

Separators divide those groups. The analysis buttons are active-state toggles, and each analysis panel also owns a close button.

Below the primary waveform and timeline, the fixed order is:

1. Minimap
2. Reserved minimap scrollbar row
3. Spectrogram, when enabled
4. Spectrum Analyzer, when enabled

The scrollbar row remains allocated even when the full file fits. This prevents the panels below it from shifting vertically when zoom creates or removes horizontal overflow.

The editor surface also reserves a stable vertical scrollbar gutter. Its content width therefore remains fixed when analysis panels add enough height to require vertical scrolling.

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

## Spectrum analyzer lifecycle

The waveform component creates one WaveSurfer instance per mounted editor, registers plugins and DOM listeners, and returns a cleanup function that removes listeners and destroys the instance. It exposes WaveSurfer's media element to the analyzer through the documented `getMediaElement()` API. Object URLs are owned and revoked by the application shell.

The analyzer lazily creates one `AudioContext`, one `MediaElementAudioSourceNode`, and one `AnalyserNode` for that media element after a user interaction. Its only route is `media source -> analyzer -> destination`; no parallel destination connection or signal-processing node is present. A guard prevents repeated `createMediaElementSource()` calls for the same element. When WaveSurfer permanently disposes that element, the analyzer disconnects its nodes and closes its context. Hiding the panel cancels its rendering loop and FFT reads while leaving the established audio route intact, avoiding playback glitches.

The spectrum canvas owns one visible animation loop. FFT and display buffers are typed arrays reused across frames, while `ResizeObserver` keeps the backing canvas aligned with CSS size and device pixel ratio. React state controls only panel settings; per-frame FFT data never enters React state. Freeze preserves the current frame without affecting playback, and paused playback retains the most recent analyzed frame. These ownership rules make file replacement and React Strict Mode remounts safe.

## Automated validation

The current suite has 41 Vitest tests across 10 files. It covers transport clamping and increments, keyboard commands, fit and pointer-centered zoom math, region normalization and undo/redo, logarithmic spectrum mapping and aggregation, peak-hold timing, response configuration, media-source reuse guards, scrollbar geometry synchronization, and spectrogram geometry synchronization.

`pnpm validate` runs formatting checks, ESLint, strict TypeScript checking, the Vitest suite, and the Vite production build.
