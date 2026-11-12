import {
  clampReviewTime,
  planPairedSegment,
  type ReviewRange,
} from '../../domain/dialogueReview'
import type LoudnessNode from 'loudness-worklet'
import type { LoudnessSnapshot } from 'loudness-worklet'
import { MAX_LISTENING_GAIN_DB } from '../../domain/listeningNormalization'

export interface PairedPlaybackTrack {
  id: string
  buffer: AudioBuffer
  offsetSeconds: number
  muted: boolean
}

export interface PairedPlaybackState {
  time: number
  playing: boolean
  rate: number
}

const SCHEDULE_AHEAD_SECONDS = 0.2
const SEEK_FADE_SECONDS = 0.005

/** All lanes are scheduled against this one context and clock anchor. */
export class PairedAudioEngine {
  private readonly context: AudioContext
  private tracks: readonly PairedPlaybackTrack[] = []
  private sources = new Set<AudioBufferSourceNode>()
  private sourceTracks = new Map<AudioBufferSourceNode, string>()
  private sourceGains = new Map<AudioBufferSourceNode, GainNode>()
  private trackGainDb = new Map<string, number>()
  private bus: GainNode
  private range: ReviewRange
  private loop: ReviewRange | null = null
  private position: number
  private anchorContextTime = 0
  private anchorMixTime = 0
  private rate = 1
  private playing = false
  private nextLoopTime = Number.POSITIVE_INFINITY
  private timer: ReturnType<typeof setInterval> | null = null
  private listeners = new Set<() => void>()
  private disposed = false
  private disconnectTimers = new Set<ReturnType<typeof setTimeout>>()
  private analyses = new Map<
    string,
    {
      analyser: AnalyserNode
      loudness: LoudnessNode | null
      values: Float32Array | null
    }
  >()
  private analysisBus: GainNode
  private loudnessClass: typeof LoudnessNode | null = null
  private analysisInitialization: Promise<void> | null = null
  private loudnessEnabled = false

  constructor(context: AudioContext, range: ReviewRange) {
    if (
      !Number.isFinite(range.start) ||
      !Number.isFinite(range.end) ||
      range.start < 0 ||
      range.end <= range.start
    )
      throw new Error(
        'Paired playback requires a finite, non-empty active range.',
      )
    this.context = context
    this.range = range
    this.position = range.start
    this.bus = context.createGain()
    this.bus.connect(context.destination)
    this.analysisBus = context.createGain()
    this.analysisBus.gain.value = 0
    this.analysisBus.connect(context.destination)
  }

  get currentTime(): number {
    if (!this.playing) return this.position
    const elapsed =
      Math.max(0, this.context.currentTime - this.anchorContextTime) * this.rate
    const unwrapped = this.anchorMixTime + elapsed
    if (this.loop && unwrapped >= this.loop.end) {
      return (
        this.loop.start +
        ((unwrapped - this.loop.end) % (this.loop.end - this.loop.start))
      )
    }
    return clampReviewTime(unwrapped, this.range)
  }

