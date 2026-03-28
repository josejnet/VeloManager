import type { ThemeConfig, ThemeKey } from '@/types'

export const THEMES: Record<ThemeKey, ThemeConfig> = {
  blue: {
    key: 'blue',
    label: 'Ciclismo Azul',
    sport: 'Ciclismo',
    primary: '37 99 235',
    primaryDark: '29 78 216',
    primaryLight: '96 165 250',
    secondary: '14 165 233',
    accent: '245 158 11',
  },
  orange: {
    key: 'orange',
    label: 'Running Naranja',
    sport: 'Running',
    primary: '234 88 12',
    primaryDark: '194 65 12',
    primaryLight: '251 146 60',
    secondary: '245 158 11',
    accent: '239 68 68',
  },
  green: {
    key: 'green',
    label: 'Triatlón Verde',
    sport: 'Triatlón',
    primary: '22 163 74',
    primaryDark: '15 118 53',
    primaryLight: '74 222 128',
    secondary: '20 184 166',
    accent: '234 88 12',
  },
  red: {
    key: 'red',
    label: 'Fútbol Rojo',
    sport: 'Fútbol',
    primary: '220 38 38',
    primaryDark: '185 28 28',
    primaryLight: '248 113 113',
    secondary: '234 88 12',
    accent: '250 204 21',
  },
  purple: {
    key: 'purple',
    label: 'Natación Violeta',
    sport: 'Natación',
    primary: '124 58 237',
    primaryDark: '109 40 217',
    primaryLight: '167 139 250',
    secondary: '236 72 153',
    accent: '14 165 233',
  },
  yellow: {
    key: 'yellow',
    label: 'Tenis Amarillo',
    sport: 'Tenis',
    primary: '202 138 4',
    primaryDark: '161 98 7',
    primaryLight: '250 204 21',
    secondary: '132 204 22',
    accent: '234 88 12',
  },
  teal: {
    key: 'teal',
    label: 'Pádel Teal',
    sport: 'Pádel',
    primary: '13 148 136',
    primaryDark: '15 118 110',
    primaryLight: '45 212 191',
    secondary: '6 182 212',
    accent: '124 58 237',
  },
  slate: {
    key: 'slate',
    label: 'Multideporte Slate',
    sport: 'Multideporte',
    primary: '71 85 105',
    primaryDark: '51 65 85',
    primaryLight: '100 116 139',
    secondary: '14 165 233',
    accent: '22 163 74',
  },
}

// ─── Hex color helpers ────────────────────────────────────────────────────

/** Convert #rrggbb → "r g b" (space-separated for CSS custom properties) */
function hexToRgbString(hex: string): string | null {
  const clean = hex.replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(clean)) return null
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return `${r} ${g} ${b}`
}

/** Darken/lighten an RGB string by multiplying channels (factor < 1 = darken) */
function shiftRgb(rgb: string, factor: number): string {
  return rgb
    .split(' ')
    .map((v) => Math.min(255, Math.max(0, Math.round(parseInt(v) * factor))).toString())
    .join(' ')
}

export function getThemeVars(
  themeKey: string,
  primaryColor?: string | null,
  secondaryColor?: string | null,
): string {
  // If a valid custom hex primary is supplied, use it and derive dark/light variants
  const customPrimaryRgb = primaryColor ? hexToRgbString(primaryColor) : null
  if (customPrimaryRgb) {
    const customSecondaryRgb = secondaryColor ? (hexToRgbString(secondaryColor) ?? customPrimaryRgb) : customPrimaryRgb
    return [
      `--color-primary: ${customPrimaryRgb};`,
      `--color-primary-dark: ${shiftRgb(customPrimaryRgb, 0.82)};`,
      `--color-primary-light: ${shiftRgb(customPrimaryRgb, 1.32)};`,
      `--color-secondary: ${customSecondaryRgb};`,
      `--color-accent: ${shiftRgb(customPrimaryRgb, 1.6)};`,
    ].join(' ')
  }

  // Fall back to predefined theme palette
  const theme = THEMES[themeKey as ThemeKey] ?? THEMES.blue
  return [
    `--color-primary: ${theme.primary};`,
    `--color-primary-dark: ${theme.primaryDark};`,
    `--color-primary-light: ${theme.primaryLight};`,
    `--color-secondary: ${theme.secondary};`,
    `--color-accent: ${theme.accent};`,
  ].join(' ')
}

/**
 * Convert the CSS-variable string returned by getThemeVars() into a React
 * inline style object so the vars are actually injected into the DOM.
 * (React ignores the `cssText` property on style objects.)
 */
export function themeVarsToStyle(vars: string): React.CSSProperties {
  const style: Record<string, string> = {}
  vars.split(';').forEach((decl) => {
    const idx = decl.indexOf(':')
    if (idx === -1) return
    const prop = decl.slice(0, idx).trim()
    const val = decl.slice(idx + 1).trim()
    if (prop && val) style[prop] = val
  })
  return style as React.CSSProperties
}
