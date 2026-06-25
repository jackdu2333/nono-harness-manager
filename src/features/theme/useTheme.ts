import { useEffect } from 'react';
import { useThemeStore } from './themeStore';

export function useTheme() {
  const { themeMode, setResolvedTheme } = useThemeStore();

  useEffect(() => {
    const root = window.document.documentElement;

    if (themeMode === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.remove('light', 'dark');
      root.classList.add(systemTheme);
      setResolvedTheme(systemTheme);

      const listener = (e: MediaQueryListEvent) => {
        const newTheme = e.matches ? 'dark' : 'light';
        root.classList.remove('light', 'dark');
        root.classList.add(newTheme);
        setResolvedTheme(newTheme);
      };

      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    } else {
      root.classList.remove('light', 'dark');
      root.classList.add(themeMode);
      setResolvedTheme(themeMode);
    }
  }, [themeMode, setResolvedTheme]);
}
