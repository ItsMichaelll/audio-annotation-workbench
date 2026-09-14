# Data formats

The application uses separate versions for taxonomy documents, persisted
entities, the IndexedDB database, project backups, and annotation exports. A
change to one version does not imply a change to the others.

## Version relationships

| Contract                        | Current version | Purpose                                                 |
| ------------------------------- | --------------- | ------------------------------------------------------- |
| Annotation taxonomy             | 1               | Labels, scopes, shortcuts, and scales                   |
| Project entity                  | 1               | Project metadata and active references                  |
| Taxonomy record entity          | 1               | Immutable source and parsed taxonomy version            |
| Instructions entity             | 1               | Saved Markdown instructions                             |
| Task entity                     | 1               | Queue status, media reference, and metadata             |
| Annotation entity               | 2               | Regions, markers, clip assignments, notes, and revision |
| IndexedDB database              | 6               | Physical browser stores, indexes, and migrations        |
| Project backup                  | 2               | Portable single-project recovery envelope               |
| Annotation JSONL and CSV export | 2               | Downstream annotation datasets                          |

Project backup version 1 remains accepted and is normalized to version 2 during
validation. Other unsupported portable or entity versions are rejected.

## Taxonomy input

Taxonomies use `.json`, `.yaml`, or `.yml`, are limited to 1 MB, and must contain
an object at the document root. YAML parsing rejects duplicate keys, merge keys,
and aliases. The annotation schema requires numeric `schemaVersion: 1` and a
non-empty `labels` array.

```yaml
schemaVersion: 1
name: Speech review
labels:
  - id: background-noise
    name: Background noise
    description: Sustained unwanted environmental sound
    scopes: [region, clip]
    color: '#4f8cff'
    shortcut: '1'
  - id: clipping
    name: Clipping
    scopes: [region]
    color: '#d97706'
    shortcut: '2'
scales:
  severity:
    required: true
    options:
      - value: minor
        label: Minor
      - value: major
        label: Major
  confidence:
    required: false
    options:
      - value: low
        label: Low
      - value: high
        label: High
```

### Taxonomy fields

| Field                           | Required              | Rules                                                                        |
| ------------------------------- | --------------------- | ---------------------------------------------------------------------------- |
| `schemaVersion`                 | Yes                   | Must be the number `1`                                                       |
| `name`                          | No                    | Preserved as record metadata when it is a string or finite number            |
| `labels`                        | Yes                   | Non-empty array of label objects                                             |
| `labels[].id`                   | Yes                   | Non-empty stable string, unique within the taxonomy                          |
| `labels[].name`                 | Yes                   | Non-empty display string                                                     |
| `labels[].description`          | No                    | Non-empty string when used                                                   |
| `labels[].scopes`               | No                    | Non-empty array containing `region`, `clip`, or both; defaults to `region`   |
| `labels[].color`                | No                    | Six-digit hexadecimal color such as `#4f8cff`                                |
| `labels[].shortcut`             | No                    | One character, unique without regard to case, and not reserved by the editor |
| `scales`                        | No                    | Object containing only `severity` and/or `confidence`                        |
| `scales.<name>.required`        | No                    | Boolean; defaults to `false`                                                 |
| `scales.<name>.options`         | Yes when scale exists | Non-empty array                                                              |
| `scales.<name>.options[].value` | Yes                   | Non-empty value unique within that scale                                     |
| `scales.<name>.options[].label` | Yes                   | Non-empty display label                                                      |

The upload record also extracts `schema_version` or `schemaVersion` as display
metadata, but the annotation parser still requires `schemaVersion` to be the
number `1`. Source filename, source format, raw text, parsed document, extracted
metadata, semantic SHA-256 hash, project-local version, and creation time are
stored with each immutable taxonomy version.

Raw source mode preserves fields and formatting while editing. The structured
editor represents the fields listed above. Its first mutation asks for
confirmation before canonical YAML can remove comments, formatting, or
unrecognized fields.

## Markdown instructions

Instructions use a `.md` file no larger than 512 KB. The record stores the source
filename, raw Markdown, project ID, entity schema version, and timestamps. Saving
an empty source removes the instructions record.

