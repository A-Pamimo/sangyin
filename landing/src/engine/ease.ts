/**
 * Shared easing + interpolation helpers.
 *
 * Every scene derives its visuals as a PURE FUNCTION of local progress, using
 * these helpers — the scroll is the clock, so there is one canonical set of
 * curves (lifted out of InkAct so scenes stop copy-pasting their own).
 */

/** Clamp to [0, 1]. */
export const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n)

/** Linear interpolation. */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/**
 * Remap x from [inMin, inMax] onto [0, 1], clamped. The workhorse for turning a
 * scene's local progress into a sub-beat's own 0→1 range.
 */
export const range = (x: number, inMin: number, inMax: number): number =>
  clamp01((x - inMin) / (inMax - inMin || 1))

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3)

export const easeInCubic = (t: number): number => t * t * t

export const easeInOut = (t: number): number =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2

/** Classic smoothstep (S-curve with zero velocity at both ends). */
export const smoothstep = (t: number): number => {
  const c = clamp01(t)
  return c * c * (3 - 2 * c)
}
