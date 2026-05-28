'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Locale, Translations } from './types';
import { en } from './en';
import { zhHant } from './zh-hant';
import { zh } from './zh';
import { ja } from './ja';
import type { LangMeta } from '../hooks/useLang';
import { directionForLang, LANGS } from '../hooks/useLang';

const TRANSLATIONS: Record<Locale, Translations> = {
  en,
  'zh-hant': zhHant,
  zh,
  ja,
};

const STORAGE_KEY = 'pm-lang';

function readStoredLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return (stored && stored in TRANSLATIONS) ? (stored as Locale) : 'en';
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (id: Locale) => void;
  t: Translations;
  langs: LangMeta[];
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale);

  useEffect(() => {
    document.documentElement.setAttribute('lang', locale);
    document.documentElement.setAttribute('dir', directionForLang(locale));
  }, [locale]);

  const setLocale = (id: Locale) => {
    setLocaleState(id);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, id);
    }
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t: TRANSLATIONS[locale], langs: LANGS }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
