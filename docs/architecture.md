# Navigation-first architecture

Audio Annotation Workbench is a browser-only React application for the first milestone. A selected audio file becomes an object URL and is decoded and played locally by WaveSurfer. No file contents, annotations, filenames, or usage data are sent over a network.

## Boundaries

- `features/waveform/` owns WaveSurfer creation, official plugin registration, pointer gestures, and teardown.
- `domain/` contains framework-independent time, zoom, keyboard, region, and history logic.
- React state is the source of truth for serializable region metadata. WaveSurfer region instances are a rendering and interaction layer.
- The application shell owns file selection, status readouts, transport controls, and shortcut help.

## Region synchronization

Creation, deletion, movement, and resizing produce complete immutable region snapshots. A history controller stores those snapshots, which avoids duplicate undo entries during continuous drag updates. WaveSurfer emits live `update` events for display, followed by one `update-end` event that commits the completed edit.

Stable IDs are created with `crypto.randomUUID()` at region creation time. The metadata shape intentionally includes a label-free `data` object so later configurable taxonomy fields can be added without coupling them to WaveSurfer objects.

## Navigation model

Time zoom is expressed as WaveSurfer's minimum pixels per second. Fit mode derives that value from viewport width and duration. Wheel zoom captures the time beneath the pointer, applies the new zoom, and restores the scroll position needed to keep that time beneath the pointer. Keyboard zoom anchors at the playhead when it is visible and otherwise at viewport center. Alt + wheel adjusts WaveSurfer's independent vertical amplitude scale without changing time zoom or audio gain.

Native horizontal scroll is used for panning. Pointer capture provides middle-button and Alt+left drag panning without relying on WaveSurfer internals.

## Lifecycle

The waveform hook creates one WaveSurfer instance per mounted editor, registers plugins and DOM listeners, and returns a cleanup function that removes listeners and destroys the instance. Object URLs are owned and revoked by the application shell. This makes React Strict Mode remounts safe.

