import { createContext, useContext, useEffect } from 'react'
import type { RefObject } from 'react'

/**
 * The `--wetness` dial's one legitimate blocker (plan §2.3):
 * `feDisplacementMap`'s `scale` is an SVG PRESENTATION ATTRIBUTE. CSS `var()`
 * does NOT apply to it and there is no CSS property for it — wiring `--wetness`
 * as a CSS var on a filter silently no-ops (no error, no drying). The only path
 * is to write the attribute from JS every frame.
 *
 * So filters register here and the single TransitionController subscribe loop
 * does `node.setAttribute('scale', baseScale * wetness)`. Never a CSS var.
 */

export interface WetnessEntry {
  node: SVGFEDisplacementMapElement
  baseScale: number
}

export interface WetnessRegistry {
  /** Register a filter node; returns an unregister fn. */
  register: (entry: WetnessEntry) => () => void
  /** Current wetness [0,1], read imperatively when seeding a freshly-mounted node. */
  getWetness: () => number
}

export const WetnessContext = createContext<WetnessRegistry | null>(null)

/**
 * Register an `feDisplacementMap` node so the controller drives its `scale`
 * = baseScale · wetness per frame. Unregisters on unmount (a conditionally
 * unmounted scene MUST unregister or the controller writes to a detached node).
 */
export function useWetnessFilter(
  ref: RefObject<SVGFEDisplacementMapElement | null>,
  baseScale: number,
): void {
  const registry = useContext(WetnessContext)
  useEffect(() => {
    const node = ref.current
    if (!node || !registry) return
    return registry.register({ node, baseScale })
  }, [registry, ref, baseScale])
}
