import { useMemo } from 'react'
import { ScrollProvider } from './engine/ScrollProvider'
import { TransitionController } from './engine/TransitionController'
import { PaperBackground } from './components/PaperBackground'
import { DebugHUD } from './components/DebugHUD'
import { StaticFrame } from './components/StaticFrame'
import { InkAct } from './scenes/InkAct'
import { LandscapeAct } from './scenes/LandscapeAct'
import { TransitionScene } from './scenes/TransitionScene'
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
 *   - Reduced motion → one resolved <StaticFrame> (the modern app, pinned), no
 *     scroll journey at all. This is the single reduced-motion mechanism.
 *   - Otherwise:
 *       <ScrollProvider>        the master scroll driver (Lenis + GSAP, 1 clock).
 *       <TransitionController>  sole writer of the dials (--age/--wetness/
 *         --modernity); wraps the tree so scenes register filters via context.
 *       <PaperBackground>       the rice paper, always present, the ground.
 *       <div className="stage"> the fixed camera. Scenes travel through frame as
 *         global progress advances — never cross-fade.
 *       <div className="track"> a tall spacer defining scroll distance.
 *
 * The eight scenes, all real: fused InkAct (1+2), fused LandscapeAct (3+4, held
 * through the drying of 5), TransitionScene (5), ProductScene (6), AudioScene
 * (7), Finale (8).
 */
export default function App() {
  const reduced = useMemo(prefersReducedMotion, [])
  if (reduced) return <StaticFrame />

  return (
    <ScrollProvider>
      <TransitionController>
        <PaperBackground />

        <div className="stage">
          <InkAct />
          <LandscapeAct />
          <TransitionScene />
          <ProductScene />
          <AudioScene />
          <Finale />
        </div>

        <div className="track" style={{ height: `${TOTAL_VH}vh` }} aria-hidden />

        {import.meta.env.DEV && <DebugHUD />}
      </TransitionController>
    </ScrollProvider>
  )
}
