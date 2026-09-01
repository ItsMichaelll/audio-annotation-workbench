# Interaction model

These controls apply to the standalone editor at `/editor` and the project-task
annotation workspace. The dashboard and project screens use conventional links,
forms, and browser history.

## Principles

1. Navigation gestures take priority when their modifier or mouse button is active.
2. Ordinary left-button interaction remains available for playhead placement and region editing.
3. Every transport operation clamps to the valid audio interval.
4. Continuous region drags update readouts live but create one history entry at drag end.
5. The minimap always represents the complete file and is independent of main-waveform zoom.
6. Analysis views observe the audio and navigation state without changing the playback signal.

## Transport controls

The transport bar includes Previous Region and Next Region controls alongside the existing playback, zoom, region, and analysis controls. Region navigation is chronological, does not wrap or autoplay, selects and reveals the destination, and seeks to its start.

Loop and Delete are disabled when no region is selected. Reset V-Scale restores `1.00`. Undo and redo remain available through `Ctrl+Z`, `Ctrl+Y`, and `Ctrl+Shift+Z`; they are not transport buttons.

## Pointer precedence

The waveform scroll container handles gestures in this order:

1. Alt + wheel scales waveform amplitude vertically without changing time zoom or audio gain.
2. Shift + wheel pans horizontally when no region is selected, regardless of which element is hovered. When a region is selected, the gesture precisely nudges only that region and each wheel sequence commits one undoable region edit.
3. Middle-button drag and Alt + left-button drag capture the pointer for horizontal panning and prevent region interaction.
4. An unmodified vertical wheel reaches the official Zoom plugin for pointer-centered zoom.
5. An unmodified left drag on an empty waveform area reaches the official Regions plugin for creation.
6. A left drag on a region handle resizes; a left drag on the region body moves it.

Handled waveform gestures prevent native page scrolling or middle-click autoscroll.

## Zoom anchors

Fit derives minimum pixels per second from `viewport width / duration` and resets horizontal scroll. Wheel zoom uses the official Zoom plugin's pointer anchor. Keyboard zoom preserves the playhead location if it is visible; otherwise it preserves viewport center. Zoom and scroll are clamped to the fitted minimum, configured maximum, and valid scroll extent. Vertical scale is independently clamped from `0.25` to `8.00`, snaps to `1.00` near unity, and resets when another audio file is loaded.

Wheel input over the minimap is translated to the same zoom operation using the corresponding full-file time as its anchor. Dragging the minimap viewport or the dedicated scrollbar pans the main waveform. The scrollbar occupies a permanent row beneath the minimap and becomes inert when there is no horizontal overflow, so panels below it do not shift when zoom changes.

## Region history

Serializable project annotations contain stable region UUIDs, normalized bounds,
label assignments, and optional notes. WaveSurfer emits live updates during a
move or resize and a completed update once the pointer is released. Only the
completed snapshot is committed to history. Region creation/deletion, geometry,
region and clip labels, scales, and notes share snapshot undo/redo. WaveSurfer
synchronization and autosave do not create history entries; undo/redo changes
save through the normal draft path.

## Annotation keyboard and submission

Configured taxonomy shortcuts toggle a region-capable label on the selected
region, or a clip-capable label when no region is selected. Existing editor keys
are reserved during taxonomy validation. All shortcuts are ignored while an
input, textarea, select, button, or editable element has focus.

`Ctrl+Left` and `Ctrl+Right` select the previous or next chronological region,
reveal it in the waveform viewport, and seek to its start without autoplaying.

`Ctrl+Enter` runs normal submission validation and empty-annotation
confirmation before submitting and advancing. `Ctrl+Shift+Enter` flushes the
draft, skips the task, and advances. Navigation is stopped when a required save
fails. Submitted tasks render read-only until reopened from project management.

## Loop behavior

Loop is scoped to the selected region. Selecting a different region enables looping by default; the loop control can then disable it without clearing the selection. Clicking within a region selects it and positions the playhead at the corresponding time within its bounds. Creating a region during playback moves the playhead to its start so regions ahead of and behind the previous playback position behave consistently. When playback is paused, the newly created region becomes the pending playback start and the next Play begins at its current start position unless the user chooses another playhead position. Clicking empty waveform or minimap space clears the selection and loop state, moves the playhead to the clicked time, and continues playback if it was already active. Playback wraps only when transport reaches the selected end; deliberately seeking beyond a region does not trigger a stale loop wrap. Double-click playback uses the exact region bounds.

## Analysis panels

Spectrum, Spectrogram, and Meter visibility are independent. Their toggle buttons follow Loop and Delete in the transport bar, and each view has its own top-right close button. Below the waveform, the fixed order is minimap, reserved minimap scrollbar, spectrogram, then spectrum analyzer. Meter occupies a fixed rail to the right of that stack, never inside a horizontally scrolling viewport. Disabled views are removed from layout. Enabling Spectrum Analyzer or Meter creates the shared Web Audio graph after that user interaction. Freeze stops spectrum sampling and drawing without changing transport. Pausing preserves the latest analysis frame. Peak Hold is enabled by default, holds maxima for 400 ms, and then decays at 12 dB per second so recent narrow resonances remain readable without becoming stale. Fast (`0.35`), Balanced (`0.72`), and Smooth (`0.88`) alter only `AnalyserNode.smoothingTimeConstant`; they do not alter the audible signal.

The hover cursor uses the same logarithmic frequency and linear decibel mapping as the plotted trace. Hiding the panel removes it from layout and cancels its animation callback. Loading a different file resets all analyzer display and control state.

The spectrogram uses the same full-content pixel width and horizontal scroll offset as the primary waveform. Zoom, minimap navigation, scrollbar movement, and drag panning therefore keep each spectrogram column aligned with the same audio time shown directly above it. Its logarithmic frequency labels remain fixed at the left edge while the time content scrolls beneath them, and labels above the decoded Nyquist frequency are omitted.

Meter live values update at 10 Hz during playback and retain their last values while paused. Momentary uses 400 ms; Short-term uses three seconds. The live true-peak readout is explicitly a maximum since the live processor started. File and Selection statistics use deterministic offline rendering and therefore never inherit seeks, loops, or playback duration. Selecting or resizing a region schedules a new Selection analysis and superseded results are ignored. A missing selection, scopes too short for Short-term/LRA, digital silence, and failed analysis each have distinct unavailable states.

The optional target bracket is a local visual reference. It is disabled by default, requires a target from -70 to 0 LUFS and a positive tolerance no greater than 30 LU, and never changes playback or creates an annotation.