Raw HTML is not enabled when rendered. Images and executable or embedded
elements are excluded. Links allow HTTP, HTTPS, email, and document fragments.

## Task manifests

A task manifest must use `.json` or `.jsonl` and be no larger than 5 MB. Three
document shapes are accepted.

An array:

```json
[
  {
    "id": "session-001",
    "audio": "speaker-a/take-001.wav",
    "name": "Speaker A, take 1",
    "metadata": { "split": "train", "channels": 1 }
  }
]
```

An object containing only `tasks`:

```json
{
  "tasks": [
    { "audio": "speaker-a/take-001.wav" },
    { "audio": "speaker-b/take-004.flac" }
  ]
}
```

Or JSON Lines, with one task object per line:

```jsonl
{"id":"session-001","audio":"speaker-a/take-001.wav"}
{"id":"session-002","audio":"speaker-a/take-002.wav"}
```

### Manifest fields

| Field      | Required | Rules                                                                           |
| ---------- | -------- | ------------------------------------------------------------------------------- |
| `audio`    | Yes      | Safe relative path with a supported audio extension                             |
| `id`       | No       | Non-empty external ID; duplicate IDs in one manifest are rejected               |
| `name`     | No       | String used as the task display name                                            |
| `metadata` | No       | Object of JSON scalar values or arrays of strings, finite numbers, and booleans |

No other task or wrapper fields are accepted. The `audio` path converts
backslashes to forward slashes. It cannot be empty, absolute, drive-qualified,
contain an empty segment, or contain `..`. Single `.` segments are removed.

Manifest paths must end in AAC, AIFF, FLAC, M4A, MP3, OGA, OGG, Opus, WAV,
WAVE, or WebM. Manifest parsing checks the path and extension only because the
audio bytes are not present. The task remains unresolved until the original file
or source folder is linked.

Direct file import and per-task relinking perform additional checks: the file
must be non-empty, no larger than 2 GB, and begin with the expected container or
codec signature. Browser decoding support remains a separate runtime boundary.

## Project backups

The current backup is a JSON object with this envelope:

```json
{
  "format": "audio-annotation-workbench-project",
  "formatVersion": 2,
  "exportedAt": "2026-09-13T12:00:00.000Z",
  "project": {},
  "taxonomyVersions": [],
  "instructions": null,
  "tasks": [],
  "annotations": []
}
```

Restore accepts `.json` files up to 10 MB. The validator rejects missing or
unknown envelope and entity fields, unsupported versions, duplicate IDs,
invalid dates or values, cross-project references, a missing active taxonomy,
duplicate taxonomy version numbers, multiple annotations for one task, and
assignments that do not match their pinned taxonomy.

The collections contain:

- `project`: complete project entity, including optional source-folder IDs and
  display names
- `taxonomyVersions`: every immutable taxonomy record, including raw source and
  parsed document
- `instructions`: the instructions entity or `null`
- `tasks`: every task, status, portable source identity, relative path, metadata,
  and queue position
- `annotations`: every draft or submission, including regions, markers, clip
  assignments, region notes, task notes, revision, taxonomy pin, and timestamps

Taxonomies are ordered by project-local version, tasks by stable queue order, and
annotations by task order then annotation ID. Object keys are canonicalized for
repeatable output.

Backups exclude audio bytes, absolute paths, object URLs, browser permissions,
directory handles, waveform peaks, spectrograms, and analysis results. A folder
task retains its source ID and relative path with unknown permission. Other media
references become portable unresolved sources. Restoration therefore requires
folder reconnection or per-task relinking.

The restore screen validates and previews a backup before writing. A project ID
collision fails unless replacement is explicitly confirmed. Replacement removes
the colliding project's records and saved handles and inserts the backup in one
transaction across all six stores. An error aborts the transaction.

## JSONL annotation export

JSONL export schema version 2 emits one JSON object per included task. Submitted
mode includes tasks whose status and annotation represent a submission. All-task
mode includes every task, with a nullable annotation.

