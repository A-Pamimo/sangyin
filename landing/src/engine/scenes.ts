import type { SceneDef } from './types'

/**
 * The eight acts of the story, in order, mapped onto the master scroll
 * timeline. Ranges are normalized global progress [0, 1] and are the single
 * source of truth for pacing — nothing else in the engine hard-codes scene
 * boundaries.
 *
 * Acts are NOT tiled evenly: contemplative acts (the landscape descent, the
 * product fold, the audio bloom) get more scroll; the drying-transition is
 * shorter (it's tuning, not new geometry). Tune pacing here via WEIGHTS alone.
 *
 * NOTE: adjacent scenes are FUSED where they are one continuous physical event
 * (InkAct = intro+calligraphy; LandscapeAct = scroll+landscape) by spanning
 * both slices with a synthetic SceneDef. When you re-weight, re-derive any
 * hard-coded seam constants (e.g. InkAct's departure window) — they are tuned
 * to these boundaries and a re-weight moves them.
 */

/**
 * OVERLAP is a MOUNT WINDOW, not blend fuel. During the overlap both neighbors
 * are `visibility:visible` for the hand-off frames so the outgoing scene's
 * exit-transform and the incoming scene's entry-transform are BOTH live and the
 * camera pan is gap-free. There are NO cross-fades anywhere — scenes hand off
 * by camera travel only (see the no-fade rule in global.css / plan §1).
 */
const OVERLAP = 0.04

const ORDER: Array<Pick<SceneDef, 'id' | 'name'>> = [
  { id: 'intro', name: 'Intro — ink on empty paper' },
  { id: 'calligraphy', name: 'Calligraphy — the page paints itself' },
  { id: 'scroll', name: 'Scroll — travelling down the hanging scroll' },
  { id: 'landscape', name: 'Landscape — Shan Shui comes alive' },
  { id: 'transition', name: 'Transition — ancient becomes modern' },
  { id: 'product', name: 'Product — the app emerges from the art' },
  { id: 'audio', name: 'Audio — characters become sound' },
  { id: 'finale', name: 'Finale — the tool remains' },
]

/** Relative scroll length per act (see note above). Same order as ORDER. */
const WEIGHTS = [1, 1, 1, 2, 1.2, 2, 2, 1.2]

const TOTAL_WEIGHT = WEIGHTS.reduce((a, b) => a + b, 0)

export const SCENES: SceneDef[] = ORDER.map((scene, i) => {
  const start = WEIGHTS.slice(0, i).reduce((a, b) => a + b, 0) / TOTAL_WEIGHT
  const end = WEIGHTS.slice(0, i + 1).reduce((a, b) => a + b, 0) / TOTAL_WEIGHT
  return {
    ...scene,
    start: Math.max(0, start - (i === 0 ? 0 : OVERLAP)),
    end: Math.min(1, end + (i === ORDER.length - 1 ? 0 : OVERLAP)),
  }
})

/**
 * Total scroll length of the experience, in viewport heights. Longer = slower,
 * more cinematic travel per wheel notch. Lenis's glide (duration 1.15,
 * wheelMultiplier 0.9 in ScrollProvider) is tuned to this length — re-check the
 * feel if you change it, or the museum-pan becomes a slog.
 */
export const TOTAL_VH = ORDER.length * 150
