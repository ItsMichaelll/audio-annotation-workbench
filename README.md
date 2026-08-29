# Audio Annotation Workbench

Audio Annotation Workbench is a local-first, keyboard-first editor for precise temporal annotation of audio. It is designed for audio engineers and ML dataset reviewers who need waveform navigation and region editing to feel closer to a DAW than a generic labeling form.

This repository is an independent public project. It does not depend on Label Studio, a backend, cloud storage, or a dataset-specific application.

## Current implementation

The workbench remains focused on interaction quality while adding completed real-time analysis views:

- Local WAV, FLAC, MP3, and other browser-supported audio loading through an object URL
- Large waveform with timeline, full-file minimap, hover time, optional real-time spectrum analyzer, synchronized spectrogram, and loudness/true-peak meter
- Pointer-centered wheel zoom, minimap zooming and dragging, vertical waveform scaling, middle/Alt-drag panning, fit, and keyboard zoom
- Keyboard transport with 50 ms, 250 ms, and 1 second movement increments
- Region creation, selection, millisecond readouts, movement, resizing, playback, looping, and deletion
- Undo and redo for region creation, deletion, movement, resizing, and nudging
- Dense, desktop-first production-tool interface with visible focus states
- A fixed analysis-panel order with a permanently reserved minimap scrollbar row
- Framework-independent tests for transport, zoom, keyboard, region/history, spectrum, loudness math, audio-source guards, and spectrogram synchronization

This milestone stores region metadata only in browser memory. Reloading or selecting another file clears the current regions.

## Architecture

The repository contains one Vite application in `web/`:

- `web/src/domain/` contains pure transport, zoom, region, keyboard, and snapshot-history logic.
- `web/src/features/waveform/` owns WaveSurfer lifecycle, official plugins, gesture listeners, synchronized waveform/spectrogram navigation, and synchronization between serializable region metadata and rendered WaveSurfer regions.
- `web/src/features/analysis/` owns the single shared media-element Web Audio graph used by observational analysis taps.
- `web/src/features/spectrum/` owns tested logarithmic spectrum math, peak hold, and the high-DPI Canvas 2D renderer.
- `web/src/features/loudness/` owns live worklet metering, deterministic offline scope analysis, measurement semantics, and the right-side meter UI.
- `web/src/components/` contains focused application controls and readouts.
- `web/src/App.tsx` coordinates local file ownership, editor state, history, and keyboard commands.

WaveSurfer region objects are treated as an interaction and rendering layer. Serializable `RegionMetadata` remains separate so configurable label data can be added later without putting taxonomy state inside plugin objects.

See [frontend architecture](docs/architecture.md), [interaction model](docs/interaction-model.md), [ADR 0001](docs/adr/0001-dedicated-frontend.md), [ADR 0002](docs/adr/0002-realtime-spectrum-analyzer.md), and [ADR 0003](docs/adr/0003-loudness-meter.md).

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

The current automated suite contains 53 tests across 12 test files. It covers transport clamping and increments, keyboard mapping, zoom math, region normalization and history, spectrum mapping and peak hold, audio-source reuse guards, loudness conversion and gating semantics, EBU window configuration, target validation, scope bounds, scrollbar synchronization, and spectrogram viewport synchronization.

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
13. Meter

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

**Spectrogram**, **Spectrum Analyzer**, and **Meter** are independently toggleable from the transport bar. Each view also has a top-right close button. The rows beneath the waveform and timeline always appear in this order:

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

The spectrum is observational only. WaveSurfer's media source has one direct audible route to the destination; the `AnalyserNode` is an independent tap ending at a zero-gain analysis bus. No filter, normalization, dynamics, or level change is applied. Hiding the panel stops its animation loop and FFT reads without disrupting playback.

### Loudness and true-peak meter

