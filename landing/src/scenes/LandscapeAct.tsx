import { useEffect, useMemo, useRef } from 'react'
import { useScene } from '../engine/useScene'
import { useRafBinding } from '../engine/useRafBinding'
import { useWetnessFilter } from '../engine/useWetnessFilter'
import { SCENES } from '../engine/scenes'
import { range } from '../engine/ease'
import type { SceneDef } from '../engine/types'
import {
  buildPath,
  FAR_RIDGES,
  MID_RIDGES,
  RUNNELS,
  MASSES,
  WATER,
  MIST,
  BIRDS,
  LEAVES,
  WORLD_W,
  WORLD_H,
} from './landscape/geometry'

/**
 * The Landscape Act — Scenes 3 & 4 fused into ONE continuous descent, so there
 * is no seam between "travelling down the hanging scroll" and "Shan Shui comes
 * alive". The ink of the written name is pulled downward as RUNNELS that unroll
 * (self-paint) as the camera descends and hand off into the far mountain ridge:
 * the mountains ARE where the name's ink ran and pooled. Nothing fades in.
 *
 * Motion has exactly two sources and NEVER a second RAF:
 *   1. Scroll-bound — parallax descent + runnel reveal, via useRafBinding (the
 *      one clock), written straight to refs (no per-frame React render).
 *   2. Idle life — water/mist/birds/leaves drift via CSS @keyframes on child
 *      groups, kept OUTSIDE the wet filter (a transform on a filtered child
 *      re-rasterizes the whole filter every frame, even at rest).
 */

// Fuse scenes 3+4 into one descent, and hold it visible THROUGH the drying
// transition (scene 5, index 4) so the wetness dial is seen drying the real
// mountains — the same paths calm, no separate geometry to swap in.
const LANDSCAPE_ACT: SceneDef = {
  id: 'landscape-act',
  name: 'Landscape act (descent → Shan Shui → dry)',
  start: SCENES[2].start,
  end: SCENES[4].end,
}

// Parallax travel per depth layer (vh). Far moves least (distant), near most.
const FAR_TRAVEL = 90
const MID_TRAVEL = 150
const NEAR_TRAVEL = 180

const isSmallViewport = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(max-width: 640px)').matches

