import { useEffect, useState } from 'react';

/** Tokens de cor do tema usados fora do CSS (ex.: `fill` de gráficos SVG). */
const COLOR_TOKENS = {
  brand: '--color-brand',
  text: '--color-text',
  textMuted: '--color-text-muted',
  border: '--color-border',
  surface: '--color-surface',
  info: '--color-info',
  success: '--color-success',
  warning: '--color-warning',
  danger: '--color-danger',
} as const;

export type ThemeColors = Readonly<Record<keyof typeof COLOR_TOKENS, string>>;

function readColors(): ThemeColors {
  const style = getComputedStyle(document.documentElement);
  const entries = Object.entries(COLOR_TOKENS).map(([name, token]) => [name, style.getPropertyValue(token).trim() || 'currentColor']);
  return Object.fromEntries(entries) as ThemeColors;
}

/**
 * Cores do tema atual, relidas quando o sistema troca entre claro e escuro:
 * os gráficos acompanham o tema sem duplicar a paleta do CSS.
 */
export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState(readColors);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (media === undefined) return undefined;
    const update = (): void => setColors(readColors());
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return colors;
}
