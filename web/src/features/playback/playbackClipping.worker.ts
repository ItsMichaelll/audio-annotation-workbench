import { playbackClippingRanges } from '../../domain/listeningNormalization'

self.onmessage = (
  event: MessageEvent<{
    channels: Float32Array[]
    sampleRate: number
    gainDb: number
  }>,
) => {
  const { channels, sampleRate, gainDb } = event.data
  self.postMessage(playbackClippingRanges(channels, sampleRate, gainDb))
}
