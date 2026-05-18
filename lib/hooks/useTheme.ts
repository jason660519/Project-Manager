'use client';

import { useEffect, useState } from 'react';

export type ThemeId = 'emerald' | 'midnight' | 'ember' | 'mono';

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  description: string;
  /** Two hex colors for the mini swatch preview */
  swatch: [string, string];
}

export const THEMES: ThemeMeta[] = [
  {
    id: 'emerald',
    label: 'Emerald',
    description: 'Classic dark emerald — the canonical PM look',
    swatch: ['#071b18', '#6ee7b7'],
  },
  {
    id: 'midnight',
    label: 'Midnight',
    description: 'Deep blue-violet with cool accents',
    swatch: ['#0a0a1f', '#a78bfa'],
  },
  {
    id: 'ember',
    label: 'Ember',
    description: 'Warm crimson and bronze — forge vibes',
    swatch: ['#1a0a06', '#fb923c'],
  },
  {
    id: 'mono',
    label: 'Mono',
    description: 'Clean grayscale — minimal and focused',
    swatch: ['#0e0e0e', '#e5e5e5'],
  },
];

const STORAGE_KEY = 'pm-theme';

function applyThemeToDom(id: ThemeId) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', id === 'emerald' ? '' : id);
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    if (typeof window === 'undefined') return 'emerald';
    return (window.localStorage.getItem(STORAGE_KEY) as ThemeId) ?? 'emerald';
  });

  useEffect(() => {
    applyThemeToDom(theme);
  }, [theme]);

  const setTheme = (id: ThemeId) => {
    setThemeState(id);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, id);
    }
  };

  return { theme, setTheme, themes: THEMES };
}
