# ADR 0002: Pass-through real-time spectrum analysis

- Status: Accepted
- Date: 2026-08-29
- Implementation: Complete; automated validation is in place, with manual browser acceptance required before the next analysis milestone

## Context

Expert review benefits from a responsive view of the spectrum currently reaching playback. This milestone needs transient visual inspection, not equalization, offline analysis, or automatic interpretation. The analyzer must preserve WaveSurfer transport and the audio signal exactly while remaining efficient on long local files.

## Decision

Use the browser's Web Audio `AnalyserNode` and `getFloatFrequencyData()` with a centralized 8192-point FFT. WaveSurfer continues to use its default media-element backend. The waveform integration obtains that element through the public `getMediaElement()` API, then lazily creates this single route after a user interaction:

`MediaElementAudioSourceNode -> AnalyserNode -> AudioContext.destination`

There is no parallel connection to the destination and no gain, filter, compressor, normalizer, or other processing node. One graph owns each media element. A guard rejects duplicate source creation, including repeated play events and React Strict Mode behavior. Graph nodes are disconnected and the context is closed only when the owning media element is permanently disposed; hiding the analyzer stops visualization work without disturbing playback routing.

Render the display with Canvas 2D. It is sufficient for one high-DPI trace, has no additional dependency, and permits reusable typed-array buffers with no per-frame React state. Each horizontal pixel column maps to a logarithmic frequency interval. Complete FFT bins in that interval use their maximum magnitude to retain narrow peaks; intervals narrower than a bin interpolate at their geometric-center frequency.

Balanced response uses `smoothingTimeConstant = 0.72`; Fast uses `0.35`, and Smooth uses `0.88`. Peak Hold retains a maximum for 400 ms and then decays at 12 dB per second. These values are display configuration only.

## Consequences

- The analyzer reflects the real-time playback signal and remains silent until playback supplies samples.
- Browser autoplay rules require creation or resumption of the AudioContext from a user interaction.
- AudioContext sample-rate conversion, when chosen by the browser, determines the analyzer's Nyquist frequency.
- Canvas rendering stops while hidden, frozen, or paused; the latest frame remains visible while frozen or paused.
- Full-file, selected-region averaged, and long-term averaged spectra require a separate offline-analysis design and remain future work.
- Actual EQ processing is intentionally excluded because it would modify the reviewed evidence and turn an inspection tool into an audio processor.
