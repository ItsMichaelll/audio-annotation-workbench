interface TransportBarProps {
  isLoaded: boolean
  isPlaying: boolean
  loopEnabled: boolean
  spectrogramEnabled: boolean
  spectrumEnabled: boolean
  hasSelection: boolean
  verticalScale: number
  onPlayPause(): void
  onFit(): void
  onZoomIn(): void
  onZoomOut(): void
  onResetVerticalScale(): void
  onToggleLoop(): void
  onDelete(): void
  onToggleSpectrogram(): void
  onToggleSpectrum(): void
}

export function TransportBar({
  isLoaded,
  isPlaying,
  loopEnabled,
  spectrogramEnabled,
  spectrumEnabled,
  hasSelection,
  verticalScale,
  onPlayPause,
  onFit,
  onZoomIn,
  onZoomOut,
  onResetVerticalScale,
  onToggleLoop,
  onDelete,
  onToggleSpectrogram,
  onToggleSpectrum,
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
        Reset V-Scale
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
      <span className="transport__divider" aria-hidden="true" />
      <button
        type="button"
        className={`transport__view-toggle${spectrogramEnabled ? ' is-active' : ''}`}
        aria-pressed={spectrogramEnabled}
        onClick={onToggleSpectrogram}
        disabled={!isLoaded}
        title="Show or hide the spectrogram"
      >
        Spectrogram
      </button>
      <button
        type="button"
        className={`transport__view-toggle${spectrumEnabled ? ' is-active' : ''}`}
        aria-pressed={spectrumEnabled}
        onClick={onToggleSpectrum}
        disabled={!isLoaded}
        title="Show or hide the spectrum analyzer"
      >
        Spectrum Analyzer
      </button>
    </nav>
  )
}
