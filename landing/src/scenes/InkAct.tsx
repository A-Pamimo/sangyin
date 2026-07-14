import { useRef } from 'react'
import { useScene } from '../engine/useScene'
import { SCENES } from '../engine/scenes'
import { clamp01, easeOutCubic, easeInOut } from '../engine/ease'
import { useWetnessFilter } from '../engine/useWetnessFilter'
import type { SceneDef } from '../engine/types'

/**
 * The Ink Act — Scenes 1 & 2 fused into ONE continuous event, so there is no
 * seam to cross-fade.
 *
 *   drop → spread → the pooled ink is drawn into the characters 桑吟 as the pool
 *   is consumed → the written name travels up out of frame (camera descending).
 *
 * Nothing fades. Every change is a physical transform: the pool grows and then
 * shrinks to nothing as its ink migrates into the glyph forms (conservation of
 * ink), a brush tip rides the writing edge, and the finished characters leave
 * by travelling — the camera moving past them — which is exactly the descent
 * Scene 3 opens with.
 *
 * Perf: turbulence filters are baked once; only transforms animate per frame.
 */

// The act spans the whole of the intro + calligraphy slices as one range.
const INK_ACT: SceneDef = {
  id: 'ink-act',
  name: 'Ink act (drop → spread → write)',
  start: SCENES[0].start,
  end: SCENES[1].end,
}

const BANDS = 8
const W = 1000

/**
 * The departure MUST begin exactly as the next scene starts rising, or the
 * written name sits dead-centre while the next scene climbs into it — a stack,
 * not a pan (the M3→M4 dead-zone the review caught). Derive it from the scene
 * boundaries so it survives any re-weighting of scenes.ts.
 */
const SPAN = INK_ACT.end - INK_ACT.start
const DEPART_FROM = clamp01((SCENES[2].start - INK_ACT.start) / SPAN)

// Choreography breakpoints within the act's local progress t ∈ [0, 1].
// Writing must finish just before departure begins.
const SPREAD_TO = 0.34 // pool has fully spread by here
const WRITE_FROM = 0.3
const WRITE_TO = Math.max(WRITE_FROM + 0.2, DEPART_FROM - 0.04)

const DROPLETS = [
  { dx: -34, dy: -20, r: 26, delay: 0.08 },
  { dx: 38, dy: 14, r: 20, delay: 0.14 },
  { dx: 8, dy: 40, r: 15, delay: 0.2 },
]

