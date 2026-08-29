# ADR 0003: Worklet and offline contexts for loudness measurement

- Status: Accepted
- Date: 2026-08-29

## Context

Professional loudness inspection requires sample-accurate K-weighting, channel energy handling, standardized windows and gates, Loudness Range statistics, and oversampled true peak. Polling the spectrum `AnalyserNode` can miss samples and cannot provide deterministic file or region summaries. The feature must share WaveSurfer's media-element playback without creating a second source or changing the audio.

## Decision

Use the MIT-licensed `loudness-worklet` 2.0.2 implementation for live and offline DSP. It is small, browser-native, typed, has no transitive runtime dependencies, implements ITU-R BS.1770-5 and EBU Mode measurements, and publishes results against the ITU BS.2217 and EBU Tech 3341/3342 test material.

Generalize audio ownership into `features/analysis/useAnalysisAudio.ts`. It creates exactly one `MediaElementAudioSourceNode`. The source has one direct audible route to the destination. Spectrum and loudness are independent analysis taps terminating at a zero-gain bus, so neither contributes a parallel audible signal. Meter closure disconnects the worklet tap; permanent media disposal disconnects all nodes, closes the worklet port, and closes the `AudioContext`.

Use an `AudioWorkletProcessor` for live measurements and copy compact snapshots to React at 10 Hz. Use a separate `OfflineAudioContext` for deterministic File and Selection summaries. Offline analysis starts at exact sample-frame bounds in the already decoded local buffer, and generation tokens reject stale results. This avoids playback-history bias and avoids copying large PCM buffers to a Worker.

Keep rendering in semantic HTML/CSS. The meter has a small fixed set of bars, markers, labels, and readouts, so Canvas or a charting dependency would add complexity without improving performance.

Do not implement EQ, normalization, gain, limiting, compression, or any other audio processing. The target bracket is visual session state only.

## Measurement semantics

- Momentary: ungated 400 ms sliding loudness, LUFS.
- Short-term: ungated three-second sliding loudness, LUFS.
- Integrated: 400 ms blocks with 75% overlap, -70 LUFS absolute gate, then -10 LU relative gate.
- LRA: gated Short-term distribution using the -70 LUFS absolute gate, -20 LU relative gate, and 10th/95th percentiles.
- True peak: dBTP from the dependency's ITU polyphase FIR oversampling; four-times oversampling at 44.1/48 kHz.
- PSR: maximum true peak minus maximum Short-term loudness, LU. The live display instead pairs the live true-peak maximum with the current Short-term value and labels that context.
- PLR: maximum true peak minus Integrated loudness, LU.

## Accuracy boundary

This project is not certified by ITU, EBU, or another third party. The dependency reports broad success against the official reference suites. It documents one 44.1 kHz true-peak case at -0.45 dBTP, 0.05 dB below the EBU accepted minimum. Application-level comparison against a trusted meter remains required before making a compliance or calibration claim. Mono and stereo aggregate analysis are supported; larger channel layouts are rejected until their channel assignments and weights can be validated.

## Consequences

The meter remains local-only and does not alter playback. Live and aggregate measurements have explicit ownership and semantics. Offline rendering may consume meaningful browser resources for long files, and current browser APIs cannot cancel a render already in progress; stale renders are ignored. A Web Worker was intentionally not added because `OfflineAudioContext` keeps DSP off the live playback path and avoids transferring a second large PCM copy.
