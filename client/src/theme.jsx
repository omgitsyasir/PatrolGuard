import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export const THEME_MODES = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System Default' },
];

export const PALETTES = [
  { id: 'emerald', label: 'Tactical Green', swatch: '#10b981' },
  { id: 'navy', label: 'Security Blue', swatch: '#2563eb' },
  { id: 'amber', label: 'Warning Amber', swatch: '#f59e0b' },
  { id: 'slate', label: 'Slate Steel', swatch: '#64748b' },
];

const STORAGE_KEY = 'patrolguard-theme';

export function applyTheme(mode, palette) {
  const root = document.documentElement;
  const resolved =
    mode === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : mode || 'light';
  root.setAttribute('data-theme', resolved);
  root.classList.toggle('dark', resolved === 'dark');
  if (palette) root.setAttribute('data-palette', palette);
}

export function loadThemePrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return null;
}

export function saveThemePrefs(mode, palette) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, palette }));
  } catch {
    /* ignore */
  }
}

const ThemeCtx = createContext(null);

export function ThemeProvider({ children }) {
  const prefs = loadThemePrefs();
  const [mode, setMode] = useState(prefs?.mode || 'system');
  const [palette, setPalette] = useState(prefs?.palette || 'emerald');

  useEffect(() => {
    applyTheme(mode, palette);
  }, [mode, palette]);

  useEffect(() => {
    if (mode === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme('system', palette);
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [mode, palette]);

  const setTheme = useCallback(
    (nextMode, nextPalette) => {
      if (nextMode) setMode(nextMode);
      if (nextPalette) setPalette(nextPalette);
      saveThemePrefs(nextMode || mode, nextPalette || palette);
    },
    [mode, palette]
  );

  return <ThemeCtx.Provider value={{ mode, palette, setTheme }}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}