  get state(): PairedPlaybackState {
    return { time: this.currentTime, playing: this.playing, rate: this.rate }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  initializeAnalysis(): Promise<void> {
    if (!this.analysisInitialization)
      this.analysisInitialization = this.loadAnalysis()
    return this.analysisInitialization
  }

  private async loadAnalysis(): Promise<void> {
    const module = await import('loudness-worklet')
    await this.context.audioWorklet.addModule(
      new URL(
        '../../../node_modules/loudness-worklet/packages/lib/dist/loudness.worklet.js',
        import.meta.url,
      ).href,
    )
    if (this.disposed) return
    this.loudnessClass = module.default
    for (const analysis of this.analyses.values()) {
      analysis.loudness = new module.default(this.context, { interval: 0.1 })
      analysis.values = new Float32Array(analysis.loudness.metricCount)
      if (this.loudnessEnabled) analysis.loudness.connect(this.analysisBus)
    }
  }

  getAnalyser(trackId: string): AnalyserNode | null {
    return this.analyses.get(trackId)?.analyser ?? null
  }

  setLoudnessEnabled(enabled: boolean): void {
    if (enabled === this.loudnessEnabled || this.disposed) return
    this.loudnessEnabled = enabled
    for (const analysis of this.analyses.values()) {
      if (!analysis.loudness) continue
      if (enabled) analysis.loudness.connect(this.analysisBus)
      else analysis.loudness.disconnect()
    }
    for (const [source, trackId] of this.sourceTracks) {
      const loudness = this.analyses.get(trackId)?.loudness
      if (!loudness) continue
      if (enabled) source.connect(loudness)
      else source.disconnect(loudness)
    }
  }

  getLoudness(trackId: string): LoudnessSnapshot | null {
    const analysis = this.analyses.get(trackId)
    if (!analysis?.loudness || !analysis.values || !this.loudnessClass)
      return null
    analysis.loudness.getFloatLoudnessData(analysis.values)
    const snapshot = this.loudnessClass.from(analysis.values)
    return snapshot.currentFrame > 0 ? snapshot : null
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }

  setTracks(tracks: readonly PairedPlaybackTrack[]): void {
    if (tracks.some((track) => !Number.isFinite(track.offsetSeconds)))
      throw new Error('Track alignment offsets must be finite seconds.')
    const time = this.currentTime
    this.tracks = tracks
    for (const track of tracks) {
      if (this.analyses.has(track.id)) continue
      const analyser = this.context.createAnalyser()
      analyser.fftSize = 8192
      analyser.minDecibels = -100
      analyser.maxDecibels = 0
      analyser.smoothingTimeConstant = 0.72
      analyser.connect(this.analysisBus)
      this.analyses.set(track.id, { analyser, loudness: null, values: null })
    }
    if (this.playing) this.restart(time)
  }

  setRate(rate: number): void {
    if (!Number.isFinite(rate) || rate < 0.5 || rate > 2)
      throw new Error('Playback speed must be between 0.5× and 2×.')
    const time = this.currentTime
    this.rate = rate
    if (this.playing) this.restart(time)
    this.emit()
  }

  setTrackGain(trackId: string, decibels: number): void {
    if (
      !Number.isFinite(decibels) ||
      Math.abs(decibels) > MAX_LISTENING_GAIN_DB
    )
      throw new Error(
        'Listening gain must be finite and within 40 dB of the source level.',
      )
    this.trackGainDb.set(trackId, decibels)
    const target = 10 ** (decibels / 20)
    const now = this.context.currentTime
    for (const [source, gain] of this.sourceGains) {
      if (this.sourceTracks.get(source) !== trackId) continue
      gain.gain.cancelScheduledValues(now)
      gain.gain.setTargetAtTime(target, now, 0.01)
    }
  }

  setLoop(range: ReviewRange | null): void {
    const time = this.currentTime
    const bounded =
      range && range.end > range.start
        ? {
            start: clampReviewTime(range.start, this.range),
            end: clampReviewTime(range.end, this.range),
          }
        : null
    this.loop = bounded && bounded.end > bounded.start ? bounded : null
    const start =
      this.loop && (time < this.loop.start || time >= this.loop.end)
        ? this.loop.start
        : time
    this.position = start
    if (this.playing) this.restart(start)
    this.emit()
  }

  seek(time: number): void {
    const bounded = clampReviewTime(time, this.range)
    if (this.loop && (bounded < this.loop.start || bounded >= this.loop.end))
      this.loop = null
    this.position = bounded
    if (this.playing) this.restart(bounded)
    this.emit()
  }

  async play(): Promise<void> {
    if (this.disposed)
      throw new Error('The paired playback engine has been disposed.')
    if (this.context.state === 'suspended') await this.context.resume()
    if (this.context.state !== 'running')
      throw new Error(
        'The browser suspended paired playback. Use Play again to resume audio.',
      )
    if (this.playing) return
    if (this.position >= this.range.end) this.position = this.range.start
    this.playing = true
    this.restart(this.position)
    this.timer = setInterval(() => {
      if (!this.loop && this.currentTime >= this.range.end) this.pause()
      while (
        this.loop &&
        this.nextLoopTime < this.context.currentTime + SCHEDULE_AHEAD_SECONDS
      ) {
        this.scheduleRange(this.loop.start, this.loop.end, this.nextLoopTime)
        this.nextLoopTime += (this.loop.end - this.loop.start) / this.rate
      }
      this.emit()
    }, 50)
    this.emit()
  }

  pause(): void {
    this.position = this.currentTime
    this.playing = false
    if (this.timer !== null) clearInterval(this.timer)
    this.timer = null
    this.stopScheduled()
    this.emit()
  }

  private stopScheduled(): void {
    const now = this.context.currentTime
    const oldBus = this.bus
    oldBus.gain.cancelScheduledValues(now)
    oldBus.gain.setValueAtTime(oldBus.gain.value, now)
    oldBus.gain.linearRampToValueAtTime(0, now + SEEK_FADE_SECONDS)
    for (const source of this.sources) source.stop(now + SEEK_FADE_SECONDS)
    this.sources.clear()
    this.sourceTracks.clear()
    this.sourceGains.clear()
    this.bus = this.context.createGain()
    this.bus.connect(this.context.destination)
    // Disconnect after the audio-thread fade. No signal gain is applied to source PCM.
    const timer = setTimeout(() => {
      oldBus.disconnect()
      this.disconnectTimers.delete(timer)
    }, 15)
    this.disconnectTimers.add(timer)
  }

  private restart(time: number): void {
    this.stopScheduled()
    this.anchorMixTime = time
    this.anchorContextTime = this.context.currentTime + 0.01
    const end = this.loop?.end ?? this.range.end
    this.scheduleRange(time, end, this.anchorContextTime)
    this.nextLoopTime = this.loop
      ? this.anchorContextTime + (end - time) / this.rate
      : Number.POSITIVE_INFINITY
  }

  private scheduleRange(start: number, end: number, when: number): void {
    for (const track of this.tracks) {
      const segment = planPairedSegment(
        track.buffer.duration,
        track.offsetSeconds,
        { start, end },
        when,
        this.rate,
      )
      if (!segment) continue
      const source = this.context.createBufferSource()
      source.buffer = track.buffer
      source.playbackRate.value = this.rate
      let playbackGain: GainNode | null = null
      if (!track.muted) {
        playbackGain = this.context.createGain()
        playbackGain.gain.value =
          10 ** ((this.trackGainDb.get(track.id) ?? 0) / 20)
        source.connect(playbackGain)
        playbackGain.connect(this.bus)
        this.sourceGains.set(source, playbackGain)
      }
      const analysis = this.analyses.get(track.id)
      if (analysis) {
        source.connect(analysis.analyser)
        if (analysis.loudness && this.loudnessEnabled)
          source.connect(analysis.loudness)
      }
      this.sources.add(source)
      this.sourceTracks.set(source, track.id)
      source.onended = () => {
        source.disconnect()
        this.sources.delete(source)
        this.sourceTracks.delete(source)
        this.sourceGains.delete(source)
        playbackGain?.disconnect()
      }
      source.start(
        segment.contextStart,
        segment.sourceStart,
        segment.sourceDuration,
      )
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.pause()
    this.disposed = true
    this.bus.disconnect()
    this.analysisBus.disconnect()
    for (const analysis of this.analyses.values()) {
      analysis.analyser.disconnect()
      analysis.loudness?.disconnect()
      analysis.loudness?.port.close()
    }
    this.analyses.clear()
    for (const gain of this.sourceGains.values()) gain.disconnect()
    this.sourceGains.clear()
    this.trackGainDb.clear()
    this.listeners.clear()
    for (const timer of this.disconnectTimers) clearTimeout(timer)
    this.disconnectTimers.clear()
    void this.context
      .close()
      .catch((error: unknown) =>
        console.error('Unable to close paired playback context.', error),
      )
  }
}
