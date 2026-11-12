# Offline loudness scope boundaries

File, active Range, Selection, and speech-reference loudness analysis render the
requested decoded source samples in a separate OfflineAudioContext. A 120 ms
silent tail flushes the true-peak FIR interpolation state.

A looped 128-frame zero buffer keeps the offline worklet's source-channel layout
active through that flush. Browsers may otherwise remove the ended source's input
channels, which prevents the FIR and final snapshot timestamp from advancing.
The zero buffer adds no signal energy and is disconnected with the offline job.

Integrated loudness, LRA, Momentary maximum, and Short-term maximum come from the
last complete processing quantum wholly within the requested source scope. The
silent tail contributes exclusively to the true-peak maximum. Every scope starts
with fresh filter and measurement state, independent of prior playback or seeks.

The public loudness-worklet interval is one source sample during offline
rendering so a snapshot is available for every current 128-frame Web Audio
quantum. The application retains only the scoped snapshot and the true-peak
maximum. A representative 180-second 48 kHz render produces about 67500 compact
snapshot messages. These messages update local accumulator variables and never
enter React state. A suspended offline context at the complete-scope boundary
also reads the node's public snapshot API, covering shared-memory hosts.

The worklet exposes quantum-level snapshots and does not offer partial-quantum
finalization. Loudness therefore excludes up to 127 trailing samples for a scope
whose length is not divisible by 128. The resulting boundary limit is less than
2.67 ms at 48 kHz or 2.91 ms at 44.1 kHz. The 400 ms and three-second test scopes
are exactly quantum-aligned at 48 kHz. True-peak maximum includes the remaining
source samples and interpolation tail.

Pure tests verify scope inclusion and that flushing changes only true peak.
Headless tests compare a continuous synthetic 1 kHz sine across File, an offset
three-second Selection, and a 400 ms Selection. These tests detect scope-tail
contamination and exercise source-time offsets. They do not constitute an
independent ITU/EBU reference-suite certification. The dependency's documented
coefficient, histogram, window-quantization, and true-peak tolerances still apply.
