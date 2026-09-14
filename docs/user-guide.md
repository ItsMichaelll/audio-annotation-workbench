# User guide

This guide covers the local project workflow and the standalone editor included
in Audio Annotation Workbench 0.1.0.

## Local data and browser profiles

The application stores project data in IndexedDB under the exact browser origin
used to open it. With the default development command, that origin is
`http://127.0.0.1:5173`. A different host, port, scheme, or browser profile has
a separate database.

Source audio remains in its original location. Direct file and directory
selections are available only for the current browser session. A supported
browser can store read-only directory handles, although it may require permission
again after a restart. Audio bytes are never copied into the project database.

Use the storage notice on the Projects page to request durable storage. Chrome
may decline the request according to its own policy. Regardless of the result,
download project backups regularly.

## Create and manage projects

Select **New Project** from the Projects page. A project requires a name and an
annotation taxonomy. Its description, Markdown instructions, and initial tasks
are optional. The create operation writes the project, first taxonomy version,
instructions, and initial tasks together; a failed operation does not leave a
partial project.

The Projects page separates active and archived projects and supports search and
sorting. Open a project to use its three sections:

- **Tasks** contains import controls, source folders, filters, selection actions,
  progress, and the task queue.
- **Reference** shows the active taxonomy, immutable taxonomy history, and
  rendered project instructions.
- **Data & settings** contains project metadata, settings, archive or restore,
  backup, annotation export, and permanent deletion.

Archiving removes a project from the active view and prevents new labeling until
it is restored. Deleting a project permanently removes its project data,
taxonomy history, instructions, tasks, annotations, and saved directory handles
from this browser profile. It does not delete any source audio from disk.

## Taxonomies

Projects use a version 1 annotation taxonomy in JSON, YAML, or YML format. The
file must be no larger than 1 MB. Every taxonomy needs at least one label; labels
can apply to regions, the whole clip, or both. Optional severity and confidence
scales can be required for every assignment.

The taxonomy editor has **Structured** and **YAML** modes:

- Structured mode edits labels, descriptions, scopes, colors, shortcuts, scales,
  required states, and ordered scale options.
- YAML mode preserves and edits the raw source. Invalid source remains available
  for correction and cannot be saved.
- Switching modes does not rewrite the source. The first structured change may
  request confirmation because canonical YAML removes comments, custom
  formatting, and fields outside the supported annotation schema.
- `Ctrl+S` or `Command+S` saves valid changes. The working source can also be
  downloaded.

Each save creates and activates an immutable taxonomy version unless its
semantic content matches a version already in the project. Existing drafts and
submissions remain pinned to the taxonomy version with which they were created.
Changing the active taxonomy therefore does not reinterpret earlier work.

