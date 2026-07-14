import { range } from '../../engine/ease'

/**
 * The "voice emits" cue — concentric rings radiating from the waveform, ported
 * from the root HTML's ripple technique but reframed as sound leaving the page.
 * Drawn on the same canvas, purely as a function of local progress t.
 */
const RINGS = 4

export function drawRipples(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  t: number,
  accent: string,
): void {
  const emit = range(t, 0.66, 1) // rings ride the WAVE→SETTLE states
  if (emit <= 0) return
  const maxR = Math.min(ctx.canvas.width, ctx.canvas.height) * 0.55

  ctx.save()
  ctx.strokeStyle = accent
  ctx.lineWidth = 2
  for (let i = 0; i < RINGS; i++) {
    // each ring is staggered and loops as emit advances
    const phase = (emit * 1.6 + i / RINGS) % 1
    const r = 24 + phase * maxR
    const alpha = (1 - phase) * 0.35 * emit
    if (alpha <= 0.01) continue
    ctx.globalAlpha = alpha
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}
