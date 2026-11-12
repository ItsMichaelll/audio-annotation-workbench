import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  listeningGainDb,
  normalizeListeningRanges,
  SPEECH_REFERENCE_TARGET_LUFS,
  type ListeningRange,
} from '../../domain/listeningNormalization'
import { analyzeAudioBuffer } from '../loudness/offlineLoudness'
import {
  loadListeningPreference,
  saveListeningPreference,
} from '../../storage/listeningPreferences'
import styles from './PlaybackListeningControls.module.css'

interface Props {
  container?: HTMLElement | null
  audioBuffer: AudioBuffer | null
  mediaElement: HTMLMediaElement | null
  sourceId: string
  audioIdentity?: string
  selectedRegion?: { start: number; end: number } | null
  setPlaybackGain(decibels: number): Promise<boolean>
  onAudition(start: number, end: number): void
  onReferenceRangesChange?(ranges: ListeningRange[]): void
  onPlaybackClippingChange?(ranges: ListeningRange[]): void
}

export function PlaybackListeningControls(props: Props) {
  const controls = (
    <ListeningControls
      key={`${props.sourceId}/${props.audioIdentity ?? ''}`}
      {...props}
    />
  )
  return props.container ? createPortal(controls, props.container) : controls
}

function setMediaPlaybackRate(
  media: HTMLMediaElement | null,
  value: number,
): void {
  if (media) media.playbackRate = value
}

