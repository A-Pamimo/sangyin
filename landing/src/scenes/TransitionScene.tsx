import { useScene } from '../engine/useScene'
import { SCENES } from '../engine/scenes'
import { range, easeInOut } from '../engine/ease'

/**
 * Scene 5 — "time passes". The heavy lifting of ancient→modern is done by the
 * two global dials (the wetness dial dries the still-visible landscape; --age
 * brightens the paper), so this scene stays deliberately restrained: a single
 * clean modern rule DRAWS across the centre and, riding its leading edge, a
 * short line of type is written into being (a clip-reveal by the drawing line —
 * a physical write, not a cross-fade). It marks the turn from brush to
 * typography without cluttering the drying world behind it.
 *
 * Light enough to drive declaratively from useScene (few nodes, cheap).
 */
const DEF = SCENES[4]

export function TransitionScene() {
  const { progress: t, phase } = useScene(DEF)
  const hidden = phase !== 'active'

  // The rule draws across the middle third of the scene…
  const draw = easeInOut(range(t, 0.15, 0.62))
  // …and the line of type is revealed left-to-right by the rule's leading edge.
  const reveal = range(t, 0.2, 0.68)

  return (
    <section
      className="scene scene--transition"
      aria-label="Time passes — the brushed world resolves toward modern type"
      style={{ visibility: hidden ? 'hidden' : 'visible' }}
    >
      <div className="transition__beat">
        <div
          className="transition__line"
          style={{ transform: `scaleX(${draw})` }}
          aria-hidden
        />
        <div
          className="transition__label"
          style={{ clipPath: `inset(0 ${((1 - reveal) * 100).toFixed(1)}% 0 0)` }}
        >
          A thousand years, one page
        </div>
      </div>
    </section>
  )
}
