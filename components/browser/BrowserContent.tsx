'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Braces,
  Bug,
  Camera,
  Chrome,
  Clipboard,
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
  clearNativeBrowsingData,
  clearNativeCookies,
  evalNativeBrowserScript,
  getEmbedFailure,
  getNativeCurrentUrl,
  openNativeBrowserDevtools,
  closeNativeBrowserDevtools,
  isNativeBrowserDevtoolsOpen,
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
  const [devtoolsOpen, setDevtoolsOpen] = useState(false);
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
  // `sessionKind` reads non-reactive module state, and the native webview session
  // is created in BrowserSlot's mount effect *after* this component first renders.
  // Poll it into React state so controls (Select Element, DevTools, blocked hint)
  // reactively flip to "native" once the session is ready, instead of staying
  // stale-false and only showing the "requires native browser" warning.
  const [nativeActive, setNativeActive] = useState(() => sessionKind(itemId) === 'tauri');

  useEffect(() => {
    let cancelled = false;
    const sync = () => {
      if (cancelled) return;
      setNativeActive(sessionKind(itemId) === 'tauri');
    };
    sync();
    const interval = window.setInterval(sync, 400);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [itemId]);

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

  const toggleDevtools = useCallback(() => {
    if (!nativeActive) {
      nativeUnavailable('DevTools');
      return;
    }
    const shouldOpen = !devtoolsOpen;
    const action = shouldOpen
      ? openNativeBrowserDevtools(itemId)
      : closeNativeBrowserDevtools(itemId);
    void action
      .then(() => {
        setDevtoolsOpen(shouldOpen);
        setStatus(
          shouldOpen
            ? {
                tone: 'success',
                message:
                  'Opened native DevTools (Elements / Console / Network / Sources). Drag its edge or use the inspector dock buttons to resize / detach into its own window.',
              }
            : { tone: 'info', message: 'Closed native DevTools.' },
        );
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        setStatus({
          tone: 'error',
          message: `${shouldOpen ? 'Open' : 'Close'} DevTools failed: ${message}`,
        });
      });
  }, [devtoolsOpen, itemId, nativeActive, nativeUnavailable]);

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
    if (!isActive) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'F12') return;
      event.preventDefault();
      toggleDevtools();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isActive, toggleDevtools]);

  useEffect(() => {
    if (!nativeActive) {
      setDevtoolsOpen(false);
      return;
    }
    let cancelled = false;
    const sync = () => {
      void isNativeBrowserDevtoolsOpen(itemId)
        .then((open) => {
          if (!cancelled) setDevtoolsOpen(open);
        })
        .catch(() => {});
    };
    sync();
    const interval = window.setInterval(sync, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [itemId, nativeActive]);

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
          activeClassName="border-blue-400 bg-blue-500/30 text-blue-200 ring-1 ring-inset ring-blue-400/70"
          onClick={startSelectElement}
          title={selectMode ? 'Exit Select Element mode' : 'Select Element'}
          ariaLabel="Select Element mode"
        >
          <Crosshair size={12} />
        </IconButton>
        <IconButton
          active={devtoolsOpen}
          onClick={toggleDevtools}
          title={devtoolsOpen ? 'Close DevTools (F12)' : 'Open DevTools (F12) — Elements / Console / Network / Sources'}
          ariaLabel={devtoolsOpen ? 'Close native browser DevTools' : 'Open native browser DevTools'}
        >
          <Bug size={12} />
        </IconButton>
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