export function LandscapeAct() {
  const { phase } = useScene(LANDSCAPE_ACT)
  const hidden = phase !== 'active'

  const small = useMemo(isSmallViewport, [])

  // Parallax layer wrappers (hot transforms written imperatively).
  const farRef = useRef<HTMLDivElement>(null)
  const midRef = useRef<HTMLDivElement>(null)
  const nearRef = useRef<HTMLDivElement>(null)

  // The two wet-ink filters on the --wetness dial. On mobile we drop the
  // displacement filter entirely (biggest paint cost) for a pre-dried look.
  const shanRef = useRef<SVGFEDisplacementMapElement>(null)
  const runnelWetRef = useRef<SVGFEDisplacementMapElement>(null)
  useWetnessFilter(shanRef, small ? 0 : 40)
  useWetnessFilter(runnelWetRef, small ? 0 : 30)
  const shanFilter = small ? undefined : 'url(#shan-wet)'
  const runnelFilter = small ? undefined : 'url(#runnel-wet)'

  // Runnels self-paint (dasharray). Cache each path length once (batched reads,
  // no layout thrash), prime hidden, then reveal by writing dashoffset per frame.
  const runnelRefs = useRef<Array<SVGPathElement | null>>([])
  const runnelLens = useRef<number[]>([])
  useEffect(() => {
    runnelLens.current = runnelRefs.current.map((p) => {
      if (!p) return 0
      const L = p.getTotalLength()
      p.style.strokeDasharray = String(L)
      p.style.strokeDashoffset = String(L)
      return L
    })
  }, [])

  useRafBinding(LANDSCAPE_ACT, (local, active) => {
    if (!active) return
    if (farRef.current)
      farRef.current.style.transform = `translate3d(0, ${(-local * FAR_TRAVEL).toFixed(2)}vh, 0)`
    if (midRef.current)
      midRef.current.style.transform = `translate3d(0, ${(-local * MID_TRAVEL).toFixed(2)}vh, 0)`
    if (nearRef.current)
      nearRef.current.style.transform = `translate3d(0, ${(-local * NEAR_TRAVEL).toFixed(2)}vh, 0)`

    // Unroll the runnels early in the descent, lightly staggered.
    for (let i = 0; i < runnelRefs.current.length; i++) {
      const p = runnelRefs.current[i]
      const L = runnelLens.current[i]
      if (!p || !L) continue
      const reveal = range(local, i * 0.04, 0.26 + i * 0.04)
      p.style.strokeDashoffset = String(L * (1 - reveal))
    }
  })

  return (
    <section
      className="scene scene--landscape"
      aria-label="Travelling down a hanging scroll into a living Shan Shui landscape of ink mountains, water, and mist"
      style={{ visibility: hidden ? 'hidden' : 'visible' }}
    >
      {/* Shared wet-ink filters, defined once, referenced across layers. */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
        <defs>
          <filter id="shan-wet" x="-8%" y="-8%" width="116%" height="116%">
            <feTurbulence type="fractalNoise" baseFrequency="0.009" numOctaves="2" seed="7" result="n" />
            <feDisplacementMap ref={shanRef} in="SourceGraphic" in2="n" scale="40" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="runnel-wet" x="-30%" y="-6%" width="160%" height="112%">
            <feTurbulence type="fractalNoise" baseFrequency="0.02 0.01" numOctaves="2" seed="3" result="n" />
            <feDisplacementMap ref={runnelWetRef} in="SourceGraphic" in2="n" scale="30" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      {/* FAR — distant masses + mountains */}
      <div className="landscape__layer landscape__layer--far" ref={farRef} aria-hidden>
        <svg viewBox={`0 0 ${WORLD_W} ${WORLD_H}`} preserveAspectRatio="xMidYMid slice">
          <g fill="var(--mist)">
            {MASSES.map((m, i) => (
              <path key={i} d={m.d} opacity={m.opacity} />
            ))}
          </g>
          <g fill="none" stroke="var(--ink)" strokeLinecap="round" strokeLinejoin="round" filter={shanFilter}>
            {FAR_RIDGES.map((r, i) => (
              <path key={i} d={buildPath(r.wet)} strokeWidth={r.width} opacity={r.opacity} />
            ))}
          </g>
        </svg>
      </div>

      {/* MID — mist, mid ridges, the runnels, water, birds */}
      <div className="landscape__layer landscape__layer--mid" ref={midRef} aria-hidden>
        <svg viewBox={`0 0 ${WORLD_W} ${WORLD_H}`} preserveAspectRatio="xMidYMid slice">
          {/* mist — outside any filter, drifts via CSS */}
          <g fill="none" stroke="var(--mist)" strokeWidth="2" opacity="0.4">
            {MIST.map((m, i) => (
              <path key={i} d={m.d} className="mist" style={{ ['--dur' as string]: `${m.dur}s` }} />
            ))}
          </g>

          {/* mid ridges — static wet ink, filter rasterized once */}
          <g fill="none" stroke="var(--ink)" strokeLinecap="round" strokeLinejoin="round" filter={shanFilter}>
            {MID_RIDGES.map((r, i) => (
              <path key={i} d={buildPath(r.wet)} strokeWidth={r.width} opacity={r.opacity} />
            ))}
          </g>

          {/* runnels — the name's ink, self-painting; own tight wet filter */}
          <g fill="none" stroke="var(--ink)" strokeLinecap="round" strokeLinejoin="round" filter={runnelFilter}>
            {RUNNELS.map((r, i) => (
              <path
                key={i}
                ref={(el) => {
                  runnelRefs.current[i] = el
                }}
                d={buildPath(r.wet)}
                strokeWidth={r.width}
                opacity={r.opacity}
              />
            ))}
          </g>

          {/* water — drifts, no filter */}
          <g fill="none" stroke="var(--ink-soft)" strokeWidth="2.5" opacity="0.5">
            {WATER.map((w, i) => (
              <path key={i} d={w.d} className="water" style={{ ['--dur' as string]: `${w.dur}s` }} />
            ))}
          </g>

          {/* birds — sparse ink marks gliding across, no filter.
              Outer group positions (attribute); inner group drifts (CSS). */}
          {!small &&
            BIRDS.map((b, i) => (
              <g key={i} transform={`translate(${b.x} ${b.y}) scale(${b.scale})`}>
                <g
                  className="bird"
                  style={{ ['--dur' as string]: `${b.dur}s`, ['--delay' as string]: `${b.delay}s` }}
                >
                  <path d="M0 0 q10 -9 20 0 q10 -9 20 0" fill="none" stroke="var(--ink-soft)" strokeWidth="3" strokeLinecap="round" />
                </g>
              </g>
            ))}
        </svg>
      </div>

      {/* NEAR — falling leaves */}
      <div className="landscape__layer landscape__layer--near" ref={nearRef} aria-hidden>
        <svg viewBox={`0 0 ${WORLD_W} ${WORLD_H}`} preserveAspectRatio="xMidYMid slice">
          {(small ? LEAVES.slice(0, 2) : LEAVES).map((lf, i) => (
            <g key={i} transform={`translate(${lf.x} 760) scale(${lf.scale})`}>
              <g
                className="leaf"
                style={{ ['--dur' as string]: `${lf.dur}s`, ['--delay' as string]: `${lf.delay}s` }}
              >
                <path d="M0 0 q14 -10 26 4 q-10 14 -26 -4 Z" fill="var(--blossom, #cbb89a)" opacity="0.55" />
              </g>
            </g>
          ))}
        </svg>
      </div>
    </section>
  )
}
