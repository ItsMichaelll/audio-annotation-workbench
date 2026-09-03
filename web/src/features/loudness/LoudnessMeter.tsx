import { useMemo, useState } from 'react'
import type { LoudnessSnapshot } from 'loudness-worklet'
import type { RegionMetadata } from '../../domain/region'
import {
  peakToShortTermRatio,
  type TargetRange,
  validateTargetRange,
} from './loudnessMath'
import styles from './LoudnessMeter.module.css'
import type { LoudnessScope } from './loudnessTypes'
import { useOfflineLoudness } from './useOfflineLoudness'

const SCALE_MIN = -60
const SCALE_MAX = 0
const SCALE_LABELS = [0, -6, -12, -18, -24, -36, -48, -60]

function formatMeasurement(value: number, digits = 1): string {
  return Number.isFinite(value) ? value.toFixed(digits) : '−∞'
}

function meterPosition(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(
    0,
    Math.min(100, ((value - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100),
  )
}

interface LoudnessMeterProps {
  audioBuffer: AudioBuffer | null
  live: LoudnessSnapshot | null
  selectedRegion: RegionMetadata | null
  error: string | null
  onClose(): void
}

export function LoudnessMeter({
  audioBuffer,
  live,
  selectedRegion,
  error,
  onClose,
}: LoudnessMeterProps) {
  const [scope, setScope] = useState<LoudnessScope>('file')
  const [statisticsExpanded, setStatisticsExpanded] = useState(true)
  const [target, setTarget] = useState<TargetRange>({
    enabled: false,
    target: -23,
    tolerance: 1,
  })
  const offline = useOfflineLoudness(true, audioBuffer, scope, selectedRegion)
  const targetError = validateTargetRange(target)
  const momentary = live?.momentaryLoudness ?? Number.NEGATIVE_INFINITY
  const shortTerm = live?.shortTermLoudness ?? Number.NEGATIVE_INFINITY
  const currentPsr = live
    ? peakToShortTermRatio(live.maximumTruePeakLevel, shortTerm)
    : Number.NaN
  const targetStyle = useMemo(() => {
    if (!target.enabled || targetError) return undefined
    const lower = meterPosition(target.target - target.tolerance)
    const upper = meterPosition(target.target + target.tolerance)
    return { bottom: `${lower}%`, height: `${upper - lower}%` }
  }, [target, targetError])

  return (
    <aside className={styles.root} aria-label="Loudness and true-peak meter">
      <header className={styles.header}>
        <div>
          <h2 className={styles.headerTitle}>Loudness Meter</h2>
          <span className={styles.headerSubtitle}>BS.1770 / EBU mode</span>
        </div>
        <button
          className={styles.close}
          type="button"
          onClick={onClose}
          aria-label="Hide loudness meter"
        >
          ×
        </button>
      </header>

      <div className={styles.scope} aria-label="Aggregate analysis scope">
        <span>Scope</span>
        <button
          className={styles.scopeButton}
          type="button"
          aria-pressed={scope === 'file'}
          onClick={() => setScope('file')}
        >
          File
        </button>
        <button
          className={styles.scopeButton}
          type="button"
          aria-pressed={scope === 'selection'}
          onClick={() => setScope('selection')}
        >
          Selection
        </button>
      </div>

      <div className={styles.live}>
        <div
          className={styles.scale}
          aria-label="Live momentary loudness scale from minus 60 to 0 LUFS"
        >
          {SCALE_LABELS.map((label) => (
            <span
              className={styles.scaleLabel}
              key={label}
              style={{ bottom: `${meterPosition(label)}%` }}
            >
              {label}
            </span>
          ))}
          <div className={styles.track}>
            {targetStyle && (
              <i
                className={styles.targetBracket}
                style={targetStyle}
                title="QC target range"
              />
            )}
            <i
              className={styles.bar}
              style={{ height: `${meterPosition(momentary)}%` }}
            />
            <i
              className={styles.shortMarker}
              style={{ bottom: `${meterPosition(shortTerm)}%` }}
            />
            {live && (
              <i
                className={styles.holdMarker}
                style={{
                  bottom: `${meterPosition(live.maximumMomentaryLoudness)}%`,
                }}
              />
            )}
          </div>
        </div>
        <div className={styles.readouts}>
          <output className={styles.readout}>
            <span className={styles.readoutLabel}>Momentary</span>
            <strong className={styles.readoutValue}>
              {formatMeasurement(momentary)}
            </strong>
            <small className={styles.readoutUnit}>LUFS</small>
          </output>
          <output className={styles.readout}>
            <span className={styles.readoutLabel}>Short-term</span>
            <strong className={styles.readoutValue}>
              {formatMeasurement(shortTerm)}
            </strong>
            <small className={styles.readoutUnit}>LUFS</small>
          </output>
          <output className={styles.readout}>
            <span className={styles.readoutLabel}>Current PSR</span>
            <strong className={styles.readoutValue}>
              {formatMeasurement(currentPsr)}
            </strong>
            <small className={styles.readoutUnit}>LU</small>
          </output>
          <output
            className={`${styles.readout}${
              live && live.maximumTruePeakLevel >= 0 ? ` ${styles.over}` : ''
            }`}
          >
            <span className={styles.readoutLabel}>TP max live</span>
            <strong className={styles.readoutValue}>
              {formatMeasurement(live?.maximumTruePeakLevel ?? Number.NaN)}
            </strong>
            <small className={styles.readoutUnit}>dBTP</small>
          </output>
        </div>
      </div>

      {!live && (
        <p className={styles.notice}>Play audio to begin live measurement.</p>
      )}
      {error && <p className={`${styles.notice} ${styles.error}`}>{error}</p>}

      <section className={styles.target}>
        <label className={styles.targetToggle}>
          <input
            type="checkbox"
            checked={target.enabled}
            onChange={(event) =>
              setTarget((current) => ({
                ...current,
                enabled: event.target.checked,
              }))
            }
          />{' '}
          Target bracket
        </label>
        {target.enabled && (
          <div className={styles.targetFields}>
            <label className={styles.targetField}>
              Target{' '}
              <input
                className={styles.targetInput}
                type="number"
                min="-70"
                max="0"
                step="0.1"
                value={target.target}
                onChange={(event) =>
                  setTarget((current) => ({
                    ...current,
                    target: event.target.valueAsNumber,
                  }))
                }
              />{' '}
              LUFS
            </label>
            <label className={styles.targetField}>
              ±{' '}
              <input
                className={styles.targetInput}
                type="number"
                min="0.1"
                max="30"
                step="0.1"
                value={target.tolerance}
                onChange={(event) =>
                  setTarget((current) => ({
                    ...current,
                    tolerance: event.target.valueAsNumber,
                  }))
                }
              />{' '}
              LU
            </label>
          </div>
        )}
        {target.enabled && targetError && (
          <p className={styles.targetError} role="alert">
            {targetError}
          </p>
        )}
      </section>

      <section className={styles.statistics}>
        <button
          className={styles.statisticsToggle}
          type="button"
          onClick={() => setStatisticsExpanded((value) => !value)}
          aria-expanded={statisticsExpanded}
        >
          Aggregate statistics <span>{statisticsExpanded ? '▾' : '▸'}</span>
        </button>
        {statisticsExpanded &&
          (offline.status === 'ready' ? (
            <dl className={styles.statisticsList}>
              <div className={styles.statisticsRow}>
                <dt className={styles.statisticsTerm}>Integrated</dt>
                <dd className={styles.statisticsValue}>
                  {formatMeasurement(offline.statistics.integratedLoudness)}{' '}
                  <small className={styles.statisticsUnit}>LUFS</small>
                </dd>
              </div>
              <div className={styles.statisticsRow}>
                <dt className={styles.statisticsTerm}>LRA</dt>
                <dd className={styles.statisticsValue}>
                  {offline.statistics.lraAvailable
                    ? formatMeasurement(offline.statistics.loudnessRange)
                    : '—'}{' '}
                  <small className={styles.statisticsUnit}>LU</small>
                </dd>
              </div>
              <div className={styles.statisticsRow}>
                <dt className={styles.statisticsTerm}>Momentary max</dt>
                <dd className={styles.statisticsValue}>
                  {formatMeasurement(
                    offline.statistics.maximumMomentaryLoudness,
                  )}{' '}
                  <small className={styles.statisticsUnit}>LUFS</small>
                </dd>
              </div>
              <div className={styles.statisticsRow}>
                <dt className={styles.statisticsTerm}>Short-term max</dt>
                <dd className={styles.statisticsValue}>
                  {offline.statistics.shortTermAvailable
                    ? formatMeasurement(
                        offline.statistics.maximumShortTermLoudness,
                      )
                    : '—'}{' '}
                  <small className={styles.statisticsUnit}>LUFS</small>
                </dd>
              </div>
              <div className={styles.statisticsRow}>
                <dt className={styles.statisticsTerm}>True-peak max</dt>
                <dd className={styles.statisticsValue}>
                  {formatMeasurement(offline.statistics.maximumTruePeakLevel)}{' '}
                  <small className={styles.statisticsUnit}>dBTP</small>
                </dd>
              </div>
              <div className={styles.statisticsRow}>
                <dt className={styles.statisticsTerm}>PSR</dt>
                <dd className={styles.statisticsValue}>
                  {offline.statistics.shortTermAvailable
                    ? formatMeasurement(offline.statistics.psr)
                    : '—'}{' '}
                  <small className={styles.statisticsUnit}>LU</small>
                </dd>
              </div>
              <div className={styles.statisticsRow}>
                <dt className={styles.statisticsTerm}>PLR</dt>
                <dd className={styles.statisticsValue}>
                  {formatMeasurement(offline.statistics.plr)}{' '}
                  <small className={styles.statisticsUnit}>LU</small>
                </dd>
              </div>
            </dl>
          ) : (
            <p
              className={`${styles.analysisState}${
                offline.status === 'error' ? ` ${styles.error}` : ''
              }`}
            >
              {offline.status === 'analyzing'
                ? 'Analyzing deterministic scope…'
                : offline.status === 'unavailable' || offline.status === 'error'
                  ? offline.message
                  : 'Waiting for decoded audio…'}
            </p>
          ))}
      </section>
    </aside>
  )
}
