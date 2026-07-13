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
    display: "'Bricolage Grotesque', ui-sans-serif, system-ui, -apple-system, sans-serif",
    body: "'Hanken Grotesk', ui-sans-serif, system-ui, -apple-system, sans-serif",
    mono: Platform.select({
      web: "'Space Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }) as string,
  },
  radius: 24,
  radiusSm: 12,
  radiusChrome: 16, // More rounded for modern tactile feel
  bevelWidth: 1, // Kept for subtle highlighting, not chunky retro bevels
  chromeBarHeight: 44, // Taller, more modern header
  chromeDot: 10,
  space: (n: number) => n * 4,
  // Four-tier semantic shadow system (sm → xl)
  shadows: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 },  shadowOpacity: 0.06, shadowRadius: 4,  elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 },  shadowOpacity: 0.11, shadowRadius: 12, elevation: 4 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 },  shadowOpacity: 0.16, shadowRadius: 22, elevation: 8 },
    xl: { shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.20, shadowRadius: 40, elevation: 12 },
  },
  // Back-compat aliases
  shadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.20,
    shadowRadius: 40,
    elevation: 12,
  },
  shadowRaised: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.11,
    shadowRadius: 12,
    elevation: 4,
  },
  // Semantic letter-spacing tokens (px at typical display sizes)
  tracking: {
    tight:  -2,   // display headings
    snug:   -1,   // subheadings
    normal:  0,
    wide:    0.5, // body labels
    wider:   1.2, // monospace caps
  },
} as const;

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

// Updated bevel logic for Premium Tactile (soft inner light, no harsh dark bevels)
export function bevel(colors: Palette, isDark: boolean, variant: BevelVariant = 'raised'): BevelStyle {
  const face = variant === 'inset' ? colors.surfaceAlt : colors.surface;
  const edgeLight = mix(face, '#FFFFFF', isDark ? 0.08 : 0.4);
  const edgeShadow = mix(face, '#000000', isDark ? 0.3 : 0.05);
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
  shadows: typeof tokens.shadows;
  shadow: typeof tokens.shadow;
  shadowRaised: typeof tokens.shadowRaised;
  tracking: typeof tokens.tracking;
}

function buildTheme(name: ThemeName): Theme {
  return { name, colors: palettes[name], isDark: THEME_IS_DARK[name], ...tokens };
}

export function useTheme(): Theme {
  const name = useAppStore((s) => s.themeName);
  return useMemo(() => buildTheme(name), [name]);
}

export interface Retro extends Theme {
  bevel: (variant?: BevelVariant) => BevelStyle;
  chromeBar: string;
  chromeBarText: string;
  mono: string;
}

export function useRetro(): Retro {
  const theme = useTheme();
  return useMemo(() => {
    const { colors, isDark } = theme;
    return {
      ...theme,
      bevel: (variant: BevelVariant = 'raised') => bevel(colors, isDark, variant),
      chromeBar: isDark ? mix(colors.surface, '#000', 0.2) : mix(colors.surface, '#fff', 0.5),
      chromeBarText: colors.text,
      mono: theme.fonts.mono,
    };
  }, [theme]);
}

export const theme = buildTheme('sage');
