// Shared design tokens — Fernwood earth-tone system (works on web + native).
// Three palettes (Sage / Clay / Loam) selectable at runtime; the non-color
// tokens (type, spacing, radius, elevation) are shared across all themes.
import { useMemo } from 'react';

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
  },
  radius: 16,
  radiusSm: 12,
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

export interface Theme {
  name: ThemeName;
  colors: Palette;
  isDark: boolean;
  fonts: typeof tokens.fonts;
  radius: number;
  radiusSm: number;
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

/**
 * Static default (Sage). Safe for non-component code and module-scope defaults;
 * components should call useTheme() so they react to theme changes.
 */
export const theme = buildTheme('sage');
