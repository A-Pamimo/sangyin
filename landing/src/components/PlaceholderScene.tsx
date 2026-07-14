import { useScene } from '../engine/useScene'
import type { SceneProps } from '../engine/types'

/**
 * Stand-in for a not-yet-built scene (Milestones 4–8).
 *
 * Transitions by CAMERA TRAVEL, not opacity: the scene rises from the bottom of
 * frame, passes through centre when it's its turn, and continues up out of the
 * top as the next one rises — a continuous downward pan through a stacked world.
 * No cross-fades. (Each of these gets replaced by a real scene with its own
 * physical metamorphosis in its milestone; this just proves the seam behaviour.)
 */
export function PlaceholderScene({ def, index }: SceneProps) {
  const { active, progress } = useScene(def)

  // progress 0 → 1 maps to travelling from below centre to above it.
  const y = (0.5 - progress) * 120 // vh
  const scale = 0.9 + progress * 0.2

  return (
    <section
      className="scene scene--placeholder"
      aria-hidden={!active}
      style={{
        transform: `translate3d(0, ${y}vh, 0) scale(${scale})`,
        visibility: active ? 'visible' : 'hidden',
      }}
    >
      <div className="scene__index">{String(index + 1).padStart(2, '0')}</div>
      <h2 className="scene__title">{def.name}</h2>
      <div className="scene__meta">
        <span>local</span>
        <div className="scene__bar">
          <div className="scene__bar-fill" style={{ width: `${progress * 100}%` }} />
        </div>
        <span className="mono">{(progress * 100).toFixed(0)}%</span>
      </div>
      <p className="scene__note">placeholder · travels by camera · art arrives in a later milestone</p>
    </section>
  )
}
