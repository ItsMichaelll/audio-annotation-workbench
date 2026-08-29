# Interaction model

## Principles

1. Navigation gestures take priority when their modifier or mouse button is active.
2. Ordinary left-button interaction remains available for playhead placement and region editing.
3. Every transport operation clamps to the valid audio interval.
4. Continuous region drags update readouts live but create one history entry at drag end.
5. The minimap always represents the complete file and is independent of main-waveform zoom.
6. Analysis views observe the audio and navigation state without changing the playback signal.

## Transport controls

The transport bar is ordered as Play/Pause; separator; Fit, zoom out, zoom in, and Reset V-Scale; separator; Loop and Delete; separator; Spectrogram and Spectrum Analyzer. The analysis-view buttons use the active accent background when enabled and the normal transport-control background when disabled. Their panel-local close buttons provide the same hide action.

Loop and Delete are disabled when no region is selected. Reset V-Scale restores `1.00`. Undo and redo remain available through `Ctrl+Z`, `Ctrl+Y`, and `Ctrl+Shift+Z`; they are not transport buttons.

## Pointer precedence

The waveform scroll container handles gestures in this order:

1. Alt + wheel scales waveform amplitude vertically without changing time zoom or audio gain.
2. Shift + wheel precisely nudges the hovered region, or the selected region when none is hovered. The gesture is reserved for region movement and does nothing when no region is targeted. Each wheel sequence commits one undoable region edit.
3. Middle-button drag and Alt + left-button drag capture the pointer for horizontal panning and prevent region interaction.
4. An unmodified vertical wheel reaches the official Zoom plugin for pointer-centered zoom.
5. An unmodified left drag on an empty waveform area reaches the official Regions plugin for creation.
6. A left drag on a region handle resizes; a left drag on the region body moves it.

Handled waveform gestures prevent native page scrolling or middle-click autoscroll. Shift+wheel is not horizontal panning.

## Zoom anchors

Fit derives minimum pixels per second from `viewport width / duration` and resets horizontal scroll. Wheel zoom uses the official Zoom plugin's pointer anchor. Keyboard zoom preserves the playhead location if it is visible; otherwise it preserves viewport center. Zoom and scroll are clamped to the fitted minimum, configured maximum, and valid scroll extent. Vertical scale is independently clamped from `0.25` to `8.00`, snaps to `1.00` near unity, and resets when another audio file is loaded.

Wheel input over the minimap is translated to the same zoom operation using the corresponding full-file time as its anchor. Dragging the minimap viewport or the dedicated scrollbar pans the main waveform. The scrollbar occupies a permanent row beneath the minimap and becomes inert when there is no horizontal overflow, so panels below it do not shift when zoom changes.

## Region history

Serializable region snapshots contain stable UUID, start, end, and an empty generic `data` record reserved for future configured metadata. WaveSurfer emits live updates during a move or resize and a completed update once the pointer is released. Only the completed snapshot is committed to history. Undo and redo replace the complete serializable region snapshot and the WaveSurfer layer synchronizes to it.

## Loop behavior

Loop is scoped to the selected region. Selecting a different region enables looping by default; the loop control can then disable it without clearing the selection. Clicking within a region selects it and positions the playhead at the corresponding time within its bounds. Creating a region during playback moves the playhead to its start so regions ahead of and behind the previous playback position behave consistently. When playback is paused, the newly created region becomes the pending playback start and the next Play begins at its current start position unless the user chooses another playhead position. Clicking empty waveform or minimap space clears the selection and loop state, moves the playhead to the clicked time, and continues playback if it was already active. Playback wraps only when transport reaches the selected end; deliberately seeking beyond a region does not trigger a stale loop wrap. Double-click playback uses the exact region bounds.

## Analysis panels

Spectrum visibility is independent of Spectrogram visibility. Their toggle buttons follow Loop and Delete in the transport bar, and each panel has its own top-right close button. Below the waveform, the fixed order is minimap, reserved minimap scrollbar, spectrogram, then spectrum analyzer. Disabled analysis panels are removed from layout. Enabling Spectrum Analyzer creates the Web Audio graph after that user interaction. Freeze stops display sampling and drawing without changing transport. Pausing preserves the latest frame. Peak Hold is enabled by default, holds maxima for 400 ms, and then decays at 12 dB per second so recent narrow resonances remain readable without becoming stale. Fast (`0.35`), Balanced (`0.72`), and Smooth (`0.88`) alter only `AnalyserNode.smoothingTimeConstant`; they do not alter the audible signal.

The hover cursor uses the same logarithmic frequency and linear decibel mapping as the plotted trace. Hiding the panel removes it from layout and cancels its animation callback. Loading a different file resets all analyzer display and control state.

The spectrogram uses the same full-content pixel width and horizontal scroll offset as the primary waveform. Zoom, minimap navigation, scrollbar movement, and drag panning therefore keep each spectrogram column aligned with the same audio time shown directly above it. Its logarithmic frequency labels remain fixed at the left edge while the time content scrolls beneath them, and labels above the decoded Nyquist frequency are omitted.
