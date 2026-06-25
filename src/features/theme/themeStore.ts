import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ThemeMode } from './types';

interface ThemeState {
  themeMode: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setThemeMode: (mode: ThemeMode) => void;
  setResolvedTheme: (theme: 'light' | 'dark') => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      themeMode: 'system',
      resolvedTheme: 'dark', // default fallback, will be computed
      setThemeMode: (mode) => set({ themeMode: mode }),
      setResolvedTheme: (theme) => set({ resolvedTheme: theme }),
    }),
    {
      name: 'nono-harness-theme-mode',
      // TODO: Migrate to settings table once settings API is integrated
      partialize: (state) => ({ themeMode: state.themeMode }),
    }
  )
);
