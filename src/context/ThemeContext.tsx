import { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from 'react';
import {
  type ThemeId,
  type ThemeConfig,
  THEMES,
  getStoredTheme,
  setStoredTheme,
  applyTheme
} from '../lib/theme';

interface ThemeContextType {
  theme: ThemeId;
  setTheme: (id: ThemeId) => void;
  toggleTheme: () => void;
  themes: ThemeConfig[];
  activeThemeConfig: ThemeConfig;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() => getStoredTheme());

  useEffect(() => {
    applyTheme(theme);
    setStoredTheme(theme);
  }, [theme]);

  const setTheme = (id: ThemeId) => {
    setThemeState(id);
  };

  const toggleTheme = () => {
    setThemeState((prev: ThemeId) => (prev === 'dark-performance' ? 'ice-blue-pink' : 'dark-performance'));
  };

  const activeThemeConfig = useMemo(() => {
    return THEMES.find(t => t.id === theme) || THEMES[0];
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
      themes: THEMES,
      activeThemeConfig
    }),
    [theme, activeThemeConfig]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
