import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useScrollEngine } from './ScrollProvider'
import { SCENES } from './scenes'
import { clamp01, easeInOut, smoothstep } from './ease'
import {
  WetnessContext,
  type WetnessEntry,
  type WetnessRegistry,
} from './useWetnessFilter'

/**
 * The SOLE writer of the two global dials that carry the whole ancient→modern
 * drift (plan §2.1). Nothing else writes `--age` / `--wetness` / `--modernity`.
 *
 *   --wetness (1→0): ink drying into vector. Held ~1 through the ancient acts,
 *     ramps to 0 across the transition scene, stays 0 after. Drives every
 *     registered feDisplacementMap.scale (the JS path — see useWetnessFilter).
 *   --age (0→1): time/warmth/brightness + type drift. WETNESS LEADS, WARMTH
 *     FOLLOWS — age is held flat through the wet acts so the "ancient" landscape
 *     doesn't already look modern-warm, then climbs across the dry-down.
 *   --modernity: a derived curve of age (UI-token/type interpolation dial), not
 *     an independent variable — avoids three-way desync.
 *
 * All three are written on document.documentElement so any element can read
 * them. Filter re-rasterization is expensive, so the scale writes are throttled
 * to meaningful wetness changes and freeze once dry.
 */

// The transition act (Scene 5, index 4) is where wet dries to vector.
const DRY = SCENES[4]

function computeWetness(progress: number): number {
  if (progress <= DRY.start) return 1
  if (progress >= DRY.end) return 0
  return 1 - clamp01((progress - DRY.start) / (DRY.end - DRY.start))
}

function computeAge(progress: number): number {
  // Warmth begins only once drying begins; flat and low before that.
  return easeInOut(clamp01((progress - DRY.start) / (1 - DRY.start)))
}

export function TransitionController({ children }: { children: ReactNode }) {
  const { subscribe } = useScrollEngine()
  const entries = useRef(new Set<WetnessEntry>())
  const wetness = useRef(1)

  const registry = useMemo<WetnessRegistry>(
    () => ({
      register(entry) {
        entries.current.add(entry)
        // Seed at current wetness so a late-mounting scene's filter isn't stuck
        // at its authored default until wetness next crosses the throttle.
        entry.node.setAttribute(
          'scale',
          String(entry.baseScale * wetness.current),
        )
        return () => {
          entries.current.delete(entry)
        }
      },
      getWetness: () => wetness.current,
    }),
    [],
  )

  useEffect(() => {
    const root = document.documentElement
    let lastWet = -1
    return subscribe(({ progress }) => {
      const wet = computeWetness(progress)
      const age = computeAge(progress)
      const modernity = smoothstep(age)
      wetness.current = wet

      root.style.setProperty('--age', age.toFixed(4))
      root.style.setProperty('--modernity', modernity.toFixed(4))
      root.style.setProperty('--wetness', wet.toFixed(4))

      // Throttle the costly setAttribute + filter repaint; freeze once dry/steady.
      if (Math.abs(wet - lastWet) > 0.005) {
        for (const { node, baseScale } of entries.current) {
          node.setAttribute('scale', String(baseScale * wet))
        }
        lastWet = wet
      }
    })
  }, [subscribe])

  return (
    <WetnessContext.Provider value={registry}>
      {children}
    </WetnessContext.Provider>
  )
}
