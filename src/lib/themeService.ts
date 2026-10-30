/**
 * Theme management service.
 * Applies theme via [data-theme] attribute on <html>.
 * Persists choice to localStorage and optionally to backend.
 */

import { getAccessToken } from './api';

const STORAGE_KEY = 'tg-theme';
const CUSTOM_THEME_KEY = 'tg-custom-theme';

export type ThemeID = 'light' | 'cloudy' | 'dark' | 'amber' | 'custom';

export const THEME_OPTIONS: readonly ThemeID[] = ['light', 'cloudy', 'dark', 'amber', 'custom'] as const;

/**
 * O nome de cada tema, como o usuário o lê. Fica aqui, e não em cada tela, porque
 * quem escolhe tema aparece em três lugares (casca, landing e personalizador) e o
 * nome tem de ser o mesmo nos três.
 */
export const THEME_LABELS: Record<ThemeID, string> = {
  light: 'Claro',
  cloudy: 'Nublado',
  dark: 'Escuro',
  amber: 'Âmbar',
  custom: 'Personalizado',
};

/** Tokens the user can customize in the Custom theme. */
export const CUSTOM_THEME_TOKENS = [
  'brand-primary',
  'brand-primary-light',
  'brand-primary-dark',
  'brand-background',
  'brand-surface',
  'text-primary',
  'text-secondary',
  'text-muted',
  'border-color',
  'border-light',
  'muted-bg',
  'hover',
  'active',
  'danger',
  'success',
  'warning',
  'info',
] as const;

export type CustomThemeToken = typeof CUSTOM_THEME_TOKENS[number];
export type CustomThemeColors = Partial<Record<CustomThemeToken, string>>;

/** Default custom theme values (starts as a copy of Light theme). */
export const DEFAULT_CUSTOM_COLORS: Record<CustomThemeToken, string> = {
  'brand-primary': '#3B82F6',
  'brand-primary-light': '#60A5FA',
  'brand-primary-dark': '#2563EB',
  'brand-background': '#EEF1F5',
  'brand-surface': '#FFFFFF',
  'text-primary': '#1E293B',
  'text-secondary': '#64748B',
  'text-muted': '#94A3B8',
  'border-color': '#D8DEE9',
  'border-light': '#ECF0F4',
  'muted-bg': '#E0E5ED',
  'hover': '#E2E8F0',
  'active': '#CBD5E1',
  'danger': '#EF4444',
  'success': '#22C55E',
  'warning': '#F59E0B',
  'info': '#3B82F6',
};

/** User-friendly group names for the color editor. */
export const TOKEN_GROUPS: { label: string; tokens: readonly CustomThemeToken[] }[] = [
  { label: 'Marca', tokens: ['brand-primary', 'brand-primary-light', 'brand-primary-dark'] },
  { label: 'Superfícies', tokens: ['brand-background', 'brand-surface', 'muted-bg', 'hover', 'active'] },
  { label: 'Texto', tokens: ['text-primary', 'text-secondary', 'text-muted'] },
  { label: 'Bordas', tokens: ['border-color', 'border-light'] },
  { label: 'Status', tokens: ['danger', 'success', 'warning', 'info'] },
];

/** Human-readable token label keys. */
export const TOKEN_LABEL_KEYS: Record<CustomThemeToken, string> = {
  'brand-primary': 'Primária',
  'brand-primary-light': 'Primária clara',
  'brand-primary-dark': 'Primária escura',
  'brand-background': 'Fundo',
  'brand-surface': 'Superfície',
  'text-primary': 'Texto primário',
  'text-secondary': 'Texto secundário',
  'text-muted': 'Texto suave',
  'border-color': 'Borda',
  'border-light': 'Borda clara',
  'muted-bg': 'Fundo suave',
  'hover': 'Realce',
  'active': 'Ativo',
  'danger': 'Perigo',
  'success': 'Sucesso',
  'warning': 'Aviso',
  'info': 'Informação',
};

/** Pre-built hex palettes for each built-in theme (to allow "copy from theme"). */
export const THEME_PRESETS: Record<Exclude<ThemeID, 'custom'>, Record<CustomThemeToken, string>> = {
  light: { ...DEFAULT_CUSTOM_COLORS },
  cloudy: {
    'brand-primary': '#4B7BCC',
    'brand-primary-light': '#6B96D4',
    'brand-primary-dark': '#3960A6',
    'brand-background': '#313845',
    'brand-surface': '#3F4654',
    'text-primary': '#E5E8ED',
    'text-secondary': '#A1A8B5',
    'text-muted': '#767D8A',
    'border-color': '#515868',
    'border-light': '#3A4050',
    'muted-bg': '#353C49',
    'hover': '#515868',
    'active': '#5C6375',
    'danger': '#E64D4D',
    'success': '#40B06A',
    'warning': '#D9A030',
    'info': '#5A9AE6',
  },
  dark: {
    'brand-primary': '#5B9BF6',
    'brand-primary-light': '#85B5F6',
    'brand-primary-dark': '#3B7CE8',
    'brand-background': '#141C2B',
    'brand-surface': '#1C2A3D',
    'text-primary': '#F0F4F8',
    'text-secondary': '#94A3B8',
    'text-muted': '#6B7A8D',
    'border-color': '#2E3D52',
    'border-light': '#232F40',
    'muted-bg': '#19222F',
    'hover': '#2E3D52',
    'active': '#3A4E68',
    'danger': '#F06565',
    'success': '#4ADE7B',
    'warning': '#E8A840',
    'info': '#5EA3F0',
  },
  amber: {
    'brand-primary': '#D4882A',
    'brand-primary-light': '#D9A050',
    'brand-primary-dark': '#B36A14',
    'brand-background': '#18120B',
    'brand-surface': '#271E14',
    'text-primary': '#E8D5B8',
    'text-secondary': '#A08A6A',
    'text-muted': '#6B5A42',
    'border-color': '#3D3124',
    'border-light': '#2E2419',
    'muted-bg': '#1A1308',
    'hover': '#3D3124',
    'active': '#4D3E2E',
    'danger': '#D45A5A',
    'success': '#3DA85E',
    'warning': '#C9883E',
    'info': '#D48830',
  },
};

