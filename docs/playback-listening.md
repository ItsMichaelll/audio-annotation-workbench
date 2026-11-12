# Playback listening controls

The audio workspace includes playback speed from 0.5× through 2× and an optional
speech-reference listening gain. Speed uses the media element's browser playback
rate while retaining the editor's source-time coordinates.

## Speech reference

Open **Speech reference**, then add the selected region or a range at the
playhead. Start and end fields accept millisecond precision. Each range can be
auditioned and removed. Overlapping ranges are merged for measurement and the
total selected duration counts each source sample once. Confirm measures the
concatenated reference with the existing deterministic loudness worklet. Cancel
discards the draft without modifying annotations or the confirmed reference.

Use verified clean speech from the intended speaker. The reference target starts
at −23 LUFS and can be changed from −70 to 0 LUFS. The control refuses silence,
references shorter than 400 ms, invalid bounds, and gain differences exceeding
40 dB. Longer representative references improve inspection usefulness.

The fixed playback gain is target LUFS minus measured reference Integrated LUFS.
**Normalized listening** enables or disables that gain. Each gain change uses a
10 ms time constant to avoid abrupt sample discontinuities. The displayed gain
is the enabled gain or 0 dB for original listening.

## Signal and measurements

The shared Web Audio source has one audible route through a playback GainNode
to the destination. Spectrum and loudness taps attach before that gain. Their
measurements always describe the original source, including when normalized
listening is enabled. Source media, annotations, and annotation exports retain
their underlying values.

A worker scans the decoded source for sample crossings at or above full scale
after applying listening gain. The workspace labels these intervals **Playback
clipping** and displays them only while normalized listening is enabled. This
overlay identifies playback sample crossings. True-peak risk remains available
through the source loudness meter's dBTP measurement. Worker termination cancels
obsolete scans when gain or source changes.

## Ownership and persistence

`PlaybackListeningControls` receives the source buffer, public media element,
source identity, audition callback, and the shared graph's gain controller.
Its optional overlay callbacks expose independent speech-reference and playback
clipping intervals. They do not create canonical WaveSurfer regions or annotation
history entries.

When the host supplies a stable `audioIdentity`, confirmed reference ranges,
measured LUFS, and target LUFS persist through
`storage/listeningPreferences.ts`. The separate IndexedDB database
`audio-annotation-workbench-listening` keeps playback preferences outside the
annotation backup/export contract. Source identity and decoded sample rate,
frame count, and channel count must match before a saved reference can load.
No audio bytes are stored. Hosts must change the identity when the source changes.

A restored reference begins in original listening mode. A user interaction enables
its gain and resumes the browser AudioContext. Focus changes preserve the mounted
controls and their live settings. Replacing the source resets the component,
measurement jobs, clipping worker, speed, and enabled playback gain with the media
graph's lifetime. Missing stable identities retain session-only references.

## Validation

Pure tests cover fixed gain, silence and excessive gain rejection, range merging,
clipping intervals, and source-bound IndexedDB reference round trips. The existing
loudness accuracy limitations also apply to reference measurement. Browser codec,
resampling, playback-rate, and AudioContext policies remain browser-dependent.
