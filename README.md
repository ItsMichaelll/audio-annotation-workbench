# Audio Annotation Workbench

Audio Annotation Workbench is a local-first, keyboard-first editor for precise temporal annotation of audio. It is designed for audio engineers and ML dataset reviewers who need waveform navigation and region editing to feel closer to a DAW than a generic labeling form.

This repository is an independent public project. It does not depend on Label Studio, a backend, cloud storage, or a dataset-specific application.

## Current implementation

The workbench remains focused on interaction quality while adding completed real-time analysis views:

- Local WAV, FLAC, MP3, and other browser-supported audio loading through an object URL
- Large waveform with timeline, full-file minimap, hover time, optional real-time spectrum analyzer, and optional synchronized spectrogram
- Pointer-centered wheel zoom, minimap zooming and dragging, vertical waveform scaling, middle/Alt-drag panning, fit, and keyboard zoom
- Keyboard transport with 50 ms, 250 ms, and 1 second movement increments
- Region creation, selection, millisecond readouts, movement, resizing, playback, looping, and deletion
- Undo and redo for region creation, deletion, movement, resizing, and nudging
- Dense, desktop-first production-tool interface with visible focus states
- A fixed analysis-panel order with a permanently reserved minimap scrollbar row
- Framework-independent tests for transport, zoom, keyboard, region/history, spectrum, audio-source guards, and spectrogram synchronization

This milestone stores region metadata only in browser memory. Reloading or selecting another file clears the current regions.

## Architecture

The repository contains one Vite application in `web/`:

- `web/src/domain/` contains pure transport, zoom, region, keyboard, and snapshot-history logic.
- `web/src/features/waveform/` owns WaveSurfer lifecycle, official plugins, gesture listeners, synchronized waveform/spectrogram navigation, and synchronization between serializable region metadata and rendered WaveSurfer regions.
- `web/src/features/spectrum/` owns the Web Audio analyzer graph, tested logarithmic spectrum math and peak hold, and the high-DPI Canvas 2D renderer.
- `web/src/components/` contains focused application controls and readouts.
- `web/src/App.tsx` coordinates local file ownership, editor state, history, and keyboard commands.

WaveSurfer region objects are treated as an interaction and rendering layer. Serializable `RegionMetadata` remains separate so configurable label data can be added later without putting taxonomy state inside plugin objects.

See [frontend architecture](docs/architecture.md), [interaction model](docs/interaction-model.md), [ADR 0001](docs/adr/0001-dedicated-frontend.md), and [ADR 0002](docs/adr/0002-realtime-spectrum-analyzer.md).

## Prerequisites

- Node.js 20.19 or newer, or Node.js 22.12 or newer
- pnpm 10 or newer
- A current desktop browser with Web Audio support

The MVP was validated with Node.js 24.4.1 and pnpm 10.33.0.

## PowerShell setup

After cloning the repository, run these commands from its parent directory:

```powershell
Set-Location .\audio-annotation-workbench
corepack enable
pnpm install --frozen-lockfile
```

## Development

Start the Vite development server:

```powershell
pnpm dev
```

Open the local URL printed by Vite, usually `http://localhost:5173/`, and choose **Load audio file**.

## Validation

Run each check separately:

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Or run the complete sequence:

```powershell
pnpm validate
```

Use `pnpm format` to apply formatting.

The current automated suite contains 41 tests across 10 test files. It covers transport clamping and increments, keyboard mapping, zoom math, region normalization and history, spectrum mapping and peak hold, audio-source reuse guards, analyzer configuration, scrollbar synchronization, and spectrogram viewport synchronization.

## Controls

### Transport bar

The transport bar above the waveform uses this fixed order:

1. Play or Pause
2. Separator
3. Fit
4. Zoom out (`-`)
5. Zoom in (`+`)
6. Reset V-Scale
7. Separator
8. Loop
9. Delete
10. Separator
11. Spectrogram
12. Spectrum Analyzer

The analysis-view buttons use the editor accent while active and the standard transport-control background while inactive. Undo and redo remain keyboard commands rather than transport buttons.

### Mouse

| Gesture | Action |
| --- | --- |
| Click empty waveform | Clear the region selection, position the playhead, and preserve playback |
| Click region | Select region and position playhead within it |
| Drag empty waveform space | Create region |
| Drag region body | Move region |
| Drag visible region edge | Resize region precisely |
| Double-click region | Play that region |
| Wheel over waveform | Zoom around pointer |
| Alt + wheel | Scale waveform height |
| Shift + wheel | Precisely nudge hovered or selected region |
| Middle-button drag | Pan horizontally |
| Alt + left-button drag | Pan horizontally |
| Click empty minimap space | Clear selection, seek, and preserve playback |
| Wheel over minimap | Zoom the main waveform around the mapped minimap position |
| Drag the minimap viewport | Pan the zoomed waveform |
| Drag the minimap scrollbar | Pan the waveform and synchronized analysis viewports |

### Keyboard

