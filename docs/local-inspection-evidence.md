# Local inspection evidence

The project-task inspector's Evidence tab accepts a local JSON sidecar with a
transcript, supplied measurements, or both. Evidence is session state scoped to
the open task. It survives inspector and focus toggles. Reopen the sidecar after
a page reload. The source JSON remains on the device.

```json
{
  "transcript": [
    {
      "id": "row-1",
      "speaker": "speaker",
      "start": 1,
      "end": 2.5,
      "text": "Synthetic example text."
    }
  ],
  "scores": [
    {
      "id": "score-1",
      "name": "Supplied quality score",
      "value": 4.2,
      "unit": "MOS",
      "source": "local evaluator",
      "start": 1,
      "end": 2.5
    }
  ]
}
```

Times are source seconds within the loaded file. IDs must be unique within each
list. Measurements require a finite value, unit, and source. Their optional
start and end must form a valid interval. Invalid rows produce a visible count
and are omitted. Import is limited to 1 MB. Transcript search and incremental
50-row display keep long lists bounded.

Click a transcript row or measurement evidence action to reveal and seek its
range without creating an annotation. Playhead highlighting remains independent
from annotation selection. Canonical region labels, task notes, history,
autosave, backup, and export retain their existing behavior. File properties
show the decoded sample rate and channel count separately from supplied
metadata.
