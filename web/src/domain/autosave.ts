export class AutosaveRevisionGate {
  private latest = 0

  issue(): number {
    this.latest += 1
    return this.latest
  }

  isCurrent(token: number): boolean {
    return token === this.latest
  }
}
