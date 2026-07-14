import { clamp01, lerp, range, easeInOut } from '../../engine/ease'

/**
 * The glyph-particle sim for the audio scene. The characters 桑吟 ARE the
 * particles from the first frame (dense sampling reads as the solid glyph), so
 * they dissolve into dots and re-form as a waveform WITHOUT any cross-fade
 * between a text layer and a particle layer.
 *
 * Everything is a pure function of local progress t; the caller draws it off
 * the scroll pub/sub (one clock — no requestAnimationFrame here).
 */

export type Pt = [number, number]

export interface Particle {
  sx: number // glyph seed, normalized [-0.5, 0.5]
  sy: number
  jx: number // stable dispersion jitter [-1, 1]
  jy: number
  bar: number
  slot: number // vertical slot within its bar [0, 1]
}

const hash = (n: number): number => {
  const s = Math.sin(n * 127.1) * 43758.5453
  return s - Math.floor(s)
}

/** Sample the opaque pixels of `text` into normalized seed points. */
export function sampleGlyph(text: string, fontStack: string, count: number): Pt[] {
  const S = 240
  const c = document.createElement('canvas')
  c.width = S * 2
  c.height = S
  const g = c.getContext('2d')
  if (!g) return []
  g.fillStyle = '#000'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = `600 ${Math.round(S * 0.72)}px ${fontStack}`
  g.fillText(text, c.width / 2, c.height / 2)

  const { data } = g.getImageData(0, 0, c.width, c.height)
  const pts: Pt[] = []
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9
  const stride = 2
  for (let y = 0; y < c.height; y += stride) {
    for (let x = 0; x < c.width; x += stride) {
      if (data[(y * c.width + x) * 4 + 3] > 128) {
        pts.push([x, y])
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (!pts.length) return []
  const scale = Math.max(maxX - minX, maxY - minY) || 1
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const norm: Pt[] = pts.map(([x, y]) => [(x - cx) / scale, (y - cy) / scale])
  if (norm.length <= count) return norm
  const step = norm.length / count
  const out: Pt[] = []
  for (let i = 0; i < count; i++) out.push(norm[Math.floor(i * step)])
  return out
}

/** Fallback seeds (a rough two-block glyph silhouette) if sampling isn't ready. */
export function fallbackSeeds(count: number): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < count; i++) {
    const half = i % 2 === 0 ? -0.26 : 0.26
    out.push([half + (hash(i) - 0.5) * 0.34, (hash(i * 3 + 1) - 0.5) * 0.7])
  }
  return out
}

export function makeParticles(seeds: Pt[], n: number, barCount: number): Particle[] {
  const perBar = Math.ceil(n / barCount)
  const out: Particle[] = []
  for (let i = 0; i < n; i++) {
    const s = seeds.length ? seeds[i % seeds.length] : [0, 0]
    out.push({
      sx: s[0],
      sy: s[1],
      jx: hash(i) * 2 - 1,
      jy: hash(i * 7 + 3) * 2 - 1,
      bar: i % barCount,
      slot: Math.floor(i / barCount) / perBar,
    })
  }
  return out
}

// Pre-baked radial glow sprite (drawImage per bar — never per-particle shadowBlur).
let glowSprite: HTMLCanvasElement | null = null
function glow(accent: string): HTMLCanvasElement {
  if (glowSprite) return glowSprite
  const s = 64
  const c = document.createElement('canvas')
  c.width = c.height = s
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  grad.addColorStop(0, accent)
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.globalAlpha = 0.5
  g.fillRect(0, 0, s, s)
  glowSprite = c
  return c
}

export interface DrawColors {
  ink: string
  accent: string
}

/**
 * Draw one frame. The 5 states (lift → shatter → flow → wave → settle) are all
 * derived from t; the wave heights come from the shared speech `env` so the
 * bars land exactly where the DOM <Scrubber> will pick them up.
 */
export function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  W: number,
  H: number,
  t: number,
  env: number[],
  colors: DrawColors,
): void {
  const glyphScale = Math.min(W, H) * 0.5
  const cx = W / 2
  const cy = H * 0.4
  const trackW = Math.min(W * 0.82, 900)
  const x0 = cx - trackW / 2
  const bw = trackW / env.length
  const by = H * 0.66
  const maxBarH = H * 0.24

  const lift = easeInOut(range(t, 0, 0.18))
  const sh = easeInOut(range(t, 0.18, 0.42))
  const fw = easeInOut(range(t, 0.42, 0.86))
  const waved = fw > 0.6

  ctx.fillStyle = waved ? colors.accent : colors.ink

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i]
    const seedX = cx + p.sx * glyphScale
    const seedY = cy + p.sy * glyphScale
    const liftY = seedY - glyphScale * 0.12 * lift

    const shatterX = seedX + p.jx * glyphScale * 1.4
    const shatterY = liftY + p.jy * glyphScale * 1.0 - glyphScale * 0.2

    const px = lerp(seedX, shatterX, sh)
    const py = lerp(seedY - glyphScale * 0.12 * lift, shatterY, sh)

    const amp = env[p.bar]
    const barX = x0 + (p.bar + 0.5) * bw
    const waveY = by - p.slot * amp * maxBarH

    const x = lerp(px, barX, fw)
    const y = lerp(py, waveY, fw)
    const r = 1.5 + amp * fw * 1.4

    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // Per-bar glow once the wave forms (cheap: env.length drawImage calls).
  if (waved) {
    const sprite = glow(colors.accent)
    ctx.globalAlpha = clamp01((fw - 0.6) / 0.4) * 0.6
    for (let b = 0; b < env.length; b++) {
      const amp = env[b]
      const barX = x0 + (b + 0.5) * bw
      const gy = by - amp * maxBarH * 0.5
      const gs = 10 + amp * 26
      ctx.drawImage(sprite, barX - gs / 2, gy - gs / 2, gs, gs)
    }
    ctx.globalAlpha = 1
  }
}
