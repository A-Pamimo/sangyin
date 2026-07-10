// Shared design tokens — Fernwood earth-tone system (works on web + native).
// Three palettes (Sage / Clay / Loam) selectable at runtime; the non-color
// tokens (type, spacing, radius, elevation) are shared across all themes.
import { useMemo } from 'react';
import { Platform } from 'react-native';

import { useAppStore } from './store/appStore';

export type ThemeName = 'sage' | 'clay' | 'loam';

export interface Palette {
  bg: string; // page
  bgAlt: string; // deeper page (gradients / sunk areas)
  surface: string; // raised cards, dock
  surfaceAlt: string; // sunk inputs, chips, tracks
  border: string; // hairline
  text: string; // ink
  textDim: string; // muted body
  faint: string; // captions
  accent: string;
  accentDeep: string;
  accentSoft: string; // pale wash for active chips / highlights
  warm: string;
  onAccent: string; // ink on accent fills
  danger: string;
}

export const palettes: Record<ThemeName, Palette> = {
  sage: {
    bg: '#ECEBE0',
    bgAlt: '#E4E2D4',
    surface: '#FFFFFF',
    surfaceAlt: '#F4F3EA',
    border: 'rgba(35, 39, 29, 0.10)',
    text: '#23271D',
    textDim: '#4E543F',
    faint: '#8B917C',
    accent: '#5F6B44',
    accentDeep: '#414A32',
    accentSoft: '#EAECDF',
    warm: '#C79E6B',
    onAccent: '#ECEBE0',
    danger: '#B15238',
  },
  clay: {
    bg: '#F3EBDD',
    bgAlt: '#EDE1CE',
    surface: '#FFFDF8',
    surfaceAlt: '#FAF3E7',
    border: 'rgba(60, 30, 10, 0.10)',
    text: '#2B2721',
    textDim: '#5C5347',
    faint: '#A2917C',
    accent: '#B15238',
    accentDeep: '#8A4630',
    accentSoft: '#F1E1D2',
    warm: '#C79E6B',
    onAccent: '#F7EFE3',
    danger: '#8A4630',
  },
  loam: {
    bg: '#201A14',
    bgAlt: '#181209',
    surface: '#2C231A',
    surfaceAlt: '#241C13',
    border: 'rgba(255, 255, 255, 0.10)',
    text: '#EFE6D6',
    textDim: '#C6B79E',
    faint: '#8C7C63',
    accent: '#CE9A4E',
    accentDeep: '#B4552F',
    accentSoft: '#382B1E',
    warm: '#B4552F',
    onAccent: '#201A14',
    danger: '#CD7A54',
  },
};

export const THEME_IS_DARK: Record<ThemeName, boolean> = {
  sage: false,
  clay: false,
  loam: true,
};

export const THEME_LABELS: { name: ThemeName; label: string }[] = [
  { name: 'sage', label: 'Sage' },
  { name: 'clay', label: 'Clay' },
  { name: 'loam', label: 'Loam' },
];

