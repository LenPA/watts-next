export type ThemeId = 'dark-performance' | 'ice-blue-pink';

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  description: string;
  mode: 'light' | 'dark';
  previewColors: {
    background: string;
    surface: string;
    primary: string;
  };
}

export const THEME_STORAGE_KEY = 'watts-next-theme';
export const DEFAULT_THEME_ID: ThemeId = 'ice-blue-pink';

export const THEMES: ThemeConfig[] = [
  {
    id: 'ice-blue-pink',
    name: 'Ice Blue & Pink',
    description: 'Fris lichtblauw met sportieve roze accenten',
    mode: 'light',
    previewColors: {
      background: '#EAF4FF',
      surface: '#FFFFFF',
      primary: '#EC4899'
    }
  },
  {
    id: 'dark-performance',
    name: 'Dark Performance',
    description: 'Donker en sportief met oranje Strava accenten',
    mode: 'dark',
    previewColors: {
      background: '#141824',
      surface: '#1c2232',
      primary: '#fc4c02'
    }
  }
];

export function getStoredTheme(): ThemeId {
  if (typeof window === 'undefined') return DEFAULT_THEME_ID;
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null;
    if (saved && THEMES.some(t => t.id === saved)) {
      return saved;
    }
  } catch {
    // fallback if localStorage is disabled
  }
  return DEFAULT_THEME_ID;
}

export function setStoredTheme(themeId: ThemeId): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, themeId);
  } catch {
    // ignore
  }
}

export function applyTheme(themeId: ThemeId): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', themeId);
}
