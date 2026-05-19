'use client';

import { useEffect, useState } from 'react';

export type ThemeId = 'emerald' | 'midnight' | 'ember' | 'mono';

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  description: string;
  /** Two CSS color values for the mini swatch preview */
  swatch: [string, string];
}

export const THEMES: ThemeMeta[] = [
  {
    id: 'emerald',
    label: 'Emerald',
    description: 'Classic dark emerald — the canonical PM look',
    swatch: ['rgb(var(--pm-bg-rgb))', 'rgb(110 231 183)'],
  },
  {
    id: 'midnight',
    label: 'Midnight',
    description: 'Deep blue-violet with cool accents',
    swatch: ['rgb(10 10 31)', 'rgb(167 139 250)'],
  },
  {
    id: 'ember',
    label: 'Ember',
    description: 'Warm crimson and bronze — forge vibes',
    swatch: ['rgb(26 10 6)', 'rgb(251 146 60)'],
  },
  {
    id: 'mono',
    label: 'Mono',
    description: 'Clean grayscale — minimal and focused',
    swatch: ['rgb(14 14 14)', 'rgb(229 229 229)'],
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