/**
 * Reads persisted theme from localStorage.
 * Falls back to 'amber' (default theme) if nothing stored.
 */
export function getStoredTheme(): ThemeID {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && THEME_OPTIONS.includes(stored as ThemeID))
    return stored as ThemeID;

  return 'amber';
}

/** Converts hex (#RRGGBB) to HSL string "H S% L%" for CSS variables. */
function hexToHSL(pHex: string): string {
  const hex = pHex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min)
    return `0 0% ${Math.round(l * 100)}%`;

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Apply custom theme CSS variables to the document root. */
function applyCustomColors(pColors: Record<CustomThemeToken, string>): void {
  const root = document.documentElement;
  for (const token of CUSTOM_THEME_TOKENS) {
    const hex = pColors[token];
    if (hex)
      root.style.setProperty(`--${token}`, hexToHSL(hex));
  }

  // Derive computed tokens from the custom values
  root.style.setProperty('--popover-bg', hexToHSL(pColors['brand-surface']));
  root.style.setProperty('--popover-border', hexToHSL(pColors['border-color']));
  root.style.setProperty('--popover-footer-bg', hexToHSL(pColors['brand-background']));

  // Derive status backgrounds (lighter versions)
  root.style.setProperty('--danger-bg', hexToHSL(pColors['danger']) .replace(/(\d+)%$/, (_, l) => `${Math.min(97, parseInt(l) + 37)}%`));
  root.style.setProperty('--success-bg', hexToHSL(pColors['success']).replace(/(\d+)%$/, (_, l) => `${Math.min(97, parseInt(l) + 37)}%`));
  root.style.setProperty('--warning-bg', hexToHSL(pColors['warning']).replace(/(\d+)%$/, (_, l) => `${Math.min(97, parseInt(l) + 37)}%`));
  root.style.setProperty('--info-bg', hexToHSL(pColors['info'])   .replace(/(\d+)%$/, (_, l) => `${Math.min(97, parseInt(l) + 37)}%`));

  // Detect light vs dark and set color-scheme
  const bgLightness = parseInt(hexToHSL(pColors['brand-background']).split(' ').pop()!);
  root.style.setProperty('color-scheme', bgLightness > 50 ? 'light' : 'dark');
}

/** Remove custom inline CSS variables from document root. */
function clearCustomColors(): void {
  const root = document.documentElement;
  for (const token of CUSTOM_THEME_TOKENS)
    root.style.removeProperty(`--${token}`);

  root.style.removeProperty('--popover-bg');
  root.style.removeProperty('--popover-border');
  root.style.removeProperty('--popover-footer-bg');
  root.style.removeProperty('--danger-bg');
  root.style.removeProperty('--success-bg');
  root.style.removeProperty('--warning-bg');
  root.style.removeProperty('--info-bg');
  root.style.removeProperty('color-scheme');
}

/** Get persisted custom theme colors. */
export function getCustomThemeColors(): Record<CustomThemeToken, string> {
  try {
    const stored = localStorage.getItem(CUSTOM_THEME_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as CustomThemeColors;
      return { ...DEFAULT_CUSTOM_COLORS, ...parsed };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_CUSTOM_COLORS };
}

/** Save custom theme colors to localStorage. */
export function saveCustomThemeColors(pColors: Record<CustomThemeToken, string>): void {
  localStorage.setItem(CUSTOM_THEME_KEY, JSON.stringify(pColors));
  // If currently on custom theme, re-apply
  if (getStoredTheme() === 'custom')
    applyCustomColors(pColors);
}

/**
 * Applies theme to the document and persists to localStorage.
 */
export function applyTheme(pThemeID: ThemeID): void {
  // Clear any previous custom inline styles
  clearCustomColors();

  if (pThemeID === 'custom') {
    // Set base data-theme to light as fallback, then override with custom colors
    document.documentElement.setAttribute('data-theme', 'custom');
    applyCustomColors(getCustomThemeColors());
  } else {
    document.documentElement.setAttribute('data-theme', pThemeID);
  }

  localStorage.setItem(STORAGE_KEY, pThemeID);
}

/**
 * Initialize theme system — call once at app startup, before React renders.
 */
export function initTheme(): ThemeID {
  const theme = getStoredTheme();
  applyTheme(theme);
  return theme;
}

/**
 * Persist theme preference to backend (fire-and-forget).
 */
export async function persistThemeToBackend(pThemeID: ThemeID): Promise<void> {
  const token = getAccessToken();
  if (!token)
    return;

  try {
    await fetch('/api/sys/preferences/theme', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ theme: pThemeID }),
    });
  } catch {
    // Silent fail — localStorage is the primary persistence
  }
}
