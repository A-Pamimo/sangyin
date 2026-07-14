import { lerp } from '../../engine/ease'

/**
 * The Shan Shui world, authored as control-point arrays in a tall 2400×3600
 * world space. Everything is an OPEN stroke in `var(--ink)` — the same brush
 * language as the calligraphy — so the landscape reads as the name's ink,
 * pulled downward and run into mountains, water, and mist.
 *
 * Every stroke carries a WET (hand-wobbled) and a DRY (smoothed) twin with the
 * SAME point count. M4 renders WET; M5 lerps WET→DRY on the identical points so
 * the ancient→modern drying is one continuous morph, never a swap.
 */

export type Pt = readonly [number, number]

export const WORLD_W = 2400
export const WORLD_H = 3600

/** Catmull-Rom → cubic Bézier through the points (a smooth brush ridge). */
export function buildPath(pts: readonly Pt[]): string {
  if (pts.length < 2) return ''
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  return d
}

/** Same-length neighbour-average smoothing → the DRY twin from a WET stroke. */
function smooth(pts: Pt[], amount = 0.75): Pt[] {
  return pts.map((p, i) => {
    const prev = pts[i - 1] ?? p
    const next = pts[i + 1] ?? p
    const sx = (prev[0] + p[0] + next[0]) / 3
    const sy = (prev[1] + p[1] + next[1]) / 3
    return [lerp(p[0], sx, amount), lerp(p[1], sy, amount)] as Pt
  })
}

/** Per-point lerp between two equal-length strokes (the M5 dry-down). */
export function lerpPoints(a: readonly Pt[], b: readonly Pt[], t: number): Pt[] {
  return a.map((p, i) => [lerp(p[0], b[i][0], t), lerp(p[1], b[i][1], t)] as Pt)
}

export interface Ridge {
  wet: Pt[]
  dry: Pt[]
  /** 'far' | 'mid' — which parallax layer. */
  layer: 'far' | 'mid'
  width: number
  opacity: number
}

function ridge(wet: Pt[], layer: 'far' | 'mid', width: number, opacity: number): Ridge {
  return { wet, dry: smooth(wet), layer, width, opacity }
}

/**
 * RUNNELS — the ink of the written name, pulled downward. A few wandering
 * vertical strokes near the top-centre that "run" down and hand off into the
 * far ridge line. These self-paint (stroke-dasharray) so the scroll literally
 * unrolls them like a 掛軸.
 */
export const RUNNELS: Ridge[] = [
  ridge(
    [[1150, 40], [1132, 260], [1160, 520], [1120, 760], [1150, 980], [1180, 1180]],
    'mid', 8, 0.9,
  ),
  ridge(
    [[1250, 20], [1276, 300], [1244, 560], [1288, 820], [1256, 1040], [1230, 1200]],
    'mid', 6, 0.8,
  ),
  ridge(
    [[1200, 60], [1210, 340], [1190, 620], [1216, 900], [1198, 1120]],
    'mid', 5, 0.66,
  ),
]

/** Far mountains — distant ridge lines, revealed by the descent. */
export const FAR_RIDGES: Ridge[] = [
  ridge(
    [[-40, 1180], [360, 1010], [720, 1120], [1080, 940], [1180, 1010], [1520, 900], [1900, 1080], [2440, 980]],
    'far', 4, 0.55,
  ),
  ridge(
    [[-40, 1440], [420, 1300], [900, 1420], [1200, 1250], [1560, 1400], [2040, 1280], [2440, 1420]],
    'far', 3.5, 0.42,
  ),
]

/** Mid ridges — nearer hills, heavier ink. */
export const MID_RIDGES: Ridge[] = [
  ridge(
    [[-40, 2180], [380, 1980], [780, 2120], [1180, 1900], [1560, 2100], [2000, 1940], [2440, 2160]],
    'mid', 7, 0.82,
  ),
  ridge(
    [[-40, 2460], [520, 2320], [1040, 2460], [1500, 2300], [2000, 2440], [2440, 2360]],
    'mid', 5.5, 0.62,
  ),
]

/** Distant filled masses (no filter) — soft mist-blue silhouettes behind the ink. */
export const MASSES: { d: string; opacity: number }[] = [
  { d: 'M -40 1520 L 520 1180 L 980 1520 Z', opacity: 0.12 },
  { d: 'M 760 1520 L 1300 1120 L 1840 1520 Z', opacity: 0.1 },
  { d: 'M 1560 1520 L 2060 1240 L 2460 1520 Z', opacity: 0.11 },
]

/** Water — low-frequency wavy lines at the valley floor; drift horizontally. */
export const WATER: { d: string; dur: number }[] = [
  { d: 'M -80 2760 q 600 -46 1200 0 q 600 46 1240 0', dur: 15 },
  { d: 'M -80 2850 q 560 -38 1160 0 q 600 38 1280 0', dur: 18 },
  { d: 'M -80 2940 q 640 -30 1220 0 q 560 30 1280 0', dur: 21 },
]

/** Mist — long low-amplitude quadratics; drift slowly. OUTSIDE the wet filter. */
export const MIST: { d: string; dur: number; y: number }[] = [
  { d: 'M -120 1600 q 620 -60 1220 0 q 580 60 1180 0', dur: 28, y: 0 },
  { d: 'M -120 1820 q 600 -48 1180 0 q 600 48 1220 0', dur: 34, y: 0 },
  { d: 'M -120 2520 q 640 -40 1240 0 q 560 40 1200 0', dur: 40, y: 0 },
]

/** Birds — sparse ink marks that glide across (CSS). world x/y are start points. */
export const BIRDS: { x: number; y: number; dur: number; delay: number; scale: number }[] = [
  { x: 480, y: 1560, dur: 26, delay: 0, scale: 1 },
  { x: 900, y: 1460, dur: 30, delay: 6, scale: 0.8 },
  { x: 1500, y: 1620, dur: 34, delay: 12, scale: 0.9 },
]

/** Leaves — near-layer falling marks (CSS). */
export const LEAVES: { x: number; dur: number; delay: number; scale: number }[] = [
  { x: 320, dur: 17, delay: 0, scale: 1 },
  { x: 760, dur: 21, delay: 3, scale: 0.8 },
  { x: 1180, dur: 19, delay: 7, scale: 1.1 },
  { x: 1640, dur: 23, delay: 2, scale: 0.9 },
  { x: 2020, dur: 18, delay: 9, scale: 1 },
  { x: 2260, dur: 25, delay: 5, scale: 0.7 },
]
