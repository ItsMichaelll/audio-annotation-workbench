/** Hann-windowed, peak-amplitude-normalized FFT for inspecting a paused source. */
export function pcmSpectrum(
  channels: readonly Float32Array[],
  sampleRate: number,
  time: number,
  fftSize: number,
): Float32Array<ArrayBuffer> {
  if (fftSize < 2 || (fftSize & (fftSize - 1)) !== 0 || !(sampleRate > 0)) {
    throw new Error(
      'Spectrum requires a power-of-two FFT and a positive sample rate.',
    )
  }
  const real = new Float64Array(fftSize)
  const imaginary = new Float64Array(fftSize)
  const start = Math.round(time * sampleRate) - Math.floor(fftSize / 2)
  let windowSum = 0
  for (let i = 0; i < fftSize; i++) {
    const window = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (fftSize - 1))
    windowSum += window
  }
  const powers = new Float64Array(fftSize / 2)
  // Combine channel power, avoiding cancellation of opposite-phase stereo.
  for (const channel of channels) {
    for (let i = 0; i < fftSize; i++) {
      const window = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (fftSize - 1))
      real[i] = (channel[start + i] ?? 0) * window
      imaginary[i] = 0
    }
    for (let i = 1, j = 0; i < fftSize; i++) {
      let bit = fftSize >> 1
      for (; j & bit; bit >>= 1) j ^= bit
      j ^= bit
      if (i < j) {
        const value = real[i] ?? 0
        real[i] = real[j] ?? 0
        real[j] = value
      }
    }
    for (let size = 2; size <= fftSize; size *= 2) {
      const half = size / 2
      for (let offset = 0; offset < fftSize; offset += size) {
        for (let k = 0; k < half; k++) {
          const angle = (-2 * Math.PI * k) / size
          const even = offset + k
          const odd = even + half
          const re =
            (real[odd] ?? 0) * Math.cos(angle) -
            (imaginary[odd] ?? 0) * Math.sin(angle)
          const im =
            (real[odd] ?? 0) * Math.sin(angle) +
            (imaginary[odd] ?? 0) * Math.cos(angle)
          real[odd] = (real[even] ?? 0) - re
          imaginary[odd] = (imaginary[even] ?? 0) - im
          real[even] = (real[even] ?? 0) + re
          imaginary[even] = (imaginary[even] ?? 0) + im
        }
      }
    }
    for (let bin = 0; bin < powers.length; bin++) {
      const amplitude =
        (Math.hypot(real[bin] ?? 0, imaginary[bin] ?? 0) * 2) / windowSum
      powers[bin] =
        (powers[bin] ?? 0) +
        (amplitude * amplitude) / Math.max(1, channels.length)
    }
  }
  return Float32Array.from(powers, (power) =>
    power > 0 ? 10 * Math.log10(power) : -Infinity,
  )
}