// Non-color tokens — identical across every theme.
export const tokens = {
  fonts: {
    // Loaded on web via app/+html.tsx; falls back to the system font on native.
    display: "'Bricolage Grotesque', ui-sans-serif, system-ui, -apple-system, sans-serif",
    body: "'Hanken Grotesk', ui-sans-serif, system-ui, -apple-system, sans-serif",
    // Retro "system chrome" face — window titles, tickers, tags only (never body).
    // Space Mono is web-loaded; native uses a real platform monospace.
    mono: Platform.select({
      web: "'Space Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }) as string,
  },
  radius: 16,
  radiusSm: 12,
  // Retro window chrome: squarer corners dodge the native per-side-border + radius
  // fallback bug, and a 2px bevel reads as an "OS window" edge.
  radiusChrome: 2,
  bevelWidth: 2,
  chromeBarHeight: 28,
  chromeDot: 10,
  space: (n: number) => n * 4,
  // Soft, warm elevation for cards (iOS shadow* + Android elevation + web boxShadow).
  shadow: {
    shadowColor: '#363E28',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 4,
  },
} as const;

// ---------------------------------------------------------------------------
// Retro bevel system. Because React Native on iOS/Android collapses per-side
// border colors to a uniform border once a borderRadius is set, we cannot lean
// on translucent per-side borders. Instead we precompute OPAQUE edge colors by
// mixing the face toward white/black, and keep chrome nearly square (radius 2)
// so web and native render pixel-identically.
// ---------------------------------------------------------------------------

/** Parse #rgb / #rrggbb / rgb(...) to [r,g,b]. Falls back to mid-grey on miss. */
function toRgb(color: string): [number, number, number] {
  const hex = color.trim();
  if (hex[0] === '#') {
    let h = hex.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h.slice(0, 6), 16);
    if (!Number.isNaN(n)) return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = hex.match(/rgba?\(([^)]+)\)/i);
  if (m) {
    const p = m[1].split(',').map((x) => parseFloat(x));
    return [p[0] || 0, p[1] || 0, p[2] || 0];
  }
  return [128, 128, 128];
}

/** Per-channel lerp between two colors → an opaque `rgb(...)` string. */
export function mix(base: string, target: string, t: number): string {
  const [r1, g1, b1] = toRgb(base);
  const [r2, g2, b2] = toRgb(target);
  const l = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `rgb(${l(r1, r2)}, ${l(g1, g2)}, ${l(b1, b2)})`;
}

export type BevelVariant = 'raised' | 'inset';

export interface BevelStyle {
  face: string;
  borderTopColor: string;
  borderLeftColor: string;
  borderBottomColor: string;
  borderRightColor: string;
  borderWidth: number;
  borderRadius: number;
}

/**
 * Beveled edge for retro chrome. `raised` = light top/left + shadow bottom/right;
 * `inset` swaps them (pressed / sunk wells). Derived from palette tokens so it
 * reads correctly on Sage/Clay (light) and Loam (dark).
 */
export function bevel(colors: Palette, isDark: boolean, variant: BevelVariant = 'raised'): BevelStyle {
  const face = variant === 'inset' ? colors.surfaceAlt : isDark ? colors.surface : colors.surfaceAlt;
  const edgeLight = mix(face, '#FFFFFF', isDark ? 0.16 : 0.1);
  const edgeShadow = mix(face, '#000000', isDark ? 0.42 : 0.16);
  const tl = variant === 'inset' ? edgeShadow : edgeLight;
  const br = variant === 'inset' ? edgeLight : edgeShadow;
  return {
    face,
    borderTopColor: tl,
    borderLeftColor: tl,
    borderBottomColor: br,
    borderRightColor: br,
    borderWidth: tokens.bevelWidth,
    borderRadius: tokens.radiusChrome,
  };
}

export interface Theme {
  name: ThemeName;
  colors: Palette;
  isDark: boolean;
  fonts: typeof tokens.fonts;
  radius: number;
  radiusSm: number;
  radiusChrome: number;
  bevelWidth: number;
  chromeBarHeight: number;
  chromeDot: number;
  space: (n: number) => number;
  shadow: typeof tokens.shadow;
}

function buildTheme(name: ThemeName): Theme {
  return { name, colors: palettes[name], isDark: THEME_IS_DARK[name], ...tokens };
}

/** Reactive theme bound to the persisted user selection. Use inside components. */
export function useTheme(): Theme {
  const name = useAppStore((s) => s.themeName);
  return useMemo(() => buildTheme(name), [name]);
}

export interface Retro extends Theme {
  /** Beveled edge for the given variant, derived from the active palette. */
  bevel: (variant?: BevelVariant) => BevelStyle;
  /** Title-bar fill + text colors for window chrome. */
  chromeBar: string;
  chromeBarText: string;
  /** Convenience alias for the mono chrome font. */
  mono: string;
}

/** Theme + retro-chrome derivations. Use in retro components. */
export function useRetro(): Retro {
  const theme = useTheme();
  return useMemo(() => {
    const { colors, isDark } = theme;
    return {
      ...theme,
      bevel: (variant: BevelVariant = 'raised') => bevel(colors, isDark, variant),
      chromeBar: isDark ? colors.accent : colors.accentDeep,
      chromeBarText: colors.onAccent,
      mono: theme.fonts.mono,
    };
  }, [theme]);
}

/**
 * Static default (Sage). Safe for non-component code and module-scope defaults;
 * components should call useTheme() so they react to theme changes.
 */
export const theme = buildTheme('sage');
