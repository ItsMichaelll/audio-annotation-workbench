import { CustomSelectField } from '../../components/CustomSelect'
import {
  SPECTROGRAM_DB_RANGES,
  SPECTROGRAM_FFT_SIZES,
  type SpectrogramScale,
} from './analysisSettings'
import styles from './SpectrogramControls.module.css'

export function SpectrogramControls({
  scale,
  fftSize,
  rangeDB,
  onScale,
  onFft,
  onRange,
}: {
  scale: SpectrogramScale
  fftSize: number
  rangeDB: number
  onScale(value: SpectrogramScale): void
  onFft(value: number): void
  onRange(value: number): void
}) {
  return (
    <div className={styles.root}>
      <CustomSelectField
        variant="spectrum"
        label="Frequency"
        value={scale}
        options={[
          { value: 'linear', label: 'Linear' },
          { value: 'logarithmic', label: 'Log' },
        ]}
        onChange={(value) => {
          if (value === 'linear' || value === 'logarithmic') onScale(value)
        }}
      />
      <CustomSelectField
        variant="spectrum"
        label="FFT"
        value={String(fftSize)}
        options={SPECTROGRAM_FFT_SIZES.map((value) => ({
          value: String(value),
          label: String(value),
        }))}
        onChange={(value) => {
          const size = Number(value)
          if (SPECTROGRAM_FFT_SIZES.some((item) => item === size)) onFft(size)
        }}
      />
      <CustomSelectField
        variant="spectrum"
        label="Range"
        value={String(rangeDB)}
        options={SPECTROGRAM_DB_RANGES.map((value) => ({
          value: String(value),
          label: `${value} dB`,
        }))}
        onChange={(value) => {
          const range = Number(value)
          if (SPECTROGRAM_DB_RANGES.some((item) => item === range))
            onRange(range)
        }}
      />
    </div>
  )
}
