import { Icon } from './Icon'
import type { TransportBarProps } from './TransportBar'
import styles from './TransportBar.module.css'

export function WaveformZoomControls(
  props: Pick<
    TransportBarProps,
    | 'isLoaded'
    | 'verticalScale'
    | 'onFit'
    | 'onZoomIn'
    | 'onZoomOut'
    | 'onResetVerticalScale'
  >,
) {
  return (
    <div className={styles.zoom} role="group" aria-label="Waveform zoom">
      <button
        type="button"
        className={styles.iconButton}
        onClick={props.onZoomOut}
        disabled={!props.isLoaded}
        aria-label="Zoom out"
        title="Zoom out (-)"
      >
        <Icon name="minus" />
      </button>
      <button
        type="button"
        className={styles.iconButton}
        onClick={props.onZoomIn}
        disabled={!props.isLoaded}
        aria-label="Zoom in"
        title="Zoom in (+)"
      >
        <Icon name="plus" />
      </button>
      <button
        type="button"
        className={styles.control}
        onClick={props.onFit}
        disabled={!props.isLoaded}
        title="Fit complete file (F)"
      >
        <Icon name="fit" />
        Fit
      </button>
      <button
        type="button"
        className={styles.control}
        onClick={props.onResetVerticalScale}
        disabled={!props.isLoaded || Math.abs(props.verticalScale - 1) < 0.001}
        title="Reset waveform amplitude to 1×"
      >
        <span className={styles.scale}>
          ↕ {props.verticalScale.toFixed(2)}×
        </span>
      </button>
    </div>
  )
}
