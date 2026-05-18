'use client';

import { useState } from 'react';

/** Locale codes match Hermes's i18n/types.ts Locale union (subset). */
export type LangId = 'en' | 'zh-hant' | 'zh' | 'ja';

export interface LangMeta {
  id: LangId;
  /** Short label shown in the sidebar chip */
  label: string;
  /** Full display name (tooltip) */
  name: string;
  /** Flag emoji */
  flag: string;
}

export const LANGS: LangMeta[] = [
  { id: 'en',      label: 'EN',   name: 'English',            flag: '🇬🇧' },
  { id: 'zh-hant', label: '繁中', name: '繁體中文',             flag: '🇹🇼' },
  { id: 'zh',      label: '简中', name: '简体中文',             flag: '🇨🇳' },
  { id: 'ja',      label: 'JA',   name: '日本語',              flag: '🇯🇵' },
];

const STORAGE_KEY = 'pm-lang';

export function useLang() {
  const [lang, setLangState] = useState<LangId>(() => {
    if (typeof window === 'undefined') return 'en';
    return (window.localStorage.getItem(STORAGE_KEY) as LangId) ?? 'en';
  });

  const setLang = (id: LangId) => {
    setLangState(id);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, id);
      document.documentElement.setAttribute('lang', id);
    }
  };

  return { lang, setLang, langs: LANGS };
}
