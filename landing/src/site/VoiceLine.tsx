import { useEffect, useRef } from 'react'

/**
 * The waveform "voice-line" — the landing's signature motif. The product turns
 * text into voice, so a speech-shaped waveform runs through the whole page:
 * under the wordmark, in the hero player, as the dark band's centerpiece, and
 * under the closing mark. Drawn on a canvas (cheap, crisp at any DPR).
 */
type Kind = 'brand' | 'hero' | 'listen' | 'close'

/** A hand-shaped speech envelope in [0,1] — clustered syllables, not a sine. */
function env(x: number): number {
  const words: Array<[number, number, number]> = [
    [0.1, 0.06, 0.7],
    [0.24, 0.05, 0.95],
    [0.4, 0.08, 0.6],
    [0.56, 0.05, 1],
    [0.72, 0.07, 0.75],
    [0.88, 0.05, 0.55],
  ]
  let v = 0
  for (const [c, w, a] of words) {
    const d = (x - c) / w
    v += a * Math.exp(-d * d)
  }
  return Math.min(1, Math.max(0.05, v * (0.85 + 0.12 * (0.5 + 0.5 * Math.sin(x * 54 * 0.9)))))
}

export function VoiceLine({ kind, className }: { kind: Kind; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = cv.clientWidth || 300
      const h = cv.clientHeight || 32
      cv.width = Math.round(w * dpr)
      cv.height = Math.round(h * dpr)
      const g = cv.getContext('2d')
      if (!g) return
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, w, h)

      const N = Math.max(24, Math.round(w / 6))
      const bw = w / N
      const dark = kind === 'listen'
      const played = kind === 'hero' ? 0.42 : kind === 'brand' ? 1 : 0.6
      const onCol = dark ? '#ce9a4e' : '#5f6b44'
      const offCol = dark ? 'rgba(239,230,214,.28)' : '#8b917c'

      for (let i = 0; i < N; i++) {
        const x = i / (N - 1)
        const bh = Math.max(2, env(x) * h * 0.92)
        g.fillStyle = x < played ? onCol : offCol
        g.fillRect(i * bw + bw * 0.18, (h - bh) / 2, Math.max(1.5, bw * 0.5), bh)
      }
    }
    draw()
    window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [kind])

  return <canvas ref={ref} className={className} aria-hidden="true" />
}
