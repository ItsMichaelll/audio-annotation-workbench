interface TransportBarProps {
  isLoaded: boolean
  isPlaying: boolean
  loopEnabled: boolean
  hasSelection: boolean
  canUndo: boolean
  canRedo: boolean
  verticalScale: number
  onPlayPause(): void
  onFit(): void
  onZoomIn(): void
  onZoomOut(): void
  onResetVerticalScale(): void
  onToggleLoop(): void
  onDelete(): void
  onUndo(): void
  onRedo(): void
}

export function TransportBar({
  isLoaded,
  isPlaying,
  loopEnabled,
  hasSelection,
  canUndo,
  canRedo,
  verticalScale,
  onPlayPause,
  onFit,
  onZoomIn,
  onZoomOut,
  onResetVerticalScale,
  onToggleLoop,
  onDelete,
  onUndo,
  onRedo,
}: TransportBarProps) {
  return (
    <nav className="transport" aria-label="Transport and editing controls">
      <button
        className="transport__primary"
        type="button"
        onClick={onPlayPause}
        disabled={!isLoaded}
        title="Play or pause (Space)"
      >
        <span aria-hidden="true">{isPlaying ? 'Ⅱ' : '▶'}</span>
        {isPlaying ? 'Pause' : 'Play'}
      </button>
      <span className="transport__divider" aria-hidden="true" />
      <button
        type="button"
        onClick={onFit}
        disabled={!isLoaded}
        title="Fit (F)"
      >
        Fit
      </button>
      <button
        type="button"
        onClick={onZoomOut}
        disabled={!isLoaded}
        aria-label="Zoom out"
        title="Zoom out (-)"
      >
        −
      </button>
      <button
        type="button"
        onClick={onZoomIn}
        disabled={!isLoaded}
        aria-label="Zoom in"
        title="Zoom in (+)"
      >
        +
      </button>
      <button
        type="button"
        onClick={onResetVerticalScale}
        disabled={!isLoaded || Math.abs(verticalScale - 1) < 0.001}
        title="Reset vertical scale to 1×"
      >
        V Reset
      </button>
      <span className="transport__divider" aria-hidden="true" />
      <button
        type="button"
        className={loopEnabled ? 'is-active' : undefined}
        aria-pressed={loopEnabled}
        onClick={onToggleLoop}
        disabled={!hasSelection}
        title="Loop selected region (L)"
      >
        Loop
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={!hasSelection}
        title="Delete selected region (Delete, Backspace, or Ctrl+D)"
      >
        Delete
      </button>
      <span className="transport__spacer" />
      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
      >
        Undo
      </button>
      <button
        type="button"
        onClick={onRedo}
        disabled={!canRedo}
        title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
      >
        Redo
      </button>
    </nav>
  )
}
