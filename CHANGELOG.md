# Changelog

## 0.1.0 - Unreleased

Initial local-only release.

### Added

- Persistent browser projects with immutable taxonomy versions, Markdown
  instructions, task queues, autosaved annotations, submission, reopening, and
  progress tracking
- Audio file, directory, manifest, and persistent read-only source-folder
  workflows with import preview and relinking
- DAW-style waveform navigation with regions, multi-region selection, timestamp
  markers, clip labels, notes, shortcuts, spectrogram, spectrum analysis, and
  loudness metering
- Versioned project backup and atomic restore plus JSONL and flattened CSV
  annotation exports
- Session-only standalone editor for direct local-file inspection
- GitHub Actions validation for formatting, linting, types, tests, and production
  build

### Known limitations

- Chromium-based desktop browsers are the initial target; the manual release
  pass covers Chrome 152.0.7977.83 on Windows 11.
- Persistent folder access and durable storage remain subject to browser support
  and permission policy. Temporary import and relinking remain available.
- Backups and exports exclude source audio and browser permissions.
- Long recordings can reduce decoding, navigation, spectrogram, and analysis
  performance, often becoming noticeable around 30 minutes or longer depending
  on the recording and hardware.
