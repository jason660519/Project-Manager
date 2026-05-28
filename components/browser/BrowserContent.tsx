'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Braces,
  Camera,
  Chrome,
  Clipboard,
  Code2,
  Cookie,
  Copy,
  Crosshair,
  Database,
  ExternalLink,
  History,
  Info,
  Minus,
  MoreHorizontal,
  Plus,
  RotateCcw,
  TerminalSquare,
} from 'lucide-react';
import { deriveBrowserLabel } from '../terminal/blockLayout';
import { openExternalUrl } from '../../lib/bridge';
import {
  formatXmuxSelectedElementSnippet,
  isXmuxSelectedElementPayload,
  setXmuxSnippetDragData,
} from '../../lib/xmux/selectedElementSnippet';
import { BrowserSlot } from './BrowserSlot';
import {
  backendKind,
  clearNativeConsoleEntries,
  clearNativeBrowsingData,
  clearNativeCookies,
  evalNativeBrowserScript,
  getEmbedFailure,
  getNativeConsoleEntries,
  getNativeCurrentUrl,
  retryNativeEmbed,
  reloadNativeBrowser,
  selectNativeBrowserElement,
  setNativeBrowserZoom,
  sessionKind,
} from './BrowserRegistry';

export const deriveBrowserTabLabel = deriveBrowserLabel;

type BrowserStatus = {
  tone: 'info' | 'success' | 'warning' | 'error';
  message: string;
} | null;

type BrowserConsoleLevel = 'debug' | 'log' | 'info' | 'warn' | 'error';

type BrowserConsoleEntry = {
  id: string;
  timestamp: string;
  kind: 'console' | 'exception' | 'rejection' | 'network';
  level: BrowserConsoleLevel;
  message: string;
  args: string[];
  url: string;
  line: number | null;
  column: number | null;
  status: number | null;
  method: string | null;
};

type CssInspectorTab = 'design' | 'css';

type DomTreeNode = {
  tag?: string;
  id?: string;
  className?: string;
  role?: string;
  ariaLabel?: string;
  text?: string;
  attributes?: Record<string, unknown>;
  children?: DomTreeNode[];
};

type BoxSide = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

type CssInspectorPayload = {
  positionTag?: string;
  selector?: string;
  cssPath?: string;
  url?: string;
  elementTag?: string;
  classList?: string[];
  domTree?: DomTreeNode;
  ancestry?: DomTreeNode[];
  boxModel?: {
    rect?: { x?: number; y?: number; top?: number; right?: number; bottom?: number; left?: number; width?: number; height?: number };
    margin?: BoxSide;
    border?: BoxSide;
    padding?: BoxSide;
    content?: { width?: number; height?: number };
  };
  computedStyle?: Record<string, string>;
  computedStyleSummary?: Record<string, string>;
  outerHTML?: string;
};

function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^about:/i.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
}

// localhost / same-origin dev URLs embed cleanly in iframe; remote sites need the
// native Tauri webview (cmux-style) or "open externally" fallback.
function isLikelyEmbeddable(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname;
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host.endsWith('.local')
    ) {
      return true;
    }
    if (u.port === '43187') return true;
    if (typeof window !== 'undefined' && u.host === window.location.host) {
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

function statusClass(tone: NonNullable<BrowserStatus>['tone']): string {
  if (tone === 'success') return 'border-emerald-500/30 bg-emerald-950/35 text-emerald-100';
  if (tone === 'warning') return 'border-amber-500/30 bg-amber-950/35 text-amber-100';
  if (tone === 'error') return 'border-red-500/30 bg-red-950/35 text-red-100';
  return 'border-sky-500/25 bg-sky-950/35 text-sky-100';
}

function parseSelectElementPayload(raw: string): unknown {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
  } catch {
    return { raw };
  }
}

function parseCssInspectorPayload(payload: unknown): CssInspectorPayload | null {
  if (!isXmuxSelectedElementPayload(payload)) return null;
  return payload as CssInspectorPayload;
}

function parseConsoleEntries(raw: string): BrowserConsoleEntry[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    const entries = typeof parsed === 'string' ? JSON.parse(parsed) as unknown : parsed;
    if (!Array.isArray(entries)) return [];
    return entries.flatMap((entry): BrowserConsoleEntry[] => {
      if (!entry || typeof entry !== 'object') return [];
      const value = entry as Record<string, unknown>;
      const level = typeof value.level === 'string' ? value.level : 'log';
      const kind = typeof value.kind === 'string' ? value.kind : 'console';
      return [{
        id: typeof value.id === 'string' ? value.id : `${value.timestamp ?? Date.now()}-${Math.random()}`,
        timestamp: typeof value.timestamp === 'string' ? value.timestamp : new Date().toISOString(),
        kind: kind === 'exception' || kind === 'rejection' || kind === 'network' ? kind : 'console',
        level: level === 'debug' || level === 'info' || level === 'warn' || level === 'error' ? level : 'log',
        message: typeof value.message === 'string' ? value.message : '',
        args: Array.isArray(value.args) ? value.args.map((arg) => String(arg)) : [],
        url: typeof value.url === 'string' ? value.url : '',
        line: typeof value.line === 'number' ? value.line : null,
        column: typeof value.column === 'number' ? value.column : null,
        status: typeof value.status === 'number' ? value.status : null,
        method: typeof value.method === 'string' ? value.method : null,
      }];
    });
  } catch {
    return [];
  }
}

