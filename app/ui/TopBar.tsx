'use client';

import { ChevronDown, Search, Zap } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTheme, THEMES } from '../../lib/hooks/useTheme';
import { useI18n } from '../../lib/i18n';
import { ViewId } from '../../lib/types';

const VIEW_LABELS: Record<ViewId, string> = {
  projects:            'Projects',
  dashboard:           'Project Progress Dashboard',
  'project-files':     'Project Files',
  plugins:             'Plugins',
  engineers:           'AI Engineers',
  sessions:            'Sessions',
  channels:            'Channels',
  'cron-jobs':         'Cron Jobs',
  skills:              'Skills',
  logs:                'Logs',
  documentation:       'Documentation',
  keys:                'Keys',
  chat:                'AI Assistant',
  'keyboard-shortcuts': 'Keyboard Shortcuts',
  settings:            'Settings',
  features:            'Features',
};

interface TopBarProps {
  currentView: ViewId;
  activeRunCount: number;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
}

export function TopBar({ currentView, activeRunCount, searchValue = '', onSearchChange }: TopBarProps) {
  const { theme, setTheme } = useTheme();
  const { locale: lang, setLocale: setLang, langs: LANGS } = useI18n();

  const [themeOpen, setThemeOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const themeRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) setThemeOpen(false);
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const currentTheme = THEMES.find((t) => t.id === theme) ?? THEMES[0];
  const currentLang  = LANGS.find((l) => l.id === lang)   ?? LANGS[0];

  return (
    <div className="flex h-12 items-center justify-between border-b border-stone-200/15 px-5">
      <h1 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-100">
        {VIEW_LABELS[currentView] ?? currentView}
      </h1>

      <div className="flex items-center gap-2">
        {activeRunCount > 0 && (
          <div className="flex items-center gap-1.5 border border-cyan-400/30 bg-cyan-950/40 px-2.5 py-1">
            <Zap size={10} className="text-cyan-400 animate-pulse" />
            <span className="text-[10px] font-medium tracking-[0.1em] text-cyan-300">
              {activeRunCount} RUNNING
            </span>
          </div>
        )}

        {/* Theme dropdown */}
        <div ref={themeRef} className="relative">
          <button
            onClick={() => { setThemeOpen((v) => !v); setLangOpen(false); }}
            className="flex items-center gap-1.5 border border-stone-200/15 px-2 py-1.5 hover:bg-white/5 transition-colors"
          >
            <span className="flex h-4 w-6 shrink-0 overflow-hidden border border-stone-200/20">
              <span className="h-full w-1/2" style={{ background: currentTheme.swatch[0] }} />
              <span className="h-full w-1/2" style={{ background: currentTheme.swatch[1] }} />
            </span>
            <span className="text-[9px] font-medium uppercase tracking-[0.1em] text-stone-300/70">
              {currentTheme.label}
            </span>
            <ChevronDown size={9} className={`shrink-0 text-stone-500 transition-transform ${themeOpen ? 'rotate-180' : ''}`} />
          </button>

          {themeOpen && (
            <div
              className="absolute right-0 top-full mt-1 w-52 border border-stone-200/15 shadow-xl z-50"
              style={{ background: 'var(--pm-sidebar)' }}
            >
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setTheme(t.id); setThemeOpen(false); }}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 hover:bg-white/5 transition-colors text-left"
                >
                  <span className="flex h-5 w-8 shrink-0 overflow-hidden border border-stone-200/20">
                    <span className="h-full w-1/2" style={{ background: t.swatch[0] }} />
                    <span className="h-full w-1/2" style={{ background: t.swatch[1] }} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-200/85">
                      {t.label}
                    </span>
                    <span className="block text-[9px] text-stone-500/70 leading-tight mt-0.5 truncate">
                      {t.description}
                    </span>
                  </span>
                  {theme === t.id && <span className="text-[10px] text-stone-300/60 shrink-0">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Lang dropdown */}
        <div ref={langRef} className="relative">
          <button
            onClick={() => { setLangOpen((v) => !v); setThemeOpen(false); }}
            className="flex items-center gap-1 border border-stone-200/15 px-2 py-1.5 hover:bg-white/5 transition-colors"
          >
            <span className="text-[12px] leading-none">{currentLang.flag}</span>
            <span className="text-[9px] font-medium uppercase tracking-[0.1em] text-stone-300/70">{currentLang.label}</span>
            <ChevronDown size={9} className={`shrink-0 text-stone-500 transition-transform ${langOpen ? 'rotate-180' : ''}`} />
          </button>

          {langOpen && (
            <div
              className="absolute right-0 top-full mt-1 w-40 border border-stone-200/15 shadow-xl z-50"
              style={{ background: 'var(--pm-sidebar)' }}
            >
              {LANGS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => { setLang(l.id); setLangOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors text-left"
                >
                  <span className="text-[13px] leading-none shrink-0">{l.flag}</span>
                  <span className="flex-1 text-[10px] text-stone-300/80">{l.name}</span>
                  {lang === l.id && <span className="text-[10px] text-stone-300/60 shrink-0">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 border border-stone-200/15 bg-stone-900/40 px-2.5 py-1.5">
          <Search size={11} className="text-stone-500 shrink-0" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="Search..."
            className="w-44 bg-transparent text-[11px] text-stone-200 placeholder-stone-600 outline-none"
          />
        </div>
      </div>
    </div>
  );
}
