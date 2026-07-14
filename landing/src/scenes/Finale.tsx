import { useScene } from '../engine/useScene'
import { SCENES } from '../engine/scenes'
import { range, easeInOut } from '../engine/ease'
import { sage, fonts } from '../theme/fernwood'
import { Scrubber } from '../components/Scrubber'

/**
 * Scene 8 — the tool remains. Everything artistic has receded; only the calm
 * real app is left. The 桑吟 logo re-inks (a write-on, not a fade), the shared
 * <Scrubber> settles, and ONE real CTA — "Open the reader" — links to the app.
 * The contrast with the journey makes the product feel effortless.
 *
 * Fully usable with zero animation (the reduced-motion path renders StaticFrame
 * instead; this scene's entrance is only a light settle on top of a legible,
 * focusable frame).
 */
const DEF = SCENES[7]

export function Finale() {
  const { progress: t, phase } = useScene(DEF)
  const hidden = phase !== 'active'

  const logo = range(t, 0.05, 0.5) // logo writes on
  const rise = easeInOut(range(t, 0.3, 0.8)) // pin/scrubber/cta settle up

  return (
    <section
      className="scene scene--finale"
      aria-label="Sangyin — open the reader"
      style={{ visibility: hidden ? 'hidden' : 'visible', color: sage.text }}
    >
      <div
        className="finale__logo"
        style={{ clipPath: `inset(0 ${((1 - logo) * 100).toFixed(1)}% 0 0)` }}
      >
        桑吟
      </div>
      <div
        className="finale__pin"
        style={{ color: sage.textDim, transform: `translateY(${((1 - rise) * 18).toFixed(1)}px)` }}
      >
        Sāng&nbsp;&nbsp;Yín
      </div>

      <div style={{ transform: `translateY(${((1 - rise) * 26).toFixed(1)}px)`, width: '100%', display: 'flex', justifyContent: 'center' }}>
        <Scrubber progress={0.34} />
      </div>

      <a
        className="finale__cta"
        href="/sangyin"
        style={{
          transform: `translateY(${((1 - rise) * 32).toFixed(1)}px)`,
          background: sage.accent,
          color: sage.onAccent,
          fontFamily: fonts.body,
          boxShadow: '0 14px 30px -14px rgba(65,74,50,0.7)',
        }}
      >
        Open the reader
      </a>
      <p className="finale__foot" style={{ color: sage.textDim }}>
        Begin where you left off.
      </p>
    </section>
  )
}
