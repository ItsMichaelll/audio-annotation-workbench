# Interaction model

## Principles

1. Navigation gestures take priority when their modifier or mouse button is active.
2. Ordinary left-button interaction remains available for playhead placement and region editing.
3. Every transport operation clamps to the valid audio interval.
4. Continuous region drags update readouts live but create one history entry at drag end.
5. The minimap always represents the complete file and is independent of main-waveform zoom.

## Pointer precedence

The waveform scroll container handles gestures in this order:

1. Alt + wheel scales waveform amplitude vertically without changing time zoom or audio gain.
2. Shift + wheel precisely nudges the hovered region, or the selected region when none is hovered. The gesture is reserved for region movement and does nothing when no region is targeted. Each wheel sequence commits one undoable region edit.
3. Middle-button drag and Alt + left-button drag capture the pointer for horizontal panning and prevent region interaction.
4. An unmodified vertical wheel reaches the official Zoom plugin for pointer-centered zoom.
5. An unmodified left drag on an empty waveform area reaches the official Regions plugin for creation.
6. A left drag on a region handle resizes; a left drag on the region body moves it.

Handled waveform gestures prevent native page scrolling or middle-click autoscroll.

## Zoom anchors

Fit derives minimum pixels per second from `viewport width / duration` and resets horizontal scroll. Wheel zoom uses the official Zoom plugin's pointer anchor. Keyboard zoom preserves the playhead location if it is visible; otherwise it preserves viewport center. Zoom and scroll are clamped to the fitted minimum, configured maximum, and valid scroll extent. Vertical scale is independently clamped and resets when another audio file is loaded.

## Region history

Serializable region snapshots contain stable UUID, start, end, and an empty generic `data` record reserved for future configured metadata. WaveSurfer emits live updates during a move or resize and a completed update once the pointer is released. Only the completed snapshot is committed to history. Undo and redo replace the complete serializable region snapshot and the WaveSurfer layer synchronizes to it.

## Loop behavior

Loop is scoped to the selected region. Selecting a different region enables looping by default; the loop control can then disable it without clearing the selection. Clicking within a region selects it and positions the playhead at the corresponding time within its bounds. Creating a region during playback moves the playhead to its start so regions ahead of and behind the previous playback position behave consistently. When playback is paused, the newly created region becomes the pending playback start and the next Play begins at its current start position unless the user chooses another playhead position. Clicking empty waveform or minimap space clears the selection and loop state. Playback wraps to the selected start when it reaches the selected end. Double-click playback uses the exact region bounds.
