/**
 * The ONE shared bar geometry (plan §M7). Both the canvas particle sim
 * (AudioScene) and the DOM <Scrubber> (audio end-state + Finale) derive their
 * bars from this, so the wave literally BECOMES the instrument — same columns,
 * same heights — with no cross-fade between canvas and DOM.
 */

export const BAR_COUNT = 96
export const BAR_COUNT_MOBILE = 48

/**
 * A hand-authored speech-like amplitude envelope in [0,1] — clustered peaks
 * (syllables) and near-silences, NOT a sine. Deterministic (seeded), so the
 * canvas and DOM always agree.
 */
export function speechEnvelope(n: number): number[] {
  // A few "words": each is a gaussian cluster of syllable bumps.
  const words = [
    { c: 0.1, w: 0.06, a: 0.7 },
    { c: 0.24, w: 0.05, a: 0.95 },
    { c: 0.4, w: 0.08, a: 0.6 },
    { c: 0.56, w: 0.05, a: 1.0 },
    { c: 0.72, w: 0.07, a: 0.75 },
    { c: 0.88, w: 0.05, a: 0.55 },
  ]
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1)
    let v = 0
    for (const w of words) {
      const d = (x - w.c) / w.w
      v += w.a * Math.exp(-d * d)
    }
    // Fine syllable detail (deterministic ripple) + a floor of breath.
    const detail = 0.12 * (0.5 + 0.5 * Math.sin(x * n * 0.9))
    out.push(Math.min(1, Math.max(0.04, v * (0.85 + detail))))
  }
  return out
}