The optional **Meter** opens a fixed 230 px rail at the right of the analysis workspace. It reduces the waveform viewport cleanly and remains stationary while the waveform, spectrogram, and minimap navigate horizontally. The live view reports standardized 400 ms Momentary loudness, three-second Short-term loudness, current PSR, and the maximum true peak observed since the current live worklet started. Pausing preserves the latest live values; closing the rail disconnects its analysis tap and stops UI sampling without pausing playback.

Aggregate statistics are deterministic and explicitly scoped to **File** or **Selection**. They are rendered in a separate `OfflineAudioContext`, so seeking, looping, pause history, and playhead position cannot affect Integrated loudness, LRA, Momentary maximum, Short-term maximum, True-peak maximum, PSR, or PLR. Selection analysis is debounced and recalculates when region boundaries change. Selection scopes shorter than three seconds show Short-term, LRA, and PSR as unavailable.

Units and formulas follow professional loudness terminology:

- Momentary, Short-term, Integrated, and their maxima use `LUFS`.
- Loudness Range uses `LU` and the EBU relative gate plus 10th/95th percentiles.
- True peak uses `dBTP`, with four-times oversampling at 44.1/48 kHz in the worklet implementation.
- PSR is `maximum true peak − maximum short-term loudness`, in `LU`. The live PSR uses the current Short-term value and the live true-peak maximum.
- PLR is `maximum true peak − integrated loudness`, in `LU`.

The optional target bracket is disabled by default. Its target and tolerance are session-local visual QC references; they never normalize, classify, or modify audio. Valid targets range from -70 to 0 LUFS with a positive tolerance up to 30 LU.

The meter uses the MIT-licensed `loudness-worklet` implementation of ITU-R BS.1770-5 and EBU Mode measurement. It has published validation against ITU BS.2217 and EBU Tech 3341/3342 material, but this application is not certified by ITU, EBU, or a third party. The dependency documents one 44.1 kHz true-peak sequence at -0.45 dBTP, 0.05 dB below the EBU test's accepted lower bound. Treat the meter as a high-quality inspection aid pending independent application-level comparison against a trusted reference meter.

## Privacy

Selected files remain on the local device. The browser creates an object URL for playback and decoding; the application has no backend, network upload, telemetry, analytics, or external service integration. Object URLs are revoked when a file is replaced or the application unmounts.

## Browser considerations

Audio codec support comes from the browser. WAV and MP3 are broadly supported; FLAC and other formats depend on the selected browser and operating system. Unsupported or malformed files produce a visible error.

WaveSurfer expresses zoom as minimum pixels per second. Wheel zoom uses its official Zoom plugin, which preserves the time beneath the pointer as closely as the renderer and browser scroll precision allow. Alt + wheel changes only the waveform's vertical amplitude scale; it does not alter audio gain, time zoom, or the full-file minimap. The optional official spectrogram uses a worker and is created only when enabled; very long or highly zoomed files can still require meaningful decode and rendering memory.

The real-time analysis tools require Web Audio and start their shared `AudioContext` only after playback or an analysis-toggle interaction. Browsers may suspend that context under autoplay or power-saving policies; another playback interaction resumes it. The spectrum retains its last frame while paused. Live loudness is playback-history based by definition, while aggregate loudness is always recalculated from decoded local audio in an offline context.

Offline loudness currently supports mono and stereo decoded buffers. Files with more than two channels show a non-blocking aggregate-analysis error; playback and other editor tools remain available. Very long files can require substantial browser memory during offline rendering. Superseded Selection results are ignored, although browsers do not expose cancellation for an `OfflineAudioContext` already rendering.

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
- Optional live loudness and true-peak meter with deterministic File/Selection statistics and a configurable target bracket
- Fixed minimap, reserved scrollbar, spectrogram, and spectrum panel order
- Automated coverage for domain logic, spectrum behavior, graph guards, and spectrogram synchronization

### Planned, not part of this milestone

- Independent reference-meter validation across the supported browser matrix
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
