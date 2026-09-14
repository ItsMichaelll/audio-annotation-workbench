# Audio Annotation Workbench

Audio Annotation Workbench is a local-only desktop-browser application for
reviewing audio and creating taxonomy-driven annotations. It combines project
and task management with a waveform editor for regions, timestamp markers,
clip-level labels, scales, notes, and audio analysis.

The application has no backend, accounts, telemetry, or cloud integration.
Project data is stored in the browser's IndexedDB database. Audio remains in its
original location and is opened through browser file or folder access.

## Features

- Persistent active and archived projects with task queues and progress
- JSON or YAML taxonomies with immutable version history
- Safe Markdown instructions with editing and preview
- Audio file, directory, connected-folder, JSON, and JSONL task imports
- Regions, timestamp markers, clip labels, severity and confidence scales,
  notes, shortcuts, autosaved drafts, and submission workflows
- Multi-region selection and bulk region labeling or deletion
- Waveform, minimap, spectrogram, spectrum analyzer, and loudness metering
- Project backup and restore plus versioned JSONL and flattened CSV exports
- A session-only standalone editor at `/editor`

## Requirements

- Node.js `^20.19.0` or `>=22.12.0`; Node 22 is recommended
- Corepack with pnpm `10.33.0`
- A Chromium-based desktop browser

The initial release was manually tested with Google Chrome 152.0.7977.83,
Official Build, 64-bit, Stable, on Windows 11. Other browsers and operating
systems have not been verified for this release.

## Install and run

From a clean checkout:

```powershell
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Open <http://127.0.0.1:5173>. The development server listens only on the local
loopback interface and exits if port 5173 is unavailable.

For intentional testing from another device on a trusted LAN, override the host
explicitly:

```powershell
pnpm dev -- --host 0.0.0.0
```

This exposes the development server to the local network and may prompt for a
firewall rule.

## Create the first project

1. Open **Projects**, select **New Project**, and enter a name and optional
   description.
2. Add a valid `.json`, `.yaml`, or `.yml` taxonomy. A project cannot be created
   without an annotation taxonomy.
3. Optionally add Markdown instructions and initial audio files, a directory, or
   a task manifest.
4. Review the import preview and create the project.
5. Open the project, connect or relink its source audio as needed, then select
   **Start Labeling**.

See the [user guide](docs/user-guide.md) for project management, imports,
relinking, annotation controls, task navigation, backup, restore, and the
standalone editor.

## Privacy, persistence, and backups

Project records, taxonomies, instructions, tasks, annotations, and supported
directory handles stay in the browser profile. Audio bytes, object URLs,
waveform peaks, spectrograms, and analysis results are not stored in the project
database or included in exports.

Browser data belongs to the exact browser profile and application origin,
including the scheme, host, and port. Data created at `localhost:5173` is
separate from data created at `127.0.0.1:5173`. Clearing site data, changing
profiles, or changing the configured origin can make projects unavailable.

> Export a project backup regularly and before upgrading, changing the origin,
> or clearing browser data. A durable-storage grant reduces eviction risk but
> does not replace a backup.

## Validation

Run the complete release gate from the repository root:

```powershell
pnpm validate
```

It checks Prettier, ESLint, Stylelint, TypeScript, Vitest, the production build,
and maintained Markdown documentation.

## Supported environment and limitations

- Chromium-based desktop browsers are the primary target. Persistent directory
  access depends on browser support and permission policy. Unsupported browsers
  use the existing temporary file or directory selection and per-task relinking
  workflow.
- Chrome may decline a durable-storage request. The browser controls that
  decision, and regular backups remain necessary.
- Browser and operating-system codec support varies. Files are validated before
  direct import or relinking, but successful validation does not guarantee that
  every browser can decode every codec variant.
- Long recordings require more decoding, waveform, spectrogram, and analysis
  work. Reduced navigation and analysis performance may become noticeable around
  30 minutes or longer depending on hardware, codec, sample rate, and enabled
  analysis views. There is no fixed duration limit.
- Project backups exclude source audio and browser permissions. Restored tasks
  must reconnect to their original recordings.

## Documentation

- [User guide](docs/user-guide.md)
- [Data formats](docs/data-formats.md)
- [Architecture](docs/architecture.md)
- [Development and releases](docs/releasing.md)
- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)
- [Architecture decision records](docs/adr/)

## License

Audio Annotation Workbench is proprietary software and is not open source. The
[license](LICENSE) permits downloading or cloning the repository, installing
dependencies, and running the unmodified application for your own lawful use.
It does not permit modification, redistribution, derivative works, resale, or
operation as a hosted service without prior written permission.