export function InkAct() {
  const { progress: t, phase } = useScene(INK_ACT)

  // Register both wet-ink filters on the --wetness dial. They stay at full
  // scale through the ancient acts (wetness ≈ 1 here) and dry later, driven by
  // the single TransitionController via setAttribute (never a CSS var).
  const inkEdgeRef = useRef<SVGFEDisplacementMapElement>(null)
  const calligWetRef = useRef<SVGFEDisplacementMapElement>(null)
  useWetnessFilter(inkEdgeRef, 58)
  useWetnessFilter(calligWetRef, 10)

  // ---- pool: drop → spread → consumed into the characters ----
  const sp = easeOutCubic(clamp01(t / SPREAD_TO))
  const write = clamp01((t - WRITE_FROM) / (WRITE_TO - WRITE_FROM))
  const consume = easeInOut(write)
  const poolScale = (0.045 + sp * 1.02) * (1 - consume)
  const poolRot = t * 7

  // ---- water halo bleeding ahead of the ink, absorbed as ink is consumed ----
  const haloScale = (0.12 + easeOutCubic(clamp01(t / 0.45)) * 1.7) * (1 - consume * 0.85)
  const haloOpacity = (0.06 + clamp01(t / SPREAD_TO) * 0.05) * (1 - consume)

  // ---- camera: gentle push-in while writing, then travel up past the name ----
  const depart = clamp01((t - DEPART_FROM) / (1 - DEPART_FROM))
  const camScale = 0.99 + write * 0.05 + depart * 0.05
  const camY = -depart * 118 // vh

  // ---- brush tip riding the writing edge ----
  const paintFrac = clamp01(write)
  const tipOn = t > WRITE_FROM && write < 0.995
  const tipOpacity = tipOn ? 0.5 * clamp01(write * 6) : 0

  // whisper-quiet first-scroll cue on the empty paper
  const hint = Math.max(0, 1 - t / 0.08)

  const hidden = phase === 'after'

  return (
    <section
      className="scene scene--ink"
      aria-label="Ink drops, spreads, and is drawn into the characters 桑吟 (Sangyin)"
      style={{ visibility: hidden ? 'hidden' : 'visible' }}
    >
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
        <defs>
          <filter id="ink-edge" x="-60%" y="-60%" width="220%" height="220%">
            <feTurbulence type="fractalNoise" baseFrequency="0.017" numOctaves="3" seed="4" result="n" />
            <feDisplacementMap ref={inkEdgeRef} in="SourceGraphic" in2="n" scale="58" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="callig-wet" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.014 0.03" numOctaves="2" seed="9" result="n" />
            <feDisplacementMap ref={calligWetRef} in="SourceGraphic" in2="n" scale="10" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="callig-tip" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
          <clipPath id="callig-glyphs">
            <text
              x="500"
              y="205"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="330"
              letterSpacing="34"
              fontFamily="'Noto Serif SC', serif"
              fontWeight="600"
            >
              桑吟
            </text>
          </clipPath>
        </defs>
      </svg>

      {/* Everything the camera sees moves as one unit. */}
      <div
        className="ink-act__cam"
        style={{ transform: `translate3d(0, ${camY}vh, 0) scale(${camScale})` }}
      >
        {/* pooled ink */}
        <div className="ink">
          <div
            className="ink__halo"
            style={{ transform: `translate(-50%, -50%) scale(${haloScale})`, opacity: haloOpacity }}
          />
          <svg
            className="ink__svg"
            viewBox="0 0 600 600"
            style={{ transform: `translate(-50%, -50%) scale(${poolScale}) rotate(${poolRot}deg)` }}
            aria-hidden
          >
            <g filter="url(#ink-edge)" fill="var(--ink)">
              <circle cx="300" cy="300" r="150" />
              {DROPLETS.map((d, i) => {
                const dp = clamp01((t - d.delay) / (SPREAD_TO - d.delay))
                return (
                  <circle
                    key={i}
                    cx={300 + d.dx * (1 + t * 0.6)}
                    cy={300 + d.dy * (1 + t * 0.6)}
                    r={d.r * easeOutCubic(dp)}
                    opacity={0.9}
                  />
                )
              })}
            </g>
          </svg>
        </div>

        {/* the characters, painted from the pool's ink */}
        <div className="ink-act__glyphs">
          <svg className="callig__svg" viewBox="0 0 1000 400" role="img" aria-label="桑吟">
            <g clipPath="url(#callig-glyphs)" filter="url(#callig-wet)">
              {Array.from({ length: BANDS }, (_, i) => {
                const seg = 1 / BANDS
                const bp = easeOutCubic(clamp01((write - i * seg) / (seg * 1.9)))
                return (
                  <rect
                    key={i}
                    x={i * (W / BANDS) - 8}
                    y={0}
                    width={W / BANDS + 16}
                    height={400}
                    fill="var(--ink)"
                    style={{ transformBox: 'fill-box', transformOrigin: 'left center', transform: `scaleX(${bp})` }}
                  />
                )
              })}
            </g>
            <ellipse
              cx={40 + paintFrac * (W - 80)}
              cy={200}
              rx={22}
              ry={64}
              fill="var(--ink)"
              filter="url(#callig-tip)"
              opacity={tipOpacity}
            />
          </svg>
        </div>
      </div>

      <div className="intro__hint" style={{ opacity: hint }} aria-hidden>
        <span className="intro__hint-line" />
      </div>
    </section>
  )
}
