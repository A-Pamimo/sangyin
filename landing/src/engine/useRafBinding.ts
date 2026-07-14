import { useEffect, useRef } from 'react'
import { useScrollEngine } from './ScrollProvider'
import type { SceneDef } from './types'
import { clamp01 } from './ease'

/**
 * Ref-direct per-frame binding for HOT scenes (parallax layers, canvas) whose
 * transforms are too heavy to route through React state every frame.
 *
 * Subscribes to the master driver and calls `write(local, active)` per frame,
 * where `local` is progress through this scene's range [0,1] — the caller
 * writes straight to element refs (`el.style.transform`, `setAttribute`),
 * bypassing reconciliation. This is the same imperative pattern PaperBackground
 * uses; it complements (does not replace) `useScene`, which still owns the
 * declarative structure and phase/visibility gating.
 *
 * The callback is held in a ref so callers can pass an inline function without
 * forcing a re-subscribe every render.
 */
export function useRafBinding(
  def: Pick<SceneDef, 'start' | 'end'>,
  write: (local: number, active: boolean) => void,
): void {
  const { subscribe } = useScrollEngine()
  const cb = useRef(write)
  cb.current = write

  useEffect(() => {
    const span = def.end - def.start || 1
    return subscribe(({ progress }) => {
      const local = clamp01((progress - def.start) / span)
      const active = progress >= def.start && progress < def.end
      cb.current(local, active)
    })
  }, [def.start, def.end, subscribe])
}
