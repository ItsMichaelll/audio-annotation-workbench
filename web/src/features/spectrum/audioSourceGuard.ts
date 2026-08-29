/** Prevents duplicate MediaElementAudioSourceNode creation for one media element. */
export class AudioSourceGuard<TMedia extends object> {
  private readonly claimedMedia = new WeakSet<TMedia>()

  claim(media: TMedia): boolean {
    if (this.claimedMedia.has(media)) return false
    this.claimedMedia.add(media)
    return true
  }

  releaseFailedClaim(media: TMedia): void {
    this.claimedMedia.delete(media)
  }

  has(media: TMedia): boolean {
    return this.claimedMedia.has(media)
  }
}