function ListeningControls(props: Props) {
  const {
    audioBuffer,
    mediaElement,
    selectedRegion,
    setPlaybackGain,
    onAudition,
    onReferenceRangesChange,
    onPlaybackClippingChange,
    audioIdentity,
  } = props
  const [speed, setSpeed] = useState(1)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<ListeningRange[]>([])
  const [confirmed, setConfirmed] = useState<ListeningRange[]>([])
  const [target, setTarget] = useState(SPEECH_REFERENCE_TARGET_LUFS)
  const [measured, setMeasured] = useState<number | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const generation = useRef(0)
  const gainDb = measured === null ? null : listeningGainDb(measured, target)
  const displayRanges = editing ? draft : confirmed
  useEffect(() => {
    onReferenceRangesChange?.(displayRanges)
  }, [displayRanges, onReferenceRangesChange])

  useEffect(() => {
    if (!audioBuffer || !audioIdentity) return
    let disposed = false
    const loadingGeneration = generation.current
    void loadListeningPreference(audioIdentity, audioBuffer)
      .then((reference) => {
        if (disposed || !reference || loadingGeneration !== generation.current)
          return
        const ranges = normalizeListeningRanges(
          reference.ranges,
          audioBuffer.duration,
        )
        if (
          !ranges.length ||
          listeningGainDb(reference.measuredLufs, reference.targetLufs) === null
        )
          return
        setConfirmed(ranges)
        setDraft(ranges)
        setMeasured(reference.measuredLufs)
        setTarget(reference.targetLufs)
      })
      .catch((failure: unknown) => {
        if (!disposed)
          setError(
            failure instanceof Error
              ? failure.message
              : 'Stored listening reference could not be loaded.',
          )
      })
    return () => {
      disposed = true
    }
  }, [audioBuffer, audioIdentity])

  useEffect(() => {
    if (!audioBuffer || !enabled || gainDb === null) {
      onPlaybackClippingChange?.([])
      return
    }
    const worker = new Worker(
      new URL('./playbackClipping.worker.ts', import.meta.url),
      { type: 'module' },
    )
    worker.onmessage = (event: MessageEvent<ListeningRange[]>) =>
      onPlaybackClippingChange?.(event.data)
    worker.onerror = () =>
      setError(
        'Playback clipping analysis failed. Listening gain remains available.',
      )
    const channels = Array.from(
      { length: audioBuffer.numberOfChannels },
      (_, channel) => audioBuffer.getChannelData(channel).slice(),
    )
    worker.postMessage(
      { channels, sampleRate: audioBuffer.sampleRate, gainDb },
      channels.map((channel) => channel.buffer),
    )
    return () => worker.terminate()
  }, [audioBuffer, enabled, gainDb, onPlaybackClippingChange])

  useEffect(
    () => () => {
      generation.current++
    },
    [],
  )

  async function toggleNormalization() {
    if (gainDb === null) return
    try {
      if (await setPlaybackGain(enabled ? 0 : gainDb)) {
        setEnabled(!enabled)
        setError(null)
      } else
        setError(
          'Listening gain could not be applied. Try playing audio first.',
        )
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'Listening gain failed.',
      )
    }
  }

  async function confirmReference() {
    if (!audioBuffer) return
    const ranges = normalizeListeningRanges(draft, audioBuffer.duration)
    if (
      !ranges.length ||
      draft.some(
        (range) =>
          !Number.isFinite(range.start) ||
          !Number.isFinite(range.end) ||
          range.start < 0 ||
          range.end <= range.start ||
          range.end > audioBuffer.duration,
      )
    ) {
      setError('Enter valid ranges within this audio file.')
      return
    }
    const frameRanges = ranges.map((range) => ({
      start: Math.floor(range.start * audioBuffer.sampleRate),
      end: Math.ceil(range.end * audioBuffer.sampleRate),
    }))
    const frameCount = frameRanges.reduce(
      (sum, range) => sum + range.end - range.start,
      0,
    )
    if (frameCount < audioBuffer.sampleRate * 0.4) {
      setError('Select at least 400 ms of verified clean speech.')
      return
    }
    const currentGeneration = ++generation.current
    setBusy(true)
    setError(null)
    try {
      const reference = new AudioBuffer({
        numberOfChannels: audioBuffer.numberOfChannels,
        sampleRate: audioBuffer.sampleRate,
        length: frameCount,
      })
      for (let channel = 0; channel < reference.numberOfChannels; channel++) {
        let offset = 0
        for (const range of frameRanges) {
          reference
            .getChannelData(channel)
            .set(
              audioBuffer
                .getChannelData(channel)
                .subarray(range.start, range.end),
              offset,
            )
          offset += range.end - range.start
        }
      }
      const statistics = await analyzeAudioBuffer(reference)
      if (generation.current !== currentGeneration) return
      if (listeningGainDb(statistics.integratedLoudness, target) === null)
        throw new Error(
          'The reference is silent or requires more than 40 dB of gain. Choose another speech reference.',
        )
      if (enabled) await setPlaybackGain(0)
      if (generation.current !== currentGeneration) return
      setEnabled(false)
      setMeasured(statistics.integratedLoudness)
      setConfirmed(ranges)
      setEditing(false)
      if (audioIdentity) {
        await saveListeningPreference({
          sourceIdentity: audioIdentity,
          sampleRate: audioBuffer.sampleRate,
          frames: audioBuffer.length,
          channels: audioBuffer.numberOfChannels,
          ranges,
          measuredLufs: statistics.integratedLoudness,
          targetLufs: target,
        })
      }
    } catch (failure) {
      if (generation.current === currentGeneration)
        setError(
          failure instanceof Error
            ? failure.message
            : 'Reference measurement failed.',
        )
    } finally {
      if (generation.current === currentGeneration) setBusy(false)
    }
  }

  function addSelection() {
    const range = selectedRegion ?? {
      start: mediaElement?.currentTime ?? 0,
      end: Math.min(
        (mediaElement?.currentTime ?? 0) + 1,
        audioBuffer?.duration ?? 0,
      ),
    }
    setDraft((current) => [...current, { ...range, id: crypto.randomUUID() }])
  }

  return (
    <section
      className={styles.root}
      data-docked={Boolean(props.container)}
      aria-label="Listening controls"
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !editing) return
        event.preventDefault()
        event.stopPropagation()
        generation.current++
        setDraft(confirmed)
        setBusy(false)
        setEditing(false)
      }}
    >
      <div className={styles.toolbar}>
        <label>
          Speed{' '}
          <select
            aria-label="Playback speed"
            value={speed}
            onChange={(event) => {
              const value = Number(event.target.value)
              setMediaPlaybackRate(mediaElement, value)
              setSpeed(value)
            }}
          >
            {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((value) => (
              <option key={value} value={value}>
                {value}×
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!audioBuffer || busy}
          aria-expanded={editing}
          onClick={() => {
            generation.current++
            setDraft(confirmed)
            setEditing(!editing)
            setError(null)
          }}
        >
          Speech reference
        </button>
        <button
          type="button"
          disabled={gainDb === null || busy}
          aria-pressed={enabled}
          onClick={() => void toggleNormalization()}
        >
          Normalized listening
        </button>
        <output>
          {measured === null
            ? 'Original source'
            : `${enabled ? gainDb?.toFixed(1) : '0.0'} dB playback gain · reference ${measured.toFixed(1)} LUFS`}
        </output>
      </div>
      {editing && (
        <div className={styles.reference}>
          <p>
            Select verified clean speech. The confirmed reference sets one fixed
            listening gain for this source.
          </p>
          <label>
            Listening target{' '}
            <input
              type="number"
              min={-70}
              max={0}
              step={0.1}
              disabled={enabled || busy}
              value={Number.isNaN(target) ? '' : target}
              onChange={(event) => setTarget(event.target.valueAsNumber)}
            />{' '}
            LUFS
          </label>
          {draft.map((range, index) => (
            <div className={styles.range} key={range.id}>
              <label>
                Start {index + 1}
                <input
                  type="number"
                  step={0.001}
                  min={0}
                  max={audioBuffer?.duration}
                  value={Number.isFinite(range.start) ? range.start : ''}
                  disabled={busy}
                  onChange={(event) =>
                    setDraft((current) =>
                      current.map((item) =>
                        item.id === range.id
                          ? { ...item, start: event.target.valueAsNumber }
                          : item,
                      ),
                    )
                  }
                />
              </label>
              <label>
                End {index + 1}
                <input
                  type="number"
                  step={0.001}
                  min={0}
                  max={audioBuffer?.duration}
                  value={Number.isFinite(range.end) ? range.end : ''}
                  disabled={busy}
                  onChange={(event) =>
                    setDraft((current) =>
                      current.map((item) =>
                        item.id === range.id
                          ? { ...item, end: event.target.valueAsNumber }
                          : item,
                      ),
                    )
                  }
                />
              </label>
              <button
                type="button"
                disabled={busy || range.end <= range.start}
                onClick={() => onAudition(range.start, range.end)}
              >
                Audition
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  setDraft((current) =>
                    current.filter((item) => item.id !== range.id),
                  )
                }
              >
                Remove
              </button>
            </div>
          ))}
          <output>
            {normalizeListeningRanges(draft, audioBuffer?.duration ?? 0)
              .reduce((sum, range) => sum + range.end - range.start, 0)
              .toFixed(3)}{' '}
            s selected
          </output>
          <div className={styles.toolbar}>
            <button type="button" disabled={busy} onClick={addSelection}>
              {selectedRegion ? 'Add selected region' : 'Add range at playhead'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void confirmReference()}
            >
              {busy ? 'Measuring…' : 'Confirm reference'}
            </button>
            <button
              type="button"
              onClick={() => {
                generation.current++
                setBusy(false)
                setDraft(confirmed)
                setEditing(false)
                setError(null)
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {enabled && (
        <p className={styles.notice}>
          Playback gain enabled. Spectrum and loudness inspect the original
          source. Playback clipping overlays show sample crossings after gain.
        </p>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </section>
  )
}
