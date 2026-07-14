/**
 * Fernwood tokens — a VALUE-ONLY mirror of the real app's design system.
 *
 * SOURCE OF TRUTH: app/src/theme.ts. That file imports `react-native`
 * (`Platform`) and its components use `react-native-reanimated`, so it CANNOT
 * be imported into this Vite/React-DOM landing (and Reanimated would add a
 * second animation clock, breaking the one-clock model). We therefore hand-copy
 * the literal token values here and build faithful CSS replicas from them, so
 * the landing's product moment is pixel-honest to the shipped app.
 *
 * Keep in sync with app/src/theme.ts when the app's palette/tokens change.
 */

export interface Palette {
  bg: string
  bgAlt: string
  surface: string
  surfaceAlt: string
  border: string
  text: string
  textDim: string
  faint: string
  accent: string
  accentDeep: string
  accentSoft: string
  warm: string
  onAccent: string
  danger: string
}

export type ThemeName = 'sage' | 'clay' | 'loam'

export const palettes: Record<ThemeName, Palette> = {
  sage: {
    bg: '#ECEBE0',
    bgAlt: '#E4E2D4',
    surface: '#FFFFFF',
    surfaceAlt: '#F4F3EA',
    border: 'rgba(35, 39, 29, 0.12)',
    text: '#23271D',
    textDim: '#4E543F',
    faint: '#8B917C',
    accent: '#5F6B44',
    accentDeep: '#414A32',
    accentSoft: 'rgba(95, 107, 68, 0.1)',
    warm: '#C79E6B',
    onAccent: '#ECEBE0',
    danger: '#B15238',
  },
  clay: {
    bg: '#F3EBDD',
    bgAlt: '#EDE1CE',
    surface: '#FFFDF8',
    surfaceAlt: '#FAF3E7',
    border: 'rgba(60, 30, 10, 0.08)',
    text: '#2B2721',
    textDim: '#5C5347',
    faint: '#A2917C',
    accent: '#B15238',
    accentDeep: '#8A4630',
    accentSoft: 'rgba(177, 82, 56, 0.1)',
    warm: '#C79E6B',
    onAccent: '#F7EFE3',
    danger: '#8A4630',
  },
  loam: {
    bg: '#201A14',
    bgAlt: '#181209',
    surface: '#2C231A',
    surfaceAlt: '#241C13',
    border: 'rgba(255, 255, 255, 0.08)',
    text: '#EFE6D6',
    textDim: '#C6B79E',
    faint: '#8C7C63',
    accent: '#CE9A4E',
    accentDeep: '#B4552F',
    accentSoft: 'rgba(206, 154, 78, 0.15)',
    warm: '#B4552F',
    onAccent: '#201A14',
    danger: '#CD7A54',
  },
}

/** The landing resolves into the app's default theme. */
export const sage = palettes.sage

export const fonts = {
  display: "'Bricolage Grotesque', ui-sans-serif, system-ui, -apple-system, sans-serif",
  body: "'Hanken Grotesk', ui-sans-serif, system-ui, -apple-system, sans-serif",
  mono: "'Space Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
}

export const tokens = {
  radius: 24,
  radiusSm: 12,
  radiusChrome: 16,
  bevelWidth: 1,
  chromeBarHeight: 44,
  chromeDot: 10,
  space: (n: number) => n * 4,
  tracking: { tight: -2, snug: -1, normal: 0, wide: 0.5, wider: 1.2 },
  /** CSS box-shadow equivalents of the app's four-tier RN shadow tokens. */
  shadows: {
    sm: '0 1px 4px rgba(0,0,0,0.06)',
    md: '0 4px 12px rgba(0,0,0,0.11)',
    lg: '0 8px 22px rgba(0,0,0,0.16)',
    xl: '0 20px 40px rgba(0,0,0,0.20)',
  },
} as const

function toRgb(color: string): [number, number, number] {
  const hex = color.trim()
  if (hex[0] === '#') {
    let h = hex.slice(1)
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
    const n = parseInt(h.slice(0, 6), 16)
    if (!Number.isNaN(n)) return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const m = hex.match(/rgba?\(([^)]+)\)/i)
  if (m) {
    const p = m[1].split(',').map((x) => parseFloat(x))
    return [p[0] || 0, p[1] || 0, p[2] || 0]
  }
  return [128, 128, 128]
}

/** Verbatim copy of app/src/theme.ts `mix()` — linear RGB crossfade. */
export function mix(base: string, target: string, t: number): string {
  const [r1, g1, b1] = toRgb(base)
  const [r2, g2, b2] = toRgb(target)
  const l = (a: number, b: number) => Math.round(a + (b - a) * t)
  return `rgb(${l(r1, r2)}, ${l(g1, g2)}, ${l(b1, b2)})`
}
