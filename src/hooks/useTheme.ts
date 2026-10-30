import { useState, useCallback } from 'react';
import { applyTheme, getStoredTheme, persistThemeToBackend, type ThemeID } from '@core/lib/themeService';

/**
 * React hook for reading and changing the current theme.
 * Persists to localStorage immediately and to backend async.
 */
export function useTheme(): { currentTheme: ThemeID; changeTheme: (pThemeID: ThemeID) => void } {
  const [currentTheme, setCurrentTheme] = useState<ThemeID>(getStoredTheme);

  const changeTheme = useCallback((pThemeID: ThemeID): void => {
    if (pThemeID === currentTheme)
      return;

    applyTheme(pThemeID);
    setCurrentTheme(pThemeID);
    persistThemeToBackend(pThemeID);
  }, [currentTheme]);

  return { currentTheme, changeTheme };
}