See [Data formats](data-formats.md#taxonomy-input) for the complete schema and an
example.

## Markdown instructions

A project can have one `.md` instructions file up to 512 KB. The instructions
editor provides Write, Split, and Preview views and accepts `Ctrl+S` or
`Command+S`. Saving an empty document removes the project instructions. The
working Markdown can be downloaded without saving it first.

The preview does not render raw HTML, scripts, iframes, or images. Links are
limited to HTTP, HTTPS, email, and document fragments. Following an external
link can still contact its destination; the application never follows it
automatically.

## Import tasks

Tasks can be added while creating a project or from the project's **Tasks**
section.

### Audio files and temporary directories

Use **Select audio files** for individual recordings or **Select directory** for
a browser-provided directory selection. Supported filename extensions are AAC,
AIFF, FLAC, M4A, MP3, OGA, OGG, Opus, WAV, WAVE, and WebM. Direct selections must
be non-empty, no larger than 2 GB each, and have a recognized file signature.

The import preview separates valid new tasks, duplicates, conflicts, unresolved
items, invalid entries, and unsupported files. Only valid new tasks are written
when the import is confirmed. Direct selections remain available for the current
session and commonly require relinking after a browser restart.

### Task manifests

Use **Select JSON/JSONL manifest** for a `.json` or `.jsonl` file no larger than
5 MB. A manifest records safe relative audio paths and optional IDs, names, and
simple metadata. It does not contain audio. Manifest tasks begin unresolved and
must be linked to their original recordings before annotation.

See [Data formats](data-formats.md#task-manifests) for accepted document shapes,
fields, and path rules.

### Connected source folders

In a browser with persistent directory-handle support, expand **Source folders**
and select **Connect folder**. Access is read-only.

After connection, select **Scan and link matching tasks**. The scan recursively
links existing folder tasks by their full relative path and offers supported new
files in an import preview. Duplicate filenames in different subdirectories are
kept distinct. A project can have more than one connected root.

The folder scan filters by supported extension. A matching extension can still
fail later if the browser cannot read or decode the file.

## Reconnect and relink media

Folder permission and temporary selections have different recovery paths:

- **Reconnect folder** requests read permission for the saved root again. One
  successful reconnection can restore every task linked to that source ID.
- **Replace folder** associates the same source ID with another selected root.
  Preserve the original relative directory structure so existing task paths can
  resolve.
- **Forget access** removes the saved directory handle but preserves the tasks
  and portable folder identity for later reconnection.
- **Relink audio file** is available inside a task when its media is unavailable.
  Direct-file tasks require the original filename and byte size. Manifest tasks
  require the original relative path when supplied by a directory picker, or a
  file with the expected basename for individual selection.

A per-task relink is session-only and may be needed again after restart. Backup
restoration retains connected-folder IDs, names, and relative paths but removes
the browser handles and permissions. Reconnect each source folder after restore,
or relink files one task at a time.

Browsers without the required folder API continue to use **Select directory**,
**Select audio files**, and per-task relinking.

## Annotate a task

Select **Start Labeling** to open the first actionable task in import order. A
task row can also open new work, continue a draft or reopened task, or view a
submitted task.

### Regions

- Drag an empty part of the waveform to create a region, or use **Add region** to
  create a one-second region at the playhead.
- Drag a region body to move it and drag its edges to resize it. Start and end
  fields accept seconds with millisecond precision.
- Double-click a region to play its exact bounds.
- Each region must have exactly one region-scoped label before submission.
  Optional notes belong to that region.
- `Ctrl`/`Command`-click regions in the waveform or region list to toggle a
  multi-region selection. `Ctrl`/`Command+A` selects all regions while focus is
  in the editor and outside a form control.
- A multi-region selection supports bulk label assignment, scale changes, and
  deletion. Replacing existing labels on several selected regions requires
  confirmation. Exact timing, region notes, and looping remain single-region
  operations.

Selecting one region enables its loop by default. **Loop** toggles that loop.
Selecting multiple regions disables region looping.

### Markers

Markers represent a timestamp without duration. Add one at the playhead from the
Markers toolbar or press `T` while the waveform is focused. Markers can be
selected from the waveform or the chronological Markers list, dragged to a new
time, navigated with previous and next controls, and deleted while editing.

`Tab` and `Shift+Tab` navigate markers only while the waveform is focused. At
the first or last marker, normal browser focus movement resumes. Selecting a
marker clears region selection and looping. Markers persist in project drafts,
backups, JSONL, and CSV exports.

### Clip labels, scales, and notes

The inspector separates **Region**, **Clip & info**, and **Guide**. Clip labels
apply to the complete recording and allow more than one compatible label.
Region and clip assignments expose any severity or confidence scale configured
by the pinned taxonomy. Required scale values must be chosen before submission.
Task notes apply to the complete recording; region notes apply only to one
region.

### Undo, redo, and autosave

Region, marker, label, scale, and note edits in a project task share annotation
history. Dragging a region updates live and creates one history entry when the
drag ends. Use the controls or `Ctrl+Z`, `Ctrl+Y`, and `Ctrl+Shift+Z`.

Project drafts save to IndexedDB about 600 ms after a meaningful edit. The
header reports Unsaved, Saving, Saved locally, or Save failed. Controlled
navigation flushes pending changes and stops if a required save fails. A failed
save offers **Retry save**. Refreshing or closing a tab with unsaved changes uses
the browser's leave-page warning.

### Submit, skip, reopen, and navigate

Submission requires available audio, a saved draft, valid region timing, exactly
one compatible label per region, valid marker timing, compatible clip labels,
and all required scale values. Submitting with no regions and no clip labels
requires explicit confirmation; marker-only work still receives this
confirmation.

**Submit & next** writes the submitted annotation and opens the next actionable
task. **Skip** saves the draft, marks the task skipped, and advances. Both wrap
through the remaining actionable queue and return to the project when none
remain. The shortcuts are `Ctrl+Enter` and `Ctrl+Shift+Enter` respectively.

Submitted annotations open read-only. Use **Reopen** on the project task row to
return the task to editable work without discarding its annotation. Skipped or
blocked tasks can be restored to unstarted. Project task selection also supports
bulk restore, skip, and permanent deletion.

## Editor controls

Shortcuts pause while an input, textarea, select, button, editable element, or
dialog has focus.

| Input                       | Action                                                    |
| --------------------------- | --------------------------------------------------------- |
| Space                       | Play or pause                                             |
| Left / Right                | Move the playhead 50 ms                                   |
| Shift + Left / Right        | Move the playhead 250 ms                                  |
| A / D                       | Move the playhead one second                              |
| Home / End                  | Jump to the start or end of the recording                 |
| Ctrl/Command + Left / Right | Select and reveal the previous or next region             |
| F                           | Fit the complete waveform                                 |
| Plus / Minus                | Zoom around the playhead or viewport center               |
| L                           | Toggle a single selected region's loop                    |
| Delete / Backspace          | Delete selected regions, or a focused selected marker     |
| Ctrl+D                      | Delete selected regions or marker                         |
| Escape                      | Clear region or marker selection                          |
| T                           | Create a marker while the waveform is focused             |
| Tab / Shift+Tab             | Select the next or previous marker while waveform-focused |
| Ctrl+Z                      | Undo                                                      |
| Ctrl+Y or Ctrl+Shift+Z      | Redo                                                      |

Pointer and wheel controls:

| Input                              | Action                                      |
| ---------------------------------- | ------------------------------------------- |
| Wheel over waveform or minimap     | Zoom around the pointer                     |
| Alt+wheel                          | Scale waveform height without changing gain |
| Shift+wheel                        | Pan, or nudge the single selected region    |
| Middle drag or Alt+left drag       | Pan horizontally                            |
| Drag minimap viewport or scrollbar | Pan synchronized views                      |

Spectrum, Spectrogram, and Meter are independent views. They observe the local
audio signal and never alter playback. File and Selection meter statistics use
offline rendering and can consume substantial resources for long recordings.

## Backup, restore, and exports

Open **Data & settings** in a project.

- **Download backup** creates one JSON recovery file containing project
  settings, every taxonomy version, instructions, tasks, annotations, regions,
  markers, assignments, and notes. It excludes audio and browser handles.
- **Restore backup** is available from the Projects page. The application checks
  the file and shows its project and record counts before any write. A project ID
  collision requires explicit replacement confirmation. Replacement is atomic
  and affects only the colliding project.
- **Export annotations** downloads submitted work or all tasks as versioned
  JSONL or flattened CSV. JSONL retains the nested annotation and pinned
  taxonomy. CSV emits separate region, marker, clip, and, when applicable,
  task-only rows.

See [Data formats](data-formats.md) before building downstream tooling around an
export.

## Standalone editor

Open `/editor` to inspect one local recording without creating a project. It
provides waveform navigation, regions, markers, spectrogram, spectrum analysis,
loudness metering, and file or selected-region statistics.

Standalone regions and markers last only for the current page session. Regions
support undo and redo; markers do not participate in standalone history. The
standalone editor has no taxonomy assignments, autosave, submission, backup, or
annotation export. Use a project for durable annotation work.