Each record contains:

| Field            | Contents                                                                                                                          |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`  | Export schema version `2`                                                                                                         |
| `project`        | `id` and `name`                                                                                                                   |
| `task`           | `id`, nullable `externalId`, nullable `displayName`, nullable `relativePath`, `status`, and canonicalized `metadata`              |
| `annotation`     | Complete annotation entity or `null`                                                                                              |
| `pinnedTaxonomy` | Taxonomy ID and version, nullable taxonomy schema version, sorted label interpretations, and scales; `null` without an annotation |

The annotation entity includes `id`, entity `schemaVersion`, `projectId`,
`taskId`, `taxonomyVersionId`, `revision`, `regions`, `markers`,
`clipAssignments`, optional `taskNotes`, creation and update timestamps, and an
optional submission timestamp. Region objects include `id`, `start`, `end`,
`assignments`, and optional `notes`. Marker objects include `id` and `time`.
Assignments include `labelId` and optional `severity` and `confidence`.

JSON object keys and task metadata keys are canonicalized. Output ends with a
newline when at least one record is present; an export with no records is empty.

## CSV annotation export

CSV export schema version 2 uses CRLF line endings and always emits the header.
Values containing a comma, quote, carriage return, or newline are quoted using
standard doubled-quote escaping.

Rows appear in stable task order. Within a task, region assignment rows are
ordered by region ID then label ID, marker rows by time then marker ID, and clip
assignment rows by label ID.

### Row scopes

| `scope`  | When emitted                                                                | Scope-specific values                                            |
| -------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `region` | Once for every region assignment                                            | Region ID, start, end, duration, label, scales, and region notes |
| `marker` | Once for every marker                                                       | Marker ID and time                                               |
| `clip`   | Once for every clip assignment                                              | Label and scales                                                 |
| `task`   | In all-task mode when no region assignment, marker, or clip row was emitted | Shared task and optional annotation values only                  |

Submitted-only mode does not add a task-only row for an empty submitted
annotation, so an export containing only empty submissions can contain just the
header. JSONL is the lossless choice when one record per submitted task is
required.

### Columns

| Column                    | Contents                                                               |
| ------------------------- | ---------------------------------------------------------------------- |
| `export_schema_version`   | Export schema version `2`                                              |
| `project_id`              | Project UUID                                                           |
| `project_name`            | Project display name                                                   |
| `task_id`                 | Task UUID                                                              |
| `task_external_id`        | Optional manifest ID                                                   |
| `task_display_name`       | Optional task display name                                             |
| `task_relative_path`      | Optional normalized relative path                                      |
| `task_status`             | `unstarted`, `draft`, `submitted`, `skipped`, `blocked`, or `reopened` |
| `task_metadata_json`      | Canonical JSON object                                                  |
| `annotation_id`           | Annotation UUID when present                                           |
| `annotation_revision`     | Annotation revision when present                                       |
| `annotation_submitted_at` | Submission timestamp when present                                      |
| `taxonomy_version_id`     | Pinned taxonomy UUID when present                                      |
| `taxonomy_version`        | Pinned project-local taxonomy version when present                     |
| `scope`                   | `region`, `marker`, `clip`, or `task`                                  |
| `marker_id`               | Marker UUID on marker rows                                             |
| `marker_time`             | Marker time in seconds on marker rows                                  |
| `region_id`               | Region UUID on region rows                                             |
| `region_start`            | Region start in seconds                                                |
| `region_end`              | Region end in seconds                                                  |
| `region_duration`         | `region_end - region_start` in seconds                                 |
| `label_id`                | Taxonomy label ID on region or clip rows                               |
| `label_name`              | Label name from the pinned taxonomy                                    |
| `severity`                | Optional severity option value                                         |
| `confidence`              | Optional confidence option value                                       |
| `region_notes`            | Region notes repeated for that region's assignment rows                |
| `task_notes`              | Task notes repeated on every emitted row for the task                  |

Columns that do not apply to a row type are empty. Marker rows deliberately have
empty label and region columns while retaining project, task, annotation,
taxonomy, and task-note context.
