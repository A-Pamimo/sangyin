// Minimal shared design tokens (dark-first, works on web + native).
export const theme = {
  colors: {
    bg: '#0f1115',
    surface: '#181b22',
    surfaceAlt: '#21252e',
    border: '#2a2f3a',
    text: '#e7e9ee',
    textDim: '#9aa1ad',
    accent: '#7c9cff',
    accentSoft: 'rgba(124, 156, 255, 0.18)',
    danger: '#ff6b6b',
  },
  radius: 12,
  space: (n: number) => n * 4,
};
