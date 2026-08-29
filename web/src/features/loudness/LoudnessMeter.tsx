import { useMemo, useState } from 'react'
import type { LoudnessSnapshot } from 'loudness-worklet'
import type { RegionMetadata } from '../../domain/region'
import {
  peakToShortTermRatio,
  type TargetRange,
  validateTargetRange,
} from './loudnessMath'
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
    <aside className="loudness-meter" aria-label="Loudness and true-peak meter">
      <header className="loudness-meter__header">
        <div>
          <h2>Loudness Meter</h2>
          <span>BS.1770 / EBU mode</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Hide loudness meter"
        >
          ×
        </button>
      </header>

      <div
        className="loudness-meter__scope"
        aria-label="Aggregate analysis scope"
      >
        <span>Scope</span>
        <button
          className={scope === 'file' ? 'is-active' : undefined}
          type="button"
          onClick={() => setScope('file')}
        >
          File
        </button>
        <button
          className={scope === 'selection' ? 'is-active' : undefined}
          type="button"
          onClick={() => setScope('selection')}
        >
          Selection
        </button>
      </div>

      <div className="loudness-meter__live">
        <div
          className="loudness-meter__scale"
          aria-label="Live momentary loudness scale from minus 60 to 0 LUFS"
        >
          {SCALE_LABELS.map((label) => (
            <span key={label} style={{ bottom: `${meterPosition(label)}%` }}>
              {label}
            </span>
          ))}
          <div className="loudness-meter__track">
            {targetStyle && (
              <i
                className="loudness-meter__target-bracket"
                style={targetStyle}
                title="QC target range"
              />
            )}
            <i
              className="loudness-meter__bar"
              style={{ height: `${meterPosition(momentary)}%` }}
            />
            <i
              className="loudness-meter__short-marker"
              style={{ bottom: `${meterPosition(shortTerm)}%` }}
            />
            {live && (
              <i
                className="loudness-meter__hold-marker"
                style={{
                  bottom: `${meterPosition(live.maximumMomentaryLoudness)}%`,
                }}
              />
            )}
          </div>
        </div>
        <div className="loudness-meter__readouts">
          <output>
            <span>Momentary</span>
            <strong>{formatMeasurement(momentary)}</strong>
            <small>LUFS</small>
          </output>
          <output>
            <span>Short-term</span>
            <strong>{formatMeasurement(shortTerm)}</strong>
            <small>LUFS</small>
          </output>
          <output>
            <span>Current PSR</span>
            <strong>{formatMeasurement(currentPsr)}</strong>
            <small>LU</small>
          </output>
          <output
            className={
              live && live.maximumTruePeakLevel >= 0 ? 'is-over' : undefined
            }
          >
            <span>TP max live</span>
            <strong>
              {formatMeasurement(live?.maximumTruePeakLevel ?? Number.NaN)}
            </strong>
            <small>dBTP</small>
          </output>
        </div>
      </div>

      {!live && (
        <p className="loudness-meter__notice">
          Play audio to begin live measurement.
        </p>
      )}
      {error && <p className="loudness-meter__notice is-error">{error}</p>}

      <section className="loudness-meter__target">
        <label>
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
          <div>
            <label>
              Target{' '}
              <input
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
            <label>
              ±{' '}
              <input
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
        {target.enabled && targetError && <p role="alert">{targetError}</p>}
      </section>

      <section className="loudness-meter__statistics">
        <button
          type="button"
          onClick={() => setStatisticsExpanded((value) => !value)}
          aria-expanded={statisticsExpanded}
        >
          Aggregate statistics <span>{statisticsExpanded ? '▾' : '▸'}</span>
        </button>
        {statisticsExpanded &&
          (offline.status === 'ready' ? (
            <dl>
              <div>
                <dt>Integrated</dt>
                <dd>
                  {formatMeasurement(offline.statistics.integratedLoudness)}{' '}
                  <small>LUFS</small>
                </dd>
              </div>
              <div>
                <dt>LRA</dt>
                <dd>
                  {offline.statistics.lraAvailable
                    ? formatMeasurement(offline.statistics.loudnessRange)
                    : '—'}{' '}
                  <small>LU</small>
                </dd>
              </div>
              <div>
                <dt>Momentary max</dt>
                <dd>
                  {formatMeasurement(
                    offline.statistics.maximumMomentaryLoudness,
                  )}{' '}
                  <small>LUFS</small>
                </dd>
              </div>
              <div>
                <dt>Short-term max</dt>
                <dd>
                  {offline.statistics.shortTermAvailable
                    ? formatMeasurement(
                        offline.statistics.maximumShortTermLoudness,
                      )
                    : '—'}{' '}
                  <small>LUFS</small>
                </dd>
              </div>
              <div>
                <dt>True-peak max</dt>
                <dd>
                  {formatMeasurement(offline.statistics.maximumTruePeakLevel)}{' '}
                  <small>dBTP</small>
                </dd>
              </div>
              <div>
                <dt>PSR</dt>
                <dd>
                  {offline.statistics.shortTermAvailable
                    ? formatMeasurement(offline.statistics.psr)
                    : '—'}{' '}
                  <small>LU</small>
                </dd>
              </div>
              <div>
                <dt>PLR</dt>
                <dd>
                  {formatMeasurement(offline.statistics.plr)} <small>LU</small>
                </dd>
              </div>
            </dl>
          ) : (
            <p
              className={`loudness-meter__analysis-state${offline.status === 'error' ? ' is-error' : ''}`}
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
