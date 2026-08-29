# Audio Annotation Workbench

Audio Annotation Workbench is a local-first, keyboard-first editor for precise temporal annotation of audio. It is designed for audio engineers and ML dataset reviewers who need waveform navigation and region editing to feel closer to a DAW than a generic labeling form.

This repository is an independent public project. It does not depend on Label Studio, a backend, cloud storage, or a dataset-specific application.

## Current MVP

The navigation-first MVP is intentionally focused on interaction quality:

- Local WAV, FLAC, MP3, and other browser-supported audio loading through an object URL
- Large waveform with timeline, full-file minimap, hover time, and optional spectrogram
- Pointer-centered wheel zoom, vertical waveform scaling, horizontal wheel/drag panning, fit, and keyboard zoom
- Keyboard transport with 50 ms, 250 ms, and 1 second movement increments
- Region creation, selection, millisecond readouts, movement, resizing, playback, looping, and deletion
- Undo and redo for region creation, deletion, movement, and resizing
- Dense, desktop-first production-tool interface with visible focus states
- Framework-independent tests for transport, zoom, keyboard, region, and history logic

This milestone stores region metadata only in browser memory. Reloading or selecting another file clears the current regions.

## Architecture

The repository contains one Vite application in `web/`:

- `web/src/domain/` contains pure transport, zoom, region, keyboard, and snapshot-history logic.
- `web/src/features/waveform/` owns WaveSurfer lifecycle, official plugins, gesture listeners, and synchronization between serializable region metadata and rendered WaveSurfer regions.
- `web/src/components/` contains focused application controls and readouts.
- `web/src/App.tsx` coordinates local file ownership, editor state, history, and keyboard commands.

WaveSurfer region objects are treated as an interaction and rendering layer. Serializable `RegionMetadata` remains separate so configurable label data can be added later without putting taxonomy state inside plugin objects.

See [navigation-first architecture](docs/architecture.md), [interaction model](docs/interaction-model.md), and [ADR 0001](docs/adr/0001-dedicated-frontend.md).

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

## Controls

### Mouse

| Gesture | Action |
| --- | --- |
| Click waveform | Position playhead |
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

## Privacy

Selected files remain on the local device. The browser creates an object URL for playback and decoding; the application has no backend, network upload, telemetry, analytics, or external service integration. Object URLs are revoked when a file is replaced or the application unmounts.

## Browser considerations

Audio codec support comes from the browser. WAV and MP3 are broadly supported; FLAC and other formats depend on the selected browser and operating system. Unsupported or malformed files produce a visible error.

WaveSurfer expresses zoom as minimum pixels per second. Wheel zoom uses its official Zoom plugin, which preserves the time beneath the pointer as closely as the renderer and browser scroll precision allow. Alt + wheel changes only the waveform's vertical amplitude scale; it does not alter audio gain, time zoom, or the full-file minimap. The optional official spectrogram uses a worker and is created only when enabled; very long or highly zoomed files can still require meaningful decode and rendering memory.

## Roadmap

### Implemented

- Navigation-first local audio workflow
- DAW-style zoom and pan gestures
- Keyboard transport
- Temporal region editing and in-memory metadata
- Region undo/redo
- Optional spectrogram and full-file minimap

### Planned, not part of this milestone

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