| Key | Action |
| --- | --- |
| Space | Play or pause |
| Left / Right | Move playhead 50 ms |
| Shift + Left / Right | Move playhead 250 ms |
| A / D | Move playhead backward / forward 1 second |
| Home / End | Move to file start / end |
| F | Fit the complete waveform |
| + / - | Zoom around visible playhead or viewport center |
| L | Toggle looping for the selected region |
| Delete / Backspace | Delete selected region |
| Ctrl + D | Delete selected region |
| Escape | Clear region selection |
| Ctrl + Z | Undo region edit |
| Ctrl + Y | Redo region edit |
| Ctrl + Shift + Z | Redo region edit |

Transport calculations clamp safely to the loaded audio duration. Time readouts show millisecond precision.

### Analysis views

**Spectrogram** and **Spectrum Analyzer** are independently toggleable from the transport bar. Each panel also has a top-right **Close** button. The rows beneath the waveform and timeline always appear in this order:

1. Minimap
2. Reserved minimap scrollbar
3. Spectrogram, when enabled
4. Spectrum Analyzer, when enabled

The scrollbar row remains reserved when the complete file fits the viewport, preventing the analysis panels from shifting vertically as zoom state changes.

The spectrogram uses the official WaveSurfer plugin. Its full-resolution content width and horizontal scroll position track the primary waveform, minimap, and scrollbar, so time remains aligned while zooming and panning. Its fixed logarithmic frequency labels are derived from the decoded audio's Nyquist frequency.

The controls inside the spectrum analyzer provide:

| Control | Action |
| --- | --- |
| Freeze | Preserve the current live and peak traces without pausing playback |
| Peak Hold | Show or hide recent maxima; peaks hold for 400 ms, then decay at 12 dB per second |
| Fast | Low smoothing (`0.35`) for transient detail |
| Balanced | Default smoothing (`0.72`) for normal inspection |
| Smooth | Higher smoothing (`0.88`) for a steadier broad spectral shape |
| Reset | Clear held peaks, unfreeze, enable Peak Hold, and restore Balanced response |

The display uses an 8192-point FFT, a logarithmic axis from 20 Hz to the lower of 20 kHz or the AudioContext Nyquist frequency, and a vertical range from -100 dB to 0 dB. Hover the plot for a frequency and magnitude readout. Spectrum and Spectrogram are independent and can be shown together.

The spectrum is observational only. A single Web Audio `AnalyserNode` sits in WaveSurfer's media-element playback route and passes the signal to the audio destination without filters, gain, normalization, dynamics, or other processing. Hiding the panel stops its animation loop and FFT reads without disrupting playback.

## Privacy

Selected files remain on the local device. The browser creates an object URL for playback and decoding; the application has no backend, network upload, telemetry, analytics, or external service integration. Object URLs are revoked when a file is replaced or the application unmounts.

## Browser considerations

Audio codec support comes from the browser. WAV and MP3 are broadly supported; FLAC and other formats depend on the selected browser and operating system. Unsupported or malformed files produce a visible error.

WaveSurfer expresses zoom as minimum pixels per second. Wheel zoom uses its official Zoom plugin, which preserves the time beneath the pointer as closely as the renderer and browser scroll precision allow. Alt + wheel changes only the waveform's vertical amplitude scale; it does not alter audio gain, time zoom, or the full-file minimap. The optional official spectrogram uses a worker and is created only when enabled; very long or highly zoomed files can still require meaningful decode and rendering memory.

The real-time spectrum analyzer requires the Web Audio API and starts its `AudioContext` only after a playback or Spectrum-toggle interaction. Browsers may suspend that context under autoplay or power-saving policies; another playback interaction resumes it. The analyzer reflects the playback signal in real time, retains its last frame while paused, and does not perform full-file, selection-averaged, or long-term analysis.

Browser decoder support also determines the decoded sample rate and Nyquist limit used by the spectrogram and spectrum analyzer. The synchronized spectrogram uses the waveform viewport's computed content width and scroll position; browser subpixel rounding can still introduce a negligible visual difference at extreme zoom levels.

## Roadmap

### Implemented

- Navigation-first local audio workflow
- DAW-style zoom and pan gestures
- Keyboard transport
- Temporal region editing and in-memory metadata
- Region undo/redo and clamped, timeline-adaptive nudging
- Optional real-time spectrum analyzer with freeze, decaying peak hold, and response presets
- Optional spectrogram with waveform-synchronized zoom and horizontal navigation
- Fixed minimap, reserved scrollbar, spectrogram, and spectrum panel order
- Automated coverage for domain logic, spectrum behavior, graph guards, and spectrogram synchronization

### Planned, not part of this milestone

- Optional loudness and true-peak metering
- Selection-averaged and long-term averaged spectral analysis
- Configuration-driven labels, colors, severity, confidence, and keyboard mappings
- Clip-level properties
- Annotation persistence and recovery
- Validated import/export formats, including Parquet
- Multi-file queues and review workflow
- Filesystem service evaluation
- Accessibility and performance testing across a broader browser matrix

Authentication, collaboration, cloud storage, ML integration, and deployment remain deliberately out of scope until the interaction model has been evaluated by users.

## License

Copyright © 2026 Michael Camerato. All rights reserved. See [LICENSE](LICENSE).
