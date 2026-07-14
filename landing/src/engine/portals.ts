import { clamp01, lerp, easeInOut } from './ease'

/**
 * The portal-zoom (match-cut) transition chain. The journey is one continuous
 * world: the camera zooms INTO a shape that belongs to scene N, and that
 * shape's interior IS scene N+1. Because every value here is a pure function of
 * scroll progress, the transitions are perfectly reversible — which is what
 * replaces the old visibility-toggle handoffs that popped/blanked (and broke
 * scrolling back up).
 *
 * Shape chain (user-confirmed):
 *   drop ◯ → 桑吟 → 吟's counter ◗ → valley ⩗ → window ▢ → waveform → seal ▣ → finale
 */

export type PortalShape = 'circle' | 'rrect' | 'square'

export interface Seam {
  /** Global-progress window of the zoom. */
  a: number
  b: number
  /** Where the shape sits on screen (%). The match-cut anchor. */
  cx: number
  cy: number
  shape: PortalShape
  /** Apparent size of the shape at the moment the portal opens (% radius/half). */
  r0: number
}

export interface LayerPortals {
  /** The portal this scene is revealed THROUGH (absent on the first scene). */
  enter?: Seam
  /** The portal this scene is zoomed INTO toward the next (absent on the last). */
  exit?: Seam
}

// One shared Seam per boundary — the exit of scene N is the enter of scene N+1,
// so both are centred on the same point and the cut lands exactly.
const A: Seam = { a: 0.15, b: 0.215, cx: 57, cy: 45, shape: 'circle', r0: 6 } // 吟's counter
const B: Seam = { a: 0.5, b: 0.585, cx: 50, cy: 50, shape: 'rrect', r0: 8 } // valley → window
const C: Seam = { a: 0.69, b: 0.755, cx: 50, cy: 45, shape: 'rrect', r0: 10 } // window → waveform
const D: Seam = { a: 0.86, b: 0.93, cx: 50, cy: 55, shape: 'square', r0: 8 } // waveform → seal

/** One entry per rendered scene layer, in DOM/z order. */
export const PORTALS: LayerPortals[] = [
  { exit: A }, // 0 InkAct
  { enter: A, exit: B }, // 1 LandscapeAct (held through the drying transition)
  { enter: B, exit: C }, // 2 ProductScene
  { enter: C, exit: D }, // 3 AudioScene
  { enter: D }, // 4 Finale
]

/** How much a scene scales as the camera flies into its exit shape. */
export const PORTAL_SCALE = 5
/** Margin (global progress) a layer stays mounted beyond its portals. */
export const PORTAL_PAD = 0.02

/** The clip-path that reveals a scene THROUGH its entry shape as e: 0 → 1. */
export function portalClip(seam: Seam, e: number): string {
  const t = easeInOut(clamp01(e))
  if (seam.shape === 'circle') {
    const R = lerp(seam.r0, 175, t)
    return `circle(${R.toFixed(1)}% at ${seam.cx}% ${seam.cy}%)`
  }
  // rrect / square: a rectangle centred at (cx,cy) whose half-size grows to cover.
  const half = lerp(seam.r0, 150, t)
  const ar = seam.shape === 'rrect' ? 1.5 : 1
  const top = (seam.cy - half).toFixed(1)
  const bottom = (100 - seam.cy - half).toFixed(1)
  const left = (seam.cx - half * ar).toFixed(1)
  const right = (100 - seam.cx - half * ar).toFixed(1)
  const round = seam.shape === 'rrect' ? '20px' : '6px'
  return `inset(${top}% ${right}% ${bottom}% ${left}% round ${round})`
}

/** The scale + origin as a scene flies INTO its exit shape as e: 0 → 1. */
export function portalZoom(seam: Seam, e: number): { scale: number; origin: string } {
  const s = 1 + easeInOut(clamp01(e)) * (PORTAL_SCALE - 1)
  return { scale: s, origin: `${seam.cx}% ${seam.cy}%` }
}

/**
 * The mounted/visible window for a layer, in global progress. The scene appears
 * exactly when its entry portal opens (the previous scene covers the frame until
 * then) and stays a hair past its exit so it's fully covered before it hides —
 * so there is never a gap or a hard cut at a seam.
 */
export function liveWindow(p: LayerPortals): [number, number] {
  return [p.enter ? p.enter.a : 0, p.exit ? p.exit.b + PORTAL_PAD : 1.001]
}
