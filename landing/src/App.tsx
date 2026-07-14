import { useMemo } from 'react'
import { ScrollProvider } from './engine/ScrollProvider'
import { TransitionController } from './engine/TransitionController'
import { PaperBackground } from './components/PaperBackground'
import { PortalLayer } from './components/PortalLayer'
import { DebugHUD } from './components/DebugHUD'
import { StaticFrame } from './components/StaticFrame'
import { InkAct } from './scenes/InkAct'
import { LandscapeAct } from './scenes/LandscapeAct'
import { ProductScene } from './scenes/ProductScene'
import { AudioScene } from './scenes/AudioScene'
import { Finale } from './scenes/Finale'
import { TOTAL_VH } from './engine/scenes'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * The shell.
 *
 *   - Reduced motion → one resolved <StaticFrame>; no scroll journey.
 *   - Otherwise:
 *       <ScrollProvider>        the master scroll driver (Lenis + GSAP, 1 clock).
 *       <TransitionController>  sole writer of the dials (--age/--wetness/…).
 *       <PaperBackground>       the rice paper, always present.
 *       <div className="stage"> the fixed camera. Each scene is wrapped in a
 *         <PortalLayer>, which zooms one scene INTO the next through a shape
 *         (match-cut) — no cross-fade, no visibility pop, fully reversible.
 *       <div className="track"> a tall spacer defining scroll distance.
 *
 * The scene→portal chain:
 *   drop ◯ → 桑吟 (InkAct) → 吟's counter ◗ → valley/mountains (LandscapeAct,
 *   held through the drying) → window ▢ (ProductScene) → waveform (AudioScene)
 *   → seal ▣ → the reader (Finale).
 */
export default function App() {
  const reduced = useMemo(prefersReducedMotion, [])
  if (reduced) return <StaticFrame />

  return (
    <ScrollProvider>
      <TransitionController>
        <PaperBackground />

        <div className="stage">
          <PortalLayer index={0}>
            <InkAct />
          </PortalLayer>
          <PortalLayer index={1}>
            <LandscapeAct />
          </PortalLayer>
          <PortalLayer index={2}>
            <ProductScene />
          </PortalLayer>
          <PortalLayer index={3}>
            <AudioScene />
          </PortalLayer>
          <PortalLayer index={4}>
            <Finale />
          </PortalLayer>
        </div>

        <div className="track" style={{ height: `${TOTAL_VH}vh` }} aria-hidden />

        {import.meta.env.DEV && <DebugHUD />}
      </TransitionController>
    </ScrollProvider>
  )
}
