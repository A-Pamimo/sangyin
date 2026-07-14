import { useEffect, useMemo, useRef } from 'react'
import { useScene } from '../engine/useScene'
import { useRafBinding } from '../engine/useRafBinding'
import { useScrollEngine } from '../engine/ScrollProvider'
import { SCENES } from '../engine/scenes'
import { range } from '../engine/ease'
import { sage } from '../theme/fernwood'
import { Scrubber } from '../components/Scrubber'
import { BAR_COUNT, BAR_COUNT_MOBILE, speechEnvelope } from './audio/waveform'
import {
  sampleGlyph,
  fallbackSeeds,
  makeParticles,
  drawParticles,
  type Particle,
} from './audio/glyphParticles'
import { drawRipples } from './audio/ripples'

/**
 * Scene 7 — the characters 桑吟 lift off the page, shatter into particles, flow,
 * and re-form as a speech waveform, which then settles into the reader's real
 * scrubber. Text becomes voice; the animation explains text-to-speech without
 * words.
 *
 * ONE <canvas> (hundreds of moving points = SVG's worst workload), sized to
 * DPR (capped 2), drawn imperatively OFF THE SCROLL PUB/SUB — never a second
 * requestAnimationFrame (that would fight GSAP's one clock). At the end the
 * canvas hides and the DOM <Scrubber> shows in the SAME frame at the SAME bar
 * geometry — a "become", not a cross-fade.
 */
const DEF = SCENES[6]

const isSmallViewport = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(max-width: 640px)').matches

export function AudioScene() {
  const { progress: t } = useScene(DEF)

  const small = useMemo(isSmallViewport, [])
  const N = small ? 260 : 600
  const barCount = small ? BAR_COUNT_MOBILE : BAR_COUNT
  const env = useMemo(() => speechEnvelope(barCount), [barCount])

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particles = useRef<Particle[]>([])
  const css = useRef({ w: 0, h: 0 })
  const { getFrame } = useScrollEngine()

  // Sample the glyph into particle seeds — but only AFTER the CJK font has
  // actually loaded, or the raster is tofu/empty and the end characters "don't
  // load". Explicitly load the face (not just fonts.ready), and keep the
  // fallback silhouette unless the sample returns a real glyph.
  useEffect(() => {
    particles.current = makeParticles(fallbackSeeds(N), N, barCount)
    let cancelled = false
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
    const loaded = fonts?.load
      ? fonts.load("600 240px 'Noto Serif SC'").then(() => fonts.ready)
      : Promise.resolve()
    loaded.then(() => {
      if (cancelled) return
      const seeds = sampleGlyph('桑吟', "'Noto Serif SC', serif", 1400)
      if (seeds.length > 40) particles.current = makeParticles(seeds, N, barCount)
    })
    return () => {
      cancelled = true
    }
  }, [N, barCount])

  // Size the canvas to its box × DPR (capped 2); redraw current frame on resize.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      css.current = { w, h }
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    size()
    window.addEventListener('resize', size)
    return () => window.removeEventListener('resize', size)
  }, [])

  const draw = (localT: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { w, h } = css.current
    // Clear to the warm modern paper so there's no seam against the DOM ground.
    ctx.fillStyle = sage.bg
    ctx.fillRect(0, 0, w, h)
    drawParticles(ctx, particles.current, w, h, localT, env, { ink: sage.text, accent: sage.accent })
    drawRipples(ctx, w / 2, h * 0.66, localT, sage.accent)
  }

  useRafBinding(DEF, (local, active) => {
    if (!active) return
    draw(local)
  })

  // Seed one draw when the scene mounts active (e.g. deep-link mid-scroll).
  useEffect(() => {
    const f = getFrame()
    const span = DEF.end - DEF.start || 1
    const local = (f.progress - DEF.start) / span
    if (local >= 0 && local <= 1) draw(local)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The BECOME: past 0.9 the canvas hides and the DOM scrubber takes the frame.
  const settled = t >= 0.9
  const playhead = range(t, 0.9, 1) * 0.32 + 0.12

  return (
    <section
      className="scene scene--audio"
      aria-label="The characters 桑吟 lift off the page and become a spoken waveform — the reader reads aloud"
    >
      <canvas
        ref={canvasRef}
        className="audio__canvas"
        style={{ visibility: settled ? 'hidden' : 'visible' }}
        aria-hidden
      />
      <div
        className="audio__scrubber"
        style={{ visibility: settled ? 'visible' : 'hidden' }}
      >
        <Scrubber progress={playhead} small={small} />
      </div>
    </section>
  )
}
