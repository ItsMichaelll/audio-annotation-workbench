import type {
  AmplitudeScale,
  FollowMode,
  NavigationPreset,
} from './waveformDisplay'
import styles from './WaveformViewControls.module.css'

export function WaveformViewControls(props: {
  amplitude: AmplitudeScale
  follow: FollowMode
  split: boolean
  gap: boolean
  guides: boolean
  navigationPreset: NavigationPreset
  nudgeRegions: boolean
  onAmplitude(value: AmplitudeScale): void
  onFollow(value: FollowMode): void
  onSplit(value: boolean): void
  onGap(value: boolean): void
  onGuides(value: boolean): void
  onNavigationPreset(value: NavigationPreset): void
  onNudgeRegions(value: boolean): void
}) {
  return (
    <details className={styles.root}>
      <summary>Waveform view</summary>
      <div className={styles.options}>
        <label>
          Navigation{' '}
          <select
            value={props.navigationPreset}
            onChange={(event) =>
              props.onNavigationPreset(
                event.target.value === 'trackpad' ? 'trackpad' : 'aaw',
              )
            }
          >
            <option value="aaw">AAW · wheel zoom</option>
            <option value="trackpad">Trackpad · wheel pan</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={props.nudgeRegions}
            onChange={(event) => props.onNudgeRegions(event.target.checked)}
          />{' '}
          Shift-wheel moves selected region
        </label>
        <label>
          Amplitude{' '}
          <select
            value={props.amplitude}
            onChange={(event) =>
              props.onAmplitude(
                event.target.value === 'linear' ? 'linear' : 'logarithmic',
              )
            }
          >
            <option value="linear">Linear</option>
            <option value="logarithmic">Logarithmic</option>
          </select>
        </label>
        <label>
          Follow{' '}
          <select
            value={props.follow}
            onChange={(event) => {
              const value = event.target.value
              if (value === 'off' || value === 'page' || value === 'center')
                props.onFollow(value)
            }}
          >
            <option value="off">Off</option>
            <option value="page">Page</option>
            <option value="center">Center</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={props.split}
            onChange={(event) => props.onSplit(event.target.checked)}
          />{' '}
          Split stereo channels
        </label>
        <label>
          <input
            type="checkbox"
            checked={props.gap}
            onChange={(event) => props.onGap(event.target.checked)}
          />{' '}
          Gap ruler
        </label>
        <label>
          <input
            type="checkbox"
            checked={props.guides}
            onChange={(event) => props.onGuides(event.target.checked)}
          />{' '}
          Boundary guides (±100 ms)
        </label>
      </div>
    </details>
  )
}
