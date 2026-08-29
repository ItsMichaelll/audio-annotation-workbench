export interface HistoryState<T> {
  present: T
  canUndo: boolean
  canRedo: boolean
}

export class SnapshotHistory<T> {
  private past: T[] = []
  private present: T
  private future: T[] = []

  constructor(
    initialValue: T,
    private readonly equals: (left: T, right: T) => boolean = Object.is,
  ) {
    this.present = initialValue
  }

  get state(): HistoryState<T> {
    return {
      present: this.present,
      canUndo: this.past.length > 0,
      canRedo: this.future.length > 0,
    }
  }

  commit(nextValue: T): HistoryState<T> {
    if (!this.equals(this.present, nextValue)) {
      this.past.push(this.present)
      this.present = nextValue
      this.future = []
    }

    return this.state
  }

  undo(): HistoryState<T> {
    const previous = this.past.pop()
    if (previous !== undefined) {
      this.future.unshift(this.present)
      this.present = previous
    }

    return this.state
  }

  redo(): HistoryState<T> {
    const next = this.future.shift()
    if (next !== undefined) {
      this.past.push(this.present)
      this.present = next
    }

    return this.state
  }

  reset(nextValue: T): HistoryState<T> {
    this.past = []
    this.present = nextValue
    this.future = []
    return this.state
  }
}
