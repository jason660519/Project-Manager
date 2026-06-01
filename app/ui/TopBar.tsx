'use client';

import { Bot, ChevronDown, HelpCircle, Search, Zap } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { useTheme, THEMES } from '../../lib/hooks/useTheme';
import { useI18n } from '../../lib/i18n';
import { ViewId } from '../../lib/types';
import type { ChatContext } from '../../lib/chat/types';
import { ChatPanel } from '../../components/chat/ChatPanel';
import { openExternalUrl } from '../../lib/bridge';
import { docsUrlForView } from '../../lib/docsRegistry';

const VIEW_LABELS: Record<ViewId, string> = {
  dashboard:           'Project Progress Dashboard',
  'integrations-hub':  'Integrations Hub',
  xmux:                'xmux',
  engineers:           'AI Engineers',
  sessions:            'Sessions',
  channels:            'Channels',
  'cron-jobs':         'Cron Jobs',
  logs:                'Logs',
  documentation:       'Documentation',
  'company-standards': 'Company Standards',
  keys:                'Keys',
  'ai-sdks':           'AI SDKs',
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
  chatContext: ChatContext;
}

// ── Draggable panel position (persisted) ───────────────────────────────────

const POSITION_KEY = 'pm-chat-position';
const SIZE_KEY = 'pm-chat-size';
const DEFAULT_CHAT_SIZE = { width: 340, height: 420 };
const MIN_CHAT_SIZE = { width: 300, height: 280 };
const VIEWPORT_MARGIN = 12;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function loadPosition(): { x: number; y: number } {
  if (typeof window === 'undefined') return { x: 100, y: 80 };
  try {
    const raw = window.localStorage.getItem(POSITION_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { x: 100, y: 80 };
}

function savePosition(pos: { x: number; y: number }) {
  try { window.localStorage.setItem(POSITION_KEY, JSON.stringify(pos)); } catch { /* ignore */ }
}

function loadSize(): { width: number; height: number } {
  if (typeof window === 'undefined') return DEFAULT_CHAT_SIZE;
  try {
    const raw = window.localStorage.getItem(SIZE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<typeof DEFAULT_CHAT_SIZE>;
      if (Number.isFinite(parsed.width) && Number.isFinite(parsed.height)) {
        return {
          width: Math.max(MIN_CHAT_SIZE.width, Number(parsed.width)),
          height: Math.max(MIN_CHAT_SIZE.height, Number(parsed.height)),
        };
      }
    }
  } catch { /* ignore */ }
  return DEFAULT_CHAT_SIZE;
}

function saveSize(size: { width: number; height: number }) {
  try { window.localStorage.setItem(SIZE_KEY, JSON.stringify(size)); } catch { /* ignore */ }
}

// ────────────────────────────────────────────────────────────────────────────

export function TopBar({ currentView, activeRunCount, searchValue = '', onSearchChange, chatContext }: TopBarProps) {
  const { theme, setTheme } = useTheme();
  const { locale: lang, setLocale: setLang, langs: LANGS } = useI18n();

  const [themeOpen, setThemeOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatPos, setChatPos] = useState(loadPosition);
  const [chatSize, setChatSize] = useState(loadSize);
  const themeRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{
    startX: number;
    startY: number;
    origWidth: number;
    origHeight: number;
    originLeft: number;
    originTop: number;
  } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(chatPos);
  const sizeRef = useRef(chatSize);
  posRef.current = chatPos;
  sizeRef.current = chatSize;

  // ── Drag logic ──────────────────────────────────────────────────────────
  const handleDragStart = useCallback((e: ReactMouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('[data-drag-handle]')) return;
    e.preventDefault();

    const current = posRef.current;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: current.x,
      origY: current.y,
    };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      const size = sizeRef.current;
      setChatPos({
        x: clamp(
          dragRef.current.origX + dx,
          0,
          Math.max(0, window.innerWidth - size.width - VIEWPORT_MARGIN),
        ),
        y: clamp(
          dragRef.current.origY + dy,
          0,
          Math.max(0, window.innerHeight - size.height - VIEWPORT_MARGIN),
        ),
      });
    };

    const onUp = () => {
      if (!dragRef.current) return;
      savePosition(posRef.current);
      dragRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  const handleResizeStart = useCallback((e: ReactMouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('[data-resize-handle]')) return;
    e.preventDefault();
    e.stopPropagation();

    const current = sizeRef.current;
    const position = posRef.current;
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origWidth: current.width,
      origHeight: current.height,
      originLeft: position.x,
      originTop: position.y,
    };

    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const dx = ev.clientX - resizeRef.current.startX;
      const dy = ev.clientY - resizeRef.current.startY;
      const maxWidth = Math.max(
        MIN_CHAT_SIZE.width,
        window.innerWidth - resizeRef.current.originLeft - VIEWPORT_MARGIN,
      );
      const maxHeight = Math.max(
        MIN_CHAT_SIZE.height,
        window.innerHeight - resizeRef.current.originTop - VIEWPORT_MARGIN,
      );
      setChatSize({
        width: clamp(resizeRef.current.origWidth + dx, MIN_CHAT_SIZE.width, maxWidth),
        height: clamp(resizeRef.current.origHeight + dy, MIN_CHAT_SIZE.height, maxHeight),
      });
    };

    const onUp = () => {
      if (!resizeRef.current) return;
      saveSize(sizeRef.current);
      resizeRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
    };

    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  // ── Click-outside close ─────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dragRef.current) return;
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) setThemeOpen(false);
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
      // For the floating panel: check if click is outside BOTH the toggle AND panel
      // Use the root topbar container as boundary so the toggle button isn't falsely
      // treated as outside.
      const toggle = document.getElementById('chat-toggle-btn');
      if (chatOpen && toggle && !toggle.contains(e.target as Node)) {
        if (resizeRef.current) return;
        // Only close if also outside the panel (if panel exists)
        if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
          setChatOpen(false);
        }
      }
    };
    // Use mouseup to avoid race with button's onClick
    document.addEventListener('mouseup', handler);
    return () => document.removeEventListener('mouseup', handler);
  }, [chatOpen]);

  const currentTheme = THEMES.find((t) => t.id === theme) ?? THEMES[0];
  const currentLang  = LANGS.find((l) => l.id === lang)   ?? LANGS[0];

  return (
    <div className="flex h-12 min-w-0 items-center justify-between gap-2 border-b border-stone-200/15 px-3 sm:px-5">
      <h1 className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-100">
        {VIEW_LABELS[currentView] ?? currentView}
      </h1>

      <div className="flex min-w-0 shrink-0 items-center gap-2">
        {activeRunCount > 0 && (
          <div className="flex items-center gap-1.5 border border-cyan-400/30 bg-cyan-950/40 px-2.5 py-1">
            <Zap size={10} className="text-cyan-400 animate-pulse" />
            <span className="text-[10px] font-medium tracking-[0.1em] text-cyan-300">
              {activeRunCount} RUNNING
            </span>
          </div>
        )}

        {/* ── Page help (opens docs in external browser) ─────────────────── */}
        <DocsHelpButton view={currentView} />

        {/* ── AI Assistant toggle ────────────────────────────────────────── */}
        <button
          id="chat-toggle-btn"
          onClick={() => { setChatOpen((v) => !v); setThemeOpen(false); setLangOpen(false); }}
          className="flex items-center gap-1.5 border border-stone-200/15 px-2 py-1.5 hover:bg-white/5 transition-colors"
          title="AI Assistant"
        >
          <Bot size={13} className={chatOpen ? 'text-amber-300' : 'text-stone-400'} />
          <span className="hidden text-[9px] font-medium uppercase tracking-[0.1em] text-stone-300/70 sm:inline">Assistant</span>
          <ChevronDown size={9} className={`shrink-0 text-stone-500 transition-transform ${chatOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* ── Floating draggable chat panel ──────────────────────────────── */}
        {chatOpen && (
          <div
            ref={panelRef}
            onMouseDown={handleDragStart}
            style={{
              left: chatPos.x,
              top: chatPos.y,
              width: chatSize.width,
              height: chatSize.height,
              position: 'fixed',
              zIndex: 9999,
            }}
            className="min-h-[280px] min-w-[300px]"
          >
            <ChatPanel
              context={chatContext}
              defaultExpanded={true}
              toggleOpen={setChatOpen}
            />
            <div
              role="separator"
              aria-label="Resize AI Assistant panel"
              data-resize-handle
              onMouseDown={handleResizeStart}
              className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize border-b border-r border-amber-200/40 bg-stone-900/80"
              title="Resize AI Assistant panel"
            />
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
            <span className="hidden text-[9px] font-medium uppercase tracking-[0.1em] text-stone-300/70 sm:inline">
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
        <div className="hidden items-center gap-2 border border-stone-200/15 bg-stone-900/40 px-2.5 py-1.5 md:flex">
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

// ── Docs help button ────────────────────────────────────────────────────────
//
// Opens the current view's documentation page in the user's system browser.
// Tauri: routes through tauri-plugin-shell `open` (scope-gated). Web preview:
// falls back to window.open. Disabled if no docs URL is mapped for this view.

function DocsHelpButton({ view }: { view: ViewId }) {
  const url = docsUrlForView(view);
  const enabled = url !== null;
  const handleClick = useCallback(() => {
    if (!url) return;
    openExternalUrl(url).catch((err) => {
      // Surface failures (e.g. capability-scope rejection) loudly rather
      // than silently — debugging a missing scope entry is otherwise opaque.
      console.error('[TopBar] openExternalUrl failed', err);
    });
  }, [url]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!enabled}
      aria-label={enabled ? 'Open documentation for this page' : 'No documentation available for this page'}
      title={enabled ? `Open page docs: ${url}` : 'Documentation coming soon'}
      className="flex items-center gap-1.5 border border-stone-200/15 px-2 py-1.5 hover:bg-white/5 transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
    >
      <HelpCircle size={13} className="text-stone-400" />
      <span className="hidden text-[9px] font-medium uppercase tracking-[0.1em] text-stone-300/70 sm:inline">Help</span>
    </button>
  );
}
