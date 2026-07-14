import { useRef, type ReactNode } from 'react'
import { useRafBinding } from '../engine/useRafBinding'
import { range } from '../engine/ease'
import { PORTALS, portalClip, portalZoom, liveWindow } from '../engine/portals'

/**
 * Wraps ONE scene and owns its entry/exit as a portal-zoom (match-cut):
 *   - entry: the scene is revealed THROUGH its shape (clip-path grows from a
 *     small shape at the anchor to fully cover).
 *   - exit: the scene flies INTO the next shape (scale up toward the anchor).
 *
 * All of it is written ref-direct off the master scroll (via useRafBinding), so
 * it is a pure function of progress — identical forward and backward, with no
 * visibility cut at the seam (both neighbours are live across it). This is what
 * replaces the old per-scene `visibility` handoff that popped/blanked.
 *
 * z-index ascends with index so an opening portal reveals the next scene ON TOP
 * of the one being zoomed into.
 */
const FULL = { start: 0, end: 1 }

export function PortalLayer({ index, children }: { index: number; children: ReactNode }) {
  const p = PORTALS[index]
  const ref = useRef<HTMLDivElement>(null)
  const [liveA, liveB] = liveWindow(p)

  useRafBinding(FULL, (g) => {
    const el = ref.current
    if (!el) return
    const live = g >= liveA && g <= liveB
    el.style.visibility = live ? 'visible' : 'hidden'
    if (!live) return

    el.style.clipPath = p.enter ? portalClip(p.enter, range(g, p.enter.a, p.enter.b)) : 'none'

    if (p.exit) {
      const z = portalZoom(p.exit, range(g, p.exit.a, p.exit.b))
      el.style.transform = `scale(${z.scale.toFixed(3)})`
      el.style.transformOrigin = z.origin
    } else {
      el.style.transform = 'none'
    }
  })

  return (
    <div
      className="portal-layer"
      ref={ref}
      style={{ zIndex: index, visibility: index === 0 ? 'visible' : 'hidden' }}
    >
      {children}
    </div>
  )
}
