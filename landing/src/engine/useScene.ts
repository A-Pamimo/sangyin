import { useEffect, useRef, useState } from 'react'
import { useScrollEngine } from './ScrollProvider'
import type { SceneDef, ScenePhase } from './types'

export interface SceneLifecycle {
  /** Called once when the scene becomes active (scroll enters its range). */
  onEnter?: () => void
  /** Called every frame while active, with local progress 0 → 1. */
  onUpdate?: (localProgress: number) => void
  /** Called once when the scene stops being active (scroll leaves its range). */
  onExit?: (direction: 'forward' | 'backward') => void
}

export interface SceneState {
  /** True while the master scroll position is within this scene's range. */
  active: boolean
  /** Progress through THIS scene, 0 → 1 (clamped). */
  progress: number
  /** Where the playhead sits relative to this scene. */
  phase: ScenePhase
}

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n)

/**
 * Bind a component to a slice of the master timeline.
 *
 * This is the spec's scene contract in hook form: the master driver owns the
 * clock, and each scene is told when to `enter`, how to `update(progress)`, and
 * when to `exit`. Lifecycle callbacks fire imperatively (no render), while the
 * returned SceneState drives declarative rendering. React only re-renders a
 * scene while it is active (plus one settling frame at each edge), so eight
 * scenes on screen cost one scene's worth of updates.
 */
export function useScene(def: SceneDef, lifecycle: SceneLifecycle = {}): SceneState {
  const { subscribe } = useScrollEngine()
  const [state, setState] = useState<SceneState>({
    active: false,
    progress: 0,
    phase: 'before',
  })

  // Keep the latest callbacks without re-subscribing every render.
  const cb = useRef(lifecycle)
  cb.current = lifecycle

  const wasActive = useRef(false)

  useEffect(() => {
    const span = def.end - def.start || 1

    return subscribe(({ progress }) => {
      const local = clamp01((progress - def.start) / span)
      const active = progress >= def.start && progress < def.end
      const phase: ScenePhase =
        progress < def.start ? 'before' : progress >= def.end ? 'after' : 'active'

      // Fire imperative lifecycle edges.
      if (active && !wasActive.current) cb.current.onEnter?.()
      if (active) cb.current.onUpdate?.(local)
      if (!active && wasActive.current) {
        cb.current.onExit?.(phase === 'after' ? 'forward' : 'backward')
      }
      wasActive.current = active

      // Update declarative state only when something meaningful changed, and
      // only near the scene's window — inactive scenes stay dormant.
      setState((prev) => {
        const changedActive = prev.active !== active
        const changedProgress = Math.abs(prev.progress - local) > 0.0005
        const changedPhase = prev.phase !== phase
        if (!changedActive && !changedProgress && !changedPhase) return prev
        // Skip churn for fully-offscreen scenes once they've settled at an edge.
        if (!active && !changedActive && !changedPhase) return prev
        return { active, progress: local, phase }
      })
    })
    // def fields are primitives; re-subscribe only if the scene's range moves.
  }, [def.start, def.end, subscribe])

  return state
}
