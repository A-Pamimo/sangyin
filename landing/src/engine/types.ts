/**
 * A scene occupies a contiguous slice of the master scroll timeline,
 * expressed as normalized global progress in the range [0, 1].
 *
 * The spec's architecture: "Each scene exposes enter() / update(progress) /
 * exit(). The master scroll timeline controls every scene." That contract is
 * modeled by `useScene` (see useScene.ts) — this type just describes where a
 * scene lives on the timeline.
 */
export interface SceneDef {
  /** Stable identifier, also used as a React key. */
  id: string
  /** Human-readable name, shown in the debug HUD during M1. */
  name: string
  /** Global progress at which the scene begins to take the stage. */
  start: number
  /** Global progress at which the scene has fully handed off. */
  end: number
}

/** Lifecycle phase of a scene relative to the current scroll position. */
export type ScenePhase = 'before' | 'active' | 'after'

/** The master driver's per-frame signal, delivered to every subscriber. */
export interface ScrollFrame {
  /** Global progress across the whole experience, 0 → 1. */
  progress: number
  /** Signed scroll velocity (px/frame-ish), useful for motion later. */
  velocity: number
  /** Raw scroll position in pixels. */
  scroll: number
  /** Total scrollable distance in pixels. */
  limit: number
}

/** A subscriber receives every frame the master driver emits. */
export type ScrollListener = (frame: ScrollFrame) => void

/** Props every scene component receives from the App shell. */
export interface SceneProps {
  def: SceneDef
  index: number
}