function consoleLevelClass(level: BrowserConsoleLevel): string {
  if (level === 'error') return 'border-red-500/25 bg-red-950/25 text-red-100';
  if (level === 'warn') return 'border-amber-500/25 bg-amber-950/25 text-amber-100';
  if (level === 'info') return 'border-sky-500/20 bg-sky-950/20 text-sky-100';
  return 'border-stone-800 bg-stone-950/30 text-stone-200';
}

function IconButton({
  active = false,
  activeClassName,
  onClick,
  title,
  ariaLabel,
  children,
}: {
  active?: boolean;
  activeClassName?: string;
  onClick: () => void;
  title: string;
  ariaLabel: string;
  children: ReactNode;
}) {
  const activeClasses = activeClassName ?? 'border-sky-400/60 bg-sky-400/15 text-sky-100';
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex h-6 w-6 shrink-0 items-center justify-center border text-stone-300 hover:border-stone-500 hover:text-stone-100',
        active ? activeClasses : 'border-stone-700',
      ].join(' ')}
      aria-label={ariaLabel}
      aria-pressed={active}
      title={title}
    >
      {children}
    </button>
  );
}

export function BrowserContent({
  itemId,
  url,
  homepageUrl,
  isActive = true,
  onNavigate,
}: {
  itemId: string;
  url: string;
  homepageUrl: string;
  isActive?: boolean;
  onNavigate: (url: string) => void;
}) {
  const [draftUrl, setDraftUrl] = useState(url);
  const [embedRetryKey, setEmbedRetryKey] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [status, setStatus] = useState<BrowserStatus>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [consoleEntries, setConsoleEntries] = useState<BrowserConsoleEntry[]>([]);
  const [consoleFilter, setConsoleFilter] = useState('');
  const [consoleError, setConsoleError] = useState<string | null>(null);
  const [cssInspectorOpen, setCssInspectorOpen] = useState(false);
  const [cssInspectorTab, setCssInspectorTab] = useState<CssInspectorTab>('design');
  const [cssInspectorPayload, setCssInspectorPayload] = useState<CssInspectorPayload | null>(null);
  const [selectedDragContext, setSelectedDragContext] = useState<{
    snippet: string;
    payload: CssInspectorPayload;
  } | null>(null);
  const browserPaneRef = useRef<HTMLDivElement>(null);
  const selectSessionRef = useRef(0);

  useEffect(() => {
    setDraftUrl(url);
  }, [itemId, url]);

  const embedFailure = getEmbedFailure(itemId);
  const inTauri = backendKind() === 'tauri';
  const nativeActive = sessionKind(itemId) === 'tauri';

  const showBlockedHint = useMemo(() => {
    if (nativeActive) return false;
    if (inTauri) return true;
    return !isLikelyEmbeddable(url);
  }, [nativeActive, inTauri, url]);

  const hintIsNativeFallback = inTauri && !nativeActive;

  const nativeUnavailable = useCallback(
    (action: string) => {
      setStatus({
        tone: 'warning',
        message: `${action} requires the Tauri native Xmux browser. Browser preview cannot control embedded remote pages.`,
      });
    },
    [],
  );

  useEffect(() => {
    if (!consoleOpen) return;
    if (!nativeActive) {
      setConsoleError('Console requires the Tauri native Xmux browser. Browser preview cannot read remote page logs.');
      setConsoleEntries([]);
      return;
    }

    let cancelled = false;
    const refresh = () => {
      void getNativeConsoleEntries(itemId)
        .then((raw) => {
          if (cancelled) return;
          setConsoleEntries(parseConsoleEntries(raw));
          setConsoleError(null);
        })
        .catch((err) => {
          if (cancelled) return;
          const message = err instanceof Error ? err.message : String(err);
          setConsoleError(message);
        });
    };

    refresh();
    const interval = window.setInterval(refresh, 1200);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [consoleOpen, itemId, nativeActive]);

  useEffect(() => {
    const handleSelectedElement = (event: Event) => {
      const payload = parseCssInspectorPayload((event as CustomEvent<unknown>).detail);
      if (payload) {
        setCssInspectorPayload(payload);
      }
    };
    window.addEventListener('pm:xmux-selected-element', handleSelectedElement);
    return () => window.removeEventListener('pm:xmux-selected-element', handleSelectedElement);
  }, []);

  const navigate = () => {
    const next = normalizeUrl(draftUrl);
    if (!next) return;
    setDraftUrl(next);
    onNavigate(next);
  };

  const openExternally = () => {
    const target = normalizeUrl(draftUrl) ?? url;
    void openExternalUrl(target).catch(() => {
      if (typeof window !== 'undefined') {
        window.open(target, '_blank', 'noopener,noreferrer');
      }
    });
  };

  const copyCurrentUrl = useCallback(async () => {
    const target = nativeActive
      ? await getNativeCurrentUrl(itemId).catch(() => url)
      : url;
    await navigator.clipboard.writeText(target);
    setStatus({ tone: 'success', message: `Copied URL: ${target}` });
    setMenuOpen(false);
  }, [itemId, nativeActive, url]);

  const runNativeAction = useCallback(
    async (label: string, action: () => Promise<void>, success: string) => {
      if (!nativeActive) {
        nativeUnavailable(label);
        setMenuOpen(false);
        return;
      }
      try {
        await action();
        setStatus({ tone: 'success', message: success });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setStatus({ tone: 'error', message: `${label} failed: ${message}` });
      } finally {
        setMenuOpen(false);
      }
    },
    [nativeActive, nativeUnavailable],
  );

  const hardReload = useCallback(() => {
    void runNativeAction(
      'Hard Reload',
      () => reloadNativeBrowser(itemId),
      'Hard reload requested for the active native browser.',
    );
  }, [itemId, runNativeAction]);

  const updateZoom = useCallback(
    (delta: number) => {
      const next = Math.min(300, Math.max(25, zoomPercent + delta));
      setZoomPercent(next);
      void runNativeAction(
        'Zoom',
        () => setNativeBrowserZoom(itemId, next / 100),
        `Browser zoom set to ${next}%.`,
      );
    },
    [itemId, runNativeAction, zoomPercent],
  );

  const clearCookies = useCallback(() => {
    void runNativeAction(
      'Clear Cookies',
      () => clearNativeCookies(itemId),
      'Cookies cleared for the native Xmux browser profile.',
    );
  }, [itemId, runNativeAction]);

  const clearBrowsingData = useCallback(
    (label: string) => {
      void runNativeAction(
        label,
        () => clearNativeBrowsingData(itemId),
        `${label} completed for the native Xmux browser profile.`,
      );
    },
    [itemId, runNativeAction],
  );

  const clearConsole = useCallback(() => {
    if (!nativeActive) {
      nativeUnavailable('Clear Console');
      return;
    }
    void clearNativeConsoleEntries(itemId)
      .then(() => {
        setConsoleEntries([]);
        setConsoleError(null);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        setConsoleError(message);
      });
  }, [itemId, nativeActive, nativeUnavailable]);

  const exitSelectElementMode = useCallback(
    (message?: string) => {
      selectSessionRef.current += 1;
      setSelectMode(false);
      void evalNativeBrowserScript(itemId, 'window.__pmXmuxSelectElement?.cancel?.();').catch(() => {});
      if (message) {
        setStatus({ tone: 'info', message });
      }
    },
    [itemId],
  );

  const completeSelectElement = useCallback(
    async (rawPayload: string, session: number) => {
      if (selectSessionRef.current !== session) return;

      const payload = parseSelectElementPayload(rawPayload);
      if (
        payload &&
        typeof payload === 'object' &&
        'cancelled' in payload &&
        (payload as { cancelled?: boolean }).cancelled
      ) {
        setSelectMode(false);
        setStatus({ tone: 'info', message: 'Select Element mode cancelled.' });
        return;
      }

      const inspectorPayload = parseCssInspectorPayload(payload);
      if (!inspectorPayload) {
        setSelectMode(false);
        setSelectedDragContext(null);
        setStatus({
          tone: 'error',
          message: 'Select Element returned no usable DOM context.',
        });
        return;
      }
      setCssInspectorPayload(inspectorPayload);
      const snippet = formatXmuxSelectedElementSnippet(inspectorPayload);
      setSelectedDragContext({ snippet, payload: inspectorPayload });
      const text = JSON.stringify(payload, null, 2);
      await navigator.clipboard.writeText(text).catch(() => {});
      window.dispatchEvent(
        new CustomEvent('pm:xmux-selected-element', {
          detail: payload,
        }),
      );
      const tag =
        payload && typeof payload === 'object' && 'positionTag' in payload
          ? String((payload as { positionTag?: unknown }).positionTag)
          : 'selected';
      setSelectMode(false);
      setStatus({
        tone: 'success',
        message: `Selected element captured (${tag}), sent to AI Assistant, and ready to drag.`,
      });
    },
    [],
  );

  const startSelectElement = useCallback(() => {
    if (!nativeActive) {
      setSelectMode(false);
      nativeUnavailable('Select Element');
      return;
    }
    if (selectMode) {
      exitSelectElementMode('Select Element mode cancelled.');
      return;
    }

    const session = selectSessionRef.current + 1;
    selectSessionRef.current = session;
    setSelectMode(true);
    setSelectedDragContext(null);
    setStatus({
      tone: 'info',
      message: 'Select Element mode is active. Click a page element to send DOM context, or click blank page space to cancel.',
    });
    void selectNativeBrowserElement(itemId)
      .then((rawPayload) => completeSelectElement(rawPayload, session))
      .catch((err) => {
        if (selectSessionRef.current !== session) return;
        const message = err instanceof Error ? err.message : String(err);
        setSelectMode(false);
        setStatus({ tone: 'error', message: `Select Element failed: ${message}` });
      })
      .finally(() => {
        if (selectSessionRef.current === session) {
          setSelectMode(false);
        }
      });
  }, [completeSelectElement, exitSelectElementMode, itemId, nativeActive, nativeUnavailable, selectMode]);

  useEffect(() => {
    if (!selectMode) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      exitSelectElementMode('Select Element mode cancelled.');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [exitSelectElementMode, selectMode]);

  useEffect(() => {
    if (!selectMode) return;
    const onPointerDown = (event: PointerEvent) => {
      const pane = browserPaneRef.current;
      if (!pane) return;
      const target = event.target;
      if (target instanceof Node && pane.contains(target)) return;
      exitSelectElementMode('Select Element mode cancelled.');
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [exitSelectElementMode, selectMode]);

  useEffect(() => {
    return () => {
      selectSessionRef.current += 1;
      void evalNativeBrowserScript(itemId, 'window.__pmXmuxSelectElement?.cancel?.();').catch(() => {});
    };
  }, [itemId]);

  const unsupportedCapture = useCallback((label: string) => {
    setStatus({
      tone: 'warning',
      message: `${label} needs a native webview snapshot pipeline. The control is reserved for F34 follow-up implementation.`,
    });
    setMenuOpen(false);
  }, []);

  return (
    <div
      ref={browserPaneRef}
      data-browser-pane
      data-browser-item-id={itemId}
      className="flex h-full min-h-0 flex-col bg-editor-bg"
    >
      <div
        data-browser-chrome
        className="relative z-[100] flex h-8 shrink-0 items-center gap-2 border-b border-stone-800 bg-editor-bg px-2 text-[11px] text-stone-400"
      >
        <Chrome size={13} className="shrink-0 text-stone-300" />
        <input
          value={draftUrl}
          onChange={(event) => setDraftUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') navigate();
          }}
          placeholder={homepageUrl}
          className="min-w-0 flex-1 bg-editor-addr px-2 py-1 text-stone-200 outline-none ring-1 ring-stone-800 focus:ring-sky-400/50"
          aria-label="Browser URL"
        />
        <IconButton
          active={selectMode}
          activeClassName="border-blue-400/70 bg-blue-500/20 text-blue-200"
          onClick={startSelectElement}
          title={selectMode ? 'Exit Select Element mode' : 'Select Element'}
          ariaLabel="Select Element mode"
        >
          <Crosshair size={12} />
        </IconButton>
        <IconButton
          active={consoleOpen}
          onClick={() => setConsoleOpen((value) => !value)}
          title={consoleOpen ? 'Hide Console' : 'Console'}
          ariaLabel={consoleOpen ? 'Hide browser console' : 'Show browser console'}
        >
          <TerminalSquare size={12} />
        </IconButton>
        <IconButton
          active={cssInspectorOpen}
          onClick={() => setCssInspectorOpen((value) => !value)}
          title="Show CSS Inspector"
          ariaLabel="Show CSS Inspector"
        >
          <Code2 size={12} />
        </IconButton>
        <button
          type="button"
          onClick={navigate}
          className="shrink-0 border border-stone-700 px-2 py-1 text-stone-300 hover:border-stone-500 hover:text-stone-100"
        >
          Go
        </button>
        <button
          type="button"
          onClick={openExternally}
          className="flex h-6 w-6 shrink-0 items-center justify-center border border-stone-700 text-stone-300 hover:border-stone-500 hover:text-stone-100"
          aria-label="Open browser URL externally"
          title="Open in system browser"
        >
          <ExternalLink size={12} />
        </button>
        <div className="shrink-0">
          <IconButton
            active={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
            title="Browser actions"
            ariaLabel="Open browser actions menu"
          >
            <MoreHorizontal size={13} />
          </IconButton>
        </div>
      </div>
      {menuOpen ? (
        <div className="relative z-[100] shrink-0 border-b border-stone-800 bg-editor-panel text-[12px] text-stone-200 shadow-lg">
          <div className="grid gap-1 p-2 sm:grid-cols-2 xl:grid-cols-4">
            <MenuButton icon={<Camera size={13} />} label="Take Screenshot" onClick={() => unsupportedCapture('Take Screenshot')} />
            <MenuButton icon={<Braces size={13} />} label="Capture Area Screenshot" onClick={() => unsupportedCapture('Capture Area Screenshot')} />
            <MenuButton icon={<RotateCcw size={13} />} label="Hard Reload" onClick={hardReload} />
            <MenuButton icon={<Copy size={13} />} label="Copy Current URL" onClick={() => void copyCurrentUrl()} />
            <div className="flex items-center gap-2 border border-stone-800 bg-stone-950/35 px-2 py-1.5">
              <span className="min-w-0 flex-1 text-stone-300">Zoom</span>
              <button
                type="button"
                onClick={() => updateZoom(-10)}
                className="flex h-6 w-6 items-center justify-center border border-stone-700 hover:border-stone-500 hover:text-stone-100"
                aria-label="Zoom out"
                title="Zoom out"
              >
                <Minus size={12} />
              </button>
              <span className="w-11 text-center font-mono text-[11px] text-stone-300">{zoomPercent}%</span>
              <button
                type="button"
                onClick={() => updateZoom(10)}
                className="flex h-6 w-6 items-center justify-center border border-stone-700 hover:border-stone-500 hover:text-stone-100"
                aria-label="Zoom in"
                title="Zoom in"
              >
                <Plus size={12} />
              </button>
            </div>
            <MenuButton icon={<History size={13} />} label="Clear Browsing History" onClick={() => clearBrowsingData('Clear Browsing History')} />
            <MenuButton icon={<Cookie size={13} />} label="Clear Cookies" onClick={clearCookies} />
            <MenuButton icon={<Database size={13} />} label="Clear Cache" onClick={() => clearBrowsingData('Clear Cache')} />
          </div>
        </div>
      ) : null}
      {status ? (
        <div className={`relative z-[100] flex shrink-0 items-center gap-2 border-b px-2 py-1 text-[11px] ${statusClass(status.tone)}`}>
          <Info size={12} className="shrink-0" />
          <span className="min-w-0 flex-1 truncate">{status.message}</span>
          <button
            type="button"
            onClick={() => setStatus(null)}
            className="shrink-0 text-[11px] opacity-70 hover:opacity-100"
            aria-label="Dismiss browser status"
          >
            Dismiss
          </button>
        </div>
      ) : null}
      {selectedDragContext ? (
        <SelectedElementDragChip
          snippet={selectedDragContext.snippet}
          payload={selectedDragContext.payload}
          onClear={() => setSelectedDragContext(null)}
        />
      ) : null}
      {showBlockedHint ? (
        <div className="relative z-[100] flex shrink-0 items-center gap-2 border-b border-amber-900/40 bg-amber-950/40 px-2 py-1 text-[11px] text-amber-200">
          <Info size={12} className="shrink-0" />
          <span className="min-w-0 flex-1">
            {hintIsNativeFallback ? (
              <>
                內嵌瀏覽器尚未載入
                {embedFailure ? `（${embedFailure}）` : ''}。請點「重試內嵌」或
              </>
            ) : (
              <>
                此網址無法在瀏覽器預覽中顯示（例如 GitHub、Google）。請用
                <code className="mx-1 text-amber-100">npm run tauri:dev</code>
                或
                <code className="mx-1 text-amber-100">./start_project_manager.sh</code>
                開桌面版，或點
              </>
            )}
          </span>
          {hintIsNativeFallback ? (
            <button
              type="button"
              onClick={() => {
                retryNativeEmbed(itemId, url);
                setEmbedRetryKey((k) => k + 1);
              }}
              className="inline-flex shrink-0 items-center gap-1 border border-amber-600/60 px-1.5 py-0.5 text-amber-100 hover:bg-amber-900/40 hover:text-amber-50"
            >
              重試內嵌
            </button>
          ) : null}
          <button
            type="button"
            onClick={openExternally}
            className="inline-flex shrink-0 items-center gap-1 border border-amber-600/60 px-1.5 py-0.5 text-amber-100 hover:bg-amber-900/40 hover:text-amber-50"
          >
            <ExternalLink size={10} />
            系統瀏覽器開啟
          </button>
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <BrowserSlot
            key={embedRetryKey}
            itemId={itemId}
            url={url}
            isActive={isActive}
          />
        </div>
        {consoleOpen || cssInspectorOpen ? (
          <BrowserSidePanel>
            {consoleOpen ? (
              <BrowserSideSection
                title="Console"
                icon={<TerminalSquare size={13} />}
                onClose={() => setConsoleOpen(false)}
              >
                <BrowserConsole
                  entries={consoleEntries}
                  error={consoleError}
                  filter={consoleFilter}
                  onFilterChange={setConsoleFilter}
                  onClear={clearConsole}
                />
              </BrowserSideSection>
            ) : null}
            {cssInspectorOpen ? (
              <BrowserSideSection
                title="CSS Inspector"
                icon={<Clipboard size={13} />}
                onClose={() => setCssInspectorOpen(false)}
              >
                <CssInspector
                  payload={cssInspectorPayload}
                  activeTab={cssInspectorTab}
                  onTabChange={setCssInspectorTab}
                />
              </BrowserSideSection>
            ) : null}
          </BrowserSidePanel>
        ) : null}
      </div>
    </div>
  );
}

function SelectedElementDragChip({
  snippet,
  payload,
  onClear,
}: {
  snippet: string;
  payload: CssInspectorPayload;
  onClear: () => void;
}) {
  const label = `${payload.positionTag ?? 'selected'} · ${payload.elementTag ?? payload.domTree?.tag ?? 'element'}`;
  const selector = payload.selector ?? payload.cssPath ?? '';

  return (
    <div className="relative z-[100] flex shrink-0 items-center gap-2 border-b border-blue-500/25 bg-blue-950/30 px-2 py-1 text-[11px] text-blue-100">
      <Clipboard size={12} className="shrink-0 text-blue-200" />
      <div
        draggable
        onDragStart={(event) => {
          setXmuxSnippetDragData(event.dataTransfer, snippet, payload);
          event.dataTransfer.dropEffect = 'copy';
        }}
        className="flex min-w-0 flex-1 cursor-grab items-center gap-2 border border-blue-400/30 bg-blue-500/10 px-2 py-1 active:cursor-grabbing"
        aria-label="Drag selected element context"
        title="Drag selected element context into another AI input"
      >
        <span className="shrink-0 font-mono text-[10px] text-blue-100">{label}</span>
        {selector ? (
          <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-blue-200/70">
            {selector}
          </span>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onClear}
        className="shrink-0 px-1 text-[11px] text-blue-200/70 hover:text-blue-50"
        aria-label="Clear selected element context"
      >
        Clear
      </button>
    </div>
  );
}

function BrowserConsole({
  entries,
  error,
  filter,
  onFilterChange,
  onClear,
}: {
  entries: BrowserConsoleEntry[];
  error: string | null;
  filter: string;
  onFilterChange: (value: string) => void;
  onClear: () => void;
}) {
  const normalizedFilter = filter.trim().toLowerCase();
  const visibleEntries = normalizedFilter
    ? entries.filter((entry) =>
        [
          entry.level,
          entry.kind,
          entry.message,
          entry.url,
          entry.method ?? '',
          entry.status ? String(entry.status) : '',
        ].join(' ').toLowerCase().includes(normalizedFilter),
      )
    : entries;

  return (
    <div className="flex min-h-[220px] flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          value={filter}
          onChange={(event) => onFilterChange(event.target.value)}
          placeholder="Filter"
          className="min-w-0 flex-1 border border-stone-800 bg-stone-950 px-2 py-1 text-[11px] text-stone-200 outline-none focus:border-sky-500/60"
          aria-label="Filter console logs"
        />
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 border border-stone-700 px-2 py-1 text-stone-300 hover:border-stone-500 hover:text-stone-100"
        >
          Clear
        </button>
      </div>
      <div className="text-[10px] text-stone-500">
        {visibleEntries.length} of {entries.length} logs
      </div>
      {error ? (
        <div className="border border-amber-500/25 bg-amber-950/25 px-2 py-1.5 text-amber-100">
          {error}
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto border border-stone-900 bg-black/25">
        {visibleEntries.length === 0 ? (
          <div className="px-2 py-3 text-stone-500">
            No console logs captured yet. New console, JavaScript error, fetch, and XHR failure entries will appear here.
          </div>
        ) : (
          <div className="divide-y divide-stone-900">
            {visibleEntries.map((entry) => (
              <ConsoleEntryRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ConsoleEntryRow({ entry }: { entry: BrowserConsoleEntry }) {
  const source = entry.url
    ? `${entry.url}${entry.line ? `:${entry.line}${entry.column ? `:${entry.column}` : ''}` : ''}`
    : '';
  return (
    <div className={`border-l-2 px-2 py-1.5 ${consoleLevelClass(entry.level)}`}>
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.08em] text-stone-500">
        <span className="font-semibold">{entry.level}</span>
        <span>{entry.kind}</span>
        {entry.method ? <span>{entry.method}</span> : null}
        {entry.status ? <span>{entry.status}</span> : null}
        <time className="ml-auto normal-case tracking-normal">
          {new Date(entry.timestamp).toLocaleTimeString()}
        </time>
      </div>
      <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[11px] leading-4">
        {entry.message || entry.args.join(' ')}
      </pre>
      {source ? (
        <div className="mt-1 truncate font-mono text-[10px] text-stone-500" title={source}>
          {source}
        </div>
      ) : null}
    </div>
  );
}

function CssInspector({
  payload,
  activeTab,
  onTabChange,
}: {
  payload: CssInspectorPayload | null;
  activeTab: CssInspectorTab;
  onTabChange: (tab: CssInspectorTab) => void;
}) {
  if (!payload) {
    return (
      <div className="space-y-2 text-stone-500">
        <p>Select an element in the browser pane to inspect its DOM position, box model, classes, and computed styles.</p>
        <p>Use the crosshair Select Element control, then click a page component.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[260px] flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1">
        <span className="border border-sky-500/25 bg-sky-950/30 px-1.5 py-0.5 font-mono text-[10px] text-sky-100">
          {payload.positionTag ?? 'selected'}
        </span>
        <span className="border border-stone-700 bg-stone-900 px-1.5 py-0.5 font-mono text-[10px] text-stone-200">
          {payload.elementTag ?? payload.domTree?.tag ?? 'element'}
        </span>
      </div>
      {payload.selector || payload.cssPath ? (
        <div className="truncate font-mono text-[10px] text-stone-500" title={payload.selector ?? payload.cssPath}>
          {payload.selector ?? payload.cssPath}
        </div>
      ) : null}
      <div>
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-stone-500">Components</div>
        <div className="max-h-44 overflow-auto border border-stone-900 bg-black/20 p-1">
          {payload.domTree ? <DomTreeView node={payload.domTree} selected /> : <div className="px-1 py-2 text-stone-500">No DOM tree captured.</div>}
        </div>
      </div>
      <div className="flex gap-1 border-b border-stone-800">
        <InspectorTabButton active={activeTab === 'design'} onClick={() => onTabChange('design')}>
          Design
        </InspectorTabButton>
        <InspectorTabButton active={activeTab === 'css'} onClick={() => onTabChange('css')}>
          CSS
        </InspectorTabButton>
      </div>
      {activeTab === 'design' ? <CssInspectorDesign payload={payload} /> : <CssInspectorCss payload={payload} />}
    </div>
  );
}

function InspectorTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'px-2 py-1 text-[11px] font-semibold',
        active ? 'bg-stone-700 text-stone-100' : 'text-stone-500 hover:text-stone-200',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function DomTreeView({
  node,
  depth = 0,
  selected = false,
}: {
  node: DomTreeNode;
  depth?: number;
  selected?: boolean;
}) {
  const className = node.className ? `.${node.className.split(/\s+/).filter(Boolean).slice(0, 3).join('.')}` : '';
  const label = `${node.tag ?? 'element'}${node.id ? `#${node.id}` : ''}${className}`;
  const children = Array.isArray(node.children) ? node.children.slice(0, 20) : [];
  return (
    <div>
      <div
        className={[
          'truncate px-1 py-0.5 font-mono text-[10px]',
          selected ? 'bg-sky-500/20 text-sky-100' : 'text-stone-300',
        ].join(' ')}
        style={{ paddingLeft: `${depth * 10 + 4}px` }}
        title={label}
      >
        {label}
      </div>
      {children.map((child, index) => (
        <DomTreeView key={`${child.tag ?? 'node'}-${index}`} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

function CssInspectorDesign({ payload }: { payload: CssInspectorPayload }) {
  const summary = payload.computedStyleSummary ?? {};
  return (
    <div className="space-y-3">
      <InspectorSection title="Position">
        <ValueGrid
          rows={[
            ['X', formatNumber(payload.boxModel?.rect?.x)],
            ['Y', formatNumber(payload.boxModel?.rect?.y)],
            ['W', formatNumber(payload.boxModel?.rect?.width)],
            ['H', formatNumber(payload.boxModel?.rect?.height)],
            ['Position', summary.position],
            ['Z', summary.zIndex],
          ]}
        />
      </InspectorSection>
      <InspectorSection title="Layout">
        <ValueGrid
          rows={[
            ['Display', summary.display],
            ['Box', summary.boxSizing],
            ['Flex', summary.flex],
            ['Align', summary.alignItems],
            ['Justify', summary.justifyContent],
            ['Overflow', summary.overflow],
          ]}
        />
      </InspectorSection>
      <InspectorSection title="Box Model">
        <BoxModelView payload={payload} />
      </InspectorSection>
      <InspectorSection title="Typography">
        <ValueGrid
          rows={[
            ['Font', summary.fontFamily],
            ['Size', summary.fontSize],
            ['Weight', summary.fontWeight],
            ['Line', summary.lineHeight],
            ['Color', summary.color],
            ['Letter', summary.letterSpacing],
          ]}
        />
      </InspectorSection>
    </div>
  );
}

function CssInspectorCss({ payload }: { payload: CssInspectorPayload }) {
  const computedEntries = Object.entries(payload.computedStyle ?? {}).sort(([a], [b]) => a.localeCompare(b));
  return (
    <div className="space-y-3">
      <InspectorSection title="Class List">
        {payload.classList && payload.classList.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {payload.classList.map((name) => (
              <span key={name} className="border border-stone-800 bg-stone-950 px-1.5 py-0.5 font-mono text-[10px] text-stone-300">
                {name}
              </span>
            ))}
          </div>
        ) : (
          <div className="text-stone-500">No classes.</div>
        )}
      </InspectorSection>
      <InspectorSection title="Computed Styles">
        <div className="max-h-64 overflow-auto border border-stone-900 bg-black/20">
          {computedEntries.length === 0 ? (
            <div className="px-2 py-2 text-stone-500">No computed styles captured.</div>
          ) : (
            computedEntries.map(([name, value]) => (
              <div key={name} className="grid grid-cols-[minmax(0,0.45fr)_minmax(0,0.55fr)] gap-2 border-b border-stone-900 px-2 py-1 font-mono text-[10px]">
                <span className="truncate text-sky-200" title={name}>{name}</span>
                <span className="truncate text-stone-300" title={value}>{value}</span>
              </div>
            ))
          )}
        </div>
      </InspectorSection>
      <InspectorSection title="Outer HTML">
        <pre className="max-h-36 overflow-auto whitespace-pre-wrap break-words border border-stone-900 bg-black/20 p-2 font-mono text-[10px] text-stone-300">
          {payload.outerHTML ?? 'No outerHTML captured.'}
        </pre>
      </InspectorSection>
    </div>
  );
}

function InspectorSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-stone-500">{title}</div>
      {children}
    </section>
  );
}

function ValueGrid({ rows }: { rows: Array<[string, unknown]> }) {
  return (
    <div className="grid grid-cols-2 gap-1">
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0 border border-stone-900 bg-black/20 px-2 py-1">
          <div className="text-[10px] text-stone-500">{label}</div>
          <div className="truncate font-mono text-[11px] text-stone-200" title={String(value ?? '')}>
            {String(value || '-')}
          </div>
        </div>
      ))}
    </div>
  );
}

function BoxModelView({ payload }: { payload: CssInspectorPayload }) {
  const box = payload.boxModel;
  if (!box) return <div className="text-stone-500">No box model captured.</div>;
  return (
    <div className="space-y-1 font-mono text-[10px]">
      <BoxSideRow label="Margin" side={box.margin} />
      <BoxSideRow label="Border" side={box.border} />
      <BoxSideRow label="Padding" side={box.padding} />
      <div className="grid grid-cols-3 gap-1">
        <span className="border border-stone-900 bg-black/20 px-2 py-1 text-stone-500">Content</span>
        <span className="border border-stone-900 bg-black/20 px-2 py-1 text-stone-200">W {formatNumber(box.content?.width)}</span>
        <span className="border border-stone-900 bg-black/20 px-2 py-1 text-stone-200">H {formatNumber(box.content?.height)}</span>
      </div>
    </div>
  );
}

function BoxSideRow({ label, side }: { label: string; side?: BoxSide }) {
  return (
    <div className="grid grid-cols-5 gap-1">
      <span className="border border-stone-900 bg-black/20 px-2 py-1 text-stone-500">{label}</span>
      <span className="border border-stone-900 bg-black/20 px-2 py-1 text-stone-200">T {formatNumber(side?.top)}</span>
      <span className="border border-stone-900 bg-black/20 px-2 py-1 text-stone-200">R {formatNumber(side?.right)}</span>
      <span className="border border-stone-900 bg-black/20 px-2 py-1 text-stone-200">B {formatNumber(side?.bottom)}</span>
      <span className="border border-stone-900 bg-black/20 px-2 py-1 text-stone-200">L {formatNumber(side?.left)}</span>
    </div>
  );
}

function formatNumber(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(Math.round(value * 100) / 100) : '-';
}

function MenuButton({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-8 w-full items-center gap-2 border border-stone-800 bg-stone-950/35 px-2 py-1.5 text-left text-stone-300 hover:bg-white/8 hover:text-stone-100"
    >
      <span className="text-stone-500">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function BrowserSidePanel({ children }: { children: ReactNode }) {
  return (
    <aside className="relative z-[100] flex w-[320px] shrink-0 flex-col overflow-auto border-l border-stone-800 bg-stone-950/95 text-[11px] text-stone-400">
      {children}
    </aside>
  );
}

function BrowserSideSection({
  title,
  icon,
  onClose,
  children,
}: {
  title: string;
  icon: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <section className="shrink-0 border-b border-stone-800">
      <div className="flex h-7 items-center gap-2 border-b border-stone-800 px-2 text-stone-200">
        {icon}
        <span className="font-semibold">{title}</span>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto text-stone-500 hover:text-stone-200"
          aria-label={`Close ${title}`}
        >
          Hide
        </button>
      </div>
      <div className="px-2 py-2">{children}</div>
    </section>
  );
}
