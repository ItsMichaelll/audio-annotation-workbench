# Editor navigation and analysis tools

The shared `WaveformEditor` powers standalone, project-task, and hosted dialogue
review lanes. Display controls keep the existing WaveSurfer instance mounted.
Source audio, annotation boundaries, and playback gain retain separate owners.

## Waveform display

The Waveform view disclosure provides linear or logarithmic amplitude display,
combined or split stereo channels, playback follow Off/Page/Center, an optional
gap ruler, and boundary guides. Logarithmic display uses the sign-preserving
transform `log(1 + 9 × abs(sample)) / log(10)`. It is applied only while drawing.
Split mode draws each channel in its own vertically aligned band. The source
samples and the full-file overview remain unchanged.

Waveform height is adjustable from 96 to 480 pixels. The gap ruler is a separate
observational interval below the waveform. Drag its body or boundary grips, enter
precise source times, or focus a grip and use Left/Right to step one millisecond.
Clipped ruler boundaries have no draggable grip. The readout reports elapsed
milliseconds. Boundary guides highlight ±100 ms around the selected edges.

The default AAW navigation preset retains wheel zoom. The Trackpad preset uses
ordinary wheel/swipe to pan and Ctrl/Cmd-wheel to zoom at the pointer. Alt-wheel
amplitude scaling, middle-button pan, and Alt-left pan work in both presets.
Trackpad starts with Shift-wheel panning. Its explicit Shift-wheel region-motion
checkbox enables movement of a selected region. AAW starts with its existing
selected-region motion enabled. Switching presets updates that default and the
checkbox permits a further local choice. Vertical workspace scrolling remains
available over the surrounding panels. Display settings do not change
annotation history.

## Spectrogram

The official windowed WaveSurfer spectrogram exposes Linear/Log frequency,
512/1024/2048/4096 FFT samples, and 70/90/110 dB color range. These settings
change the image only. The frequency axis is derived from decoded Nyquist.
Changing a setting disposes the old plugin and its worker before creating the
replacement. The waveform, minimap, scrollbar, and spectrogram share full-content
pixel width and horizontal scroll geometry.

WaveSurfer is explicitly configured to decode analysis PCM at 48 kHz. Its
default 8 kHz waveform decode would discard frequencies above 4 kHz and is
unsuitable for the source spectrum, spectrogram, and offline loudness tools.
Browser decoding resamples files at other rates to 48 kHz for these source
inspection tools. The decoded rate and channel count are reported through
`onAudioProperties`. A 96 kHz file therefore has a 24 kHz decoded Nyquist limit
in this workspace. The original media element remains the playback source and
the live analyzer uses its own AudioContext sample rate.

Selection, playhead, speech-reference ranges, playback clipping, and optional
inspection evidence are drawn as DOM overlays in the same time transform.
Speech-reference and playback-clipping overlays remain separate from canonical
annotation regions and carry explicit labels.

## Spectrum

FFT sizes are 2048, 4096, 8192, and 16384. Live playback uses the shared graph's
`AnalyserNode`. Paused inspection computes a Hann-windowed FFT centered on the
playhead from decoded source PCM. Samples outside the file are zero-padded.
Channel power is averaged before converting to dBFS, avoiding opposite-phase
stereo cancellation. The FFT uses coherent window-amplitude normalization, so a
bin-centered 0.5-amplitude sine reads approximately -6.02 dBFS.

The readout explicitly distinguishes Live and Source. Live Web Audio analysis
uses the browser's FFT window and temporal smoothing, while paused inspection
uses the source Hann window. Magnitudes can differ between those measurement
windows. Freeze retains the current plot across playback and seeking. Response
presets affect live temporal smoothing. Peak hold retains its established hold
and decay settings. Closing the panel stops rendering and FFT reads and retains
its selected response, FFT size, Freeze, and Peak Hold settings for that source.

## Loudness

The loudness rail retains File/Selection scope and target controls when hidden.
Hosts may supply an independent `activeRange` to expose an additional Range
scope and give Fit and boundary-jump controls explicit review bounds. Feedback
evidence ranges stay separate from that reviewed range.
Its optional target defaults to -23 ±2 LUFS and stays disabled until requested.
All statistics describe source audio. Playback normalization does not feed the
source measurement taps. Live values reflect samples at the current playback
speed. Offline statistics use the original decoded samples. Selection analysis
is debounced, and results are tagged
with the exact decoded buffer, scope, and bounds. Superseded results are ignored
and the current scope shows Analyzing while waiting.

## Shared-clock hosts

A host may supply `playbackController`, `externalTime`, `viewport`, and
`onViewportChange`. WaveSurfer then stays a muted visual lane. The host owns
audible playback and exact-bound region audition. Cursor and viewport echo
guards prevent host-driven updates from seeking or scrolling the clock again.
The optional `externalDecodedAudio` and `externalAnalyser` supply source PCM and
the active track's live spectral tap. `externalAnalysisOffset` maps common-clock
positions and selection bounds into that source. `externalLoudnessSnapshot`
supplies a live worklet snapshot when the host has a sample-accurate tap. Hosted
File/Selection loudness remains available from PCM. Hosts without a live
loudness worklet show an explicit unavailable notice for live loudness.

The optional `inspectionRange` overlays review evidence without creating an
annotation. `onAudioProperties` reports verified decoded sample rate, channel
count, and duration. `audioIdentity` lets the listening controls bind confirmed
reference settings to the application's stable source identity.

## Validation

Pure tests cover spectral peak placement and amplitude, opposite-phase stereo,
silence, invalid FFT sizes, frequency-axis mapping, and display-amplitude
invariants. Browser acceptance tests should exercise rapid seek and source
replacement with all analysis tools enabled, and shared-clock hosts should
confirm that a cursor update never restarts playback. Every analysis path stays
local to the browser.
