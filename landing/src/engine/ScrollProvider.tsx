import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'
import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type { ScrollFrame, ScrollListener } from './types'

gsap.registerPlugin(ScrollTrigger)

/**
 * The master scroll driver.
 *
 * Responsibilities (and nothing more — this is the whole of Milestone 1's
 * engine core):
 *   1. Smooth scrolling via Lenis, driven off GSAP's ticker so Lenis and
 *      ScrollTrigger share one clock (no double RAF loops, no jitter).
 *   2. A single ScrollTrigger spanning the whole page that converts scroll
 *      position into normalized global progress [0, 1].
 *   3. A tiny pub/sub so any component can receive every frame WITHOUT the
 *      provider re-rendering the React tree 60×/second.
 *
 * Reduce-motion: when the user prefers reduced motion we skip Lenis entirely
 * and let ScrollTrigger read native scroll. The progress signal is identical;
 * only the smoothing is dropped.
 */

interface ScrollEngine {
  /** Subscribe to per-frame updates. Returns an unsubscribe function. */
  subscribe: (listener: ScrollListener) => () => void
  /** Read the latest frame imperatively (e.g. to seed initial state). */
  getFrame: () => ScrollFrame
  /** True when Lenis smoothing is active (false under reduce-motion). */
  smooth: boolean
}

const ScrollContext = createContext<ScrollEngine | null>(null)

export function useScrollEngine(): ScrollEngine {
  const engine = useContext(ScrollContext)
  if (!engine) {
    throw new Error('useScrollEngine must be used within <ScrollProvider>')
  }
  return engine
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function ScrollProvider({ children }: { children: ReactNode }) {
  const listeners = useRef(new Set<ScrollListener>())
  const frame = useRef<ScrollFrame>({
    progress: 0,
    velocity: 0,
    scroll: 0,
    limit: 0,
  })
  const smooth = useMemo(() => !prefersReducedMotion(), [])

  const engine = useMemo<ScrollEngine>(
    () => ({
      subscribe(listener) {
        listeners.current.add(listener)
        // Deliver the current frame immediately so late subscribers aren't
        // stuck at zero until the next scroll event.
        listener(frame.current)
        return () => {
          listeners.current.delete(listener)
        }
      },
      getFrame: () => frame.current,
      smooth,
    }),
    [smooth],
  )

  useEffect(() => {
    let lenis: Lenis | null = null

    const emit = () => {
      for (const listener of listeners.current) listener(frame.current)
    }

    if (smooth) {
      lenis = new Lenis({
        // Gentle, museum-like glide. Higher duration = longer coast.
        duration: 1.15,
        easing: (t) => 1 - Math.pow(1 - t, 3),
        wheelMultiplier: 0.9,
        touchMultiplier: 1.1,
      })

      lenis.on('scroll', (e: { velocity: number }) => {
        frame.current.velocity = e.velocity
        ScrollTrigger.update()
      })

      // One clock: GSAP's ticker drives Lenis. lagSmoothing(0) keeps scroll and
      // animation perfectly in step even if a frame is dropped.
      const raf = (time: number) => lenis?.raf(time * 1000)
      gsap.ticker.add(raf)
      gsap.ticker.lagSmoothing(0)

      // Master progress trigger — spans from scroll 0 to the page's max scroll.
      const st = ScrollTrigger.create({
        start: 0,
        end: 'max',
        onUpdate: (self) => {
          frame.current.progress = self.progress
          frame.current.scroll = self.scroll()
          frame.current.limit = self.end
          emit()
        },
      })

      return () => {
        st.kill()
        gsap.ticker.remove(raf)
        lenis?.destroy()
        lenis = null
      }
    }

    // Reduce-motion path: native scroll, same progress signal.
    const st = ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: (self) => {
        frame.current.progress = self.progress
        frame.current.scroll = self.scroll()
        frame.current.limit = self.end
        frame.current.velocity = self.getVelocity()
        emit()
      },
    })

    return () => {
      st.kill()
    }
  }, [smooth])

  return <ScrollContext.Provider value={engine}>{children}</ScrollContext.Provider>
}
