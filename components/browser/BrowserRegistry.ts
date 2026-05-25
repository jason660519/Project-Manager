'use client';

// BrowserRegistry — iframe (web preview) or in-window native embed (Tauri + add_child).
//
// Tauri desktop uses embedded WKWebView/WebView2 in the browser slot only (cmux-style).
// A separate WebviewWindow child stacks above all React UI — that path is retired.

import {
  xmuxWebviewCreate,
  xmuxWebviewDestroy,
  xmuxWebviewNavigate,
  xmuxWebviewSetBounds,
  xmuxWebviewSetVisible,
  xmuxWebviewDestroyAll,
} from '../../lib/bridge';
import { isTauriRuntime, waitForTauriRuntime } from '../../lib/runtime/tauri-ready';
import type { ViewBounds } from './browser-bounds';

function isTauri(): boolean {
  return isTauriRuntime();
}

function webviewLabel(itemId: string): string {
  return `xmux-browser-${itemId}`;
}

interface IframeSession {
  kind: 'iframe';
  hostDiv: HTMLDivElement;
  iframe: HTMLIFrameElement;
  url: string;
}

interface TauriSession {
  kind: 'tauri';
  hostDiv: HTMLDivElement;
  label: string;
  url: string;
  visible: boolean;
  created: boolean;
  disposed: boolean;
  pendingCreate: Promise<void> | null;
  lastBounds: { x: number; y: number; width: number; height: number } | null;
}

type Session = IframeSession | TauriSession;

const sessions = new Map<string, Session>();
const embedFailures = new Map<string, string>();
let limboDiv: HTMLDivElement | null = null;
// Serialize native webview creates — concurrent add_child calls often fail on macOS.
let createChain: Promise<void> = Promise.resolve();
let nativePaintSuspendCount = 0;
const OFFSCREEN_BOUNDS = { x: -100_000, y: -100_000, width: 1, height: 1 };

function isMissingNativeWebviewError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /xmux webview 'xmux-browser-[^']+' not found/i.test(message);
}

function enqueueCreate(task: () => Promise<void>): Promise<void> {
  const run = createChain.then(task, task);
  createChain = run.catch(() => {});
  return run;
}

function ensureLimbo(): HTMLDivElement {
  if (typeof document === 'undefined') {
    throw new Error('BrowserRegistry: requires a DOM');
  }
  if (!limboDiv) {
    limboDiv = document.createElement('div');
    limboDiv.setAttribute('data-browser-limbo', '');
    limboDiv.style.cssText =
      'position:fixed;left:-99999px;top:-99999px;width:1px;height:1px;overflow:hidden;visibility:hidden;pointer-events:none;';
    document.body.appendChild(limboDiv);
  }
  return limboDiv;
}

function createIframeSession(url: string): IframeSession {
  const hostDiv = document.createElement('div');
  hostDiv.style.cssText = 'width:100%;height:100%;display:flex;min-height:0;';

  const iframe = document.createElement('iframe');
  iframe.title = 'xmux browser pane';
  iframe.style.cssText = 'flex:1;min-height:0;border:0;background:white;width:100%;';
  iframe.src = url;
  hostDiv.appendChild(iframe);

  return { kind: 'iframe', hostDiv, iframe, url };
}

function createTauriSession(itemId: string, url: string): TauriSession {
  const hostDiv = document.createElement('div');
  hostDiv.setAttribute('data-browser-anchor', itemId);
  hostDiv.style.cssText = 'width:100%;height:100%;min-height:0;background:#1e1e1e;';

  return {
    kind: 'tauri',
    hostDiv,
    label: webviewLabel(itemId),
    url,
    visible: false,
    created: false,
    disposed: false,
    pendingCreate: null,
    lastBounds: null,
  };
}

function markMissingNativeWebview(session: TauriSession): void {
  session.created = false;
}

function logNativeBridgeError(
  session: TauriSession,
  message: string,
  err: unknown,
): boolean {
  if (isMissingNativeWebviewError(err)) {
    markMissingNativeWebview(session);
    return false;
  }
  console.error(message, err);
  return true;
}

function parkNativeWebview(
  session: TauriSession,
  context: string,
  options: { preserveDesiredVisibility?: boolean } = {},
): void {
  if (!options.preserveDesiredVisibility) {
    session.visible = false;
  }
  if (!session.created) return;
  void xmuxWebviewSetBounds(
    session.label,
    OFFSCREEN_BOUNDS.x,
    OFFSCREEN_BOUNDS.y,
    OFFSCREEN_BOUNDS.width,
    OFFSCREEN_BOUNDS.height,
  ).catch((err) => {
    logNativeBridgeError(session, `[BrowserRegistry] park failed (${context})`, err);
  });
  void xmuxWebviewSetVisible(session.label, false).catch((err) => {
    logNativeBridgeError(session, `[BrowserRegistry] hide failed (${context})`, err);
  });
}

function destroyNativeWebview(session: TauriSession, context: string): void {
  const hadNativeWebview = session.created;
  session.disposed = true;
  session.visible = false;
  session.created = false;
  if (!hadNativeWebview) return;
  void xmuxWebviewSetBounds(
    session.label,
    OFFSCREEN_BOUNDS.x,
    OFFSCREEN_BOUNDS.y,
    OFFSCREEN_BOUNDS.width,
    OFFSCREEN_BOUNDS.height,
  ).catch(() => {});
  void xmuxWebviewSetVisible(session.label, false).catch(() => {});
  void xmuxWebviewDestroy(session.label).catch((err) => {
    if (isMissingNativeWebviewError(err)) return;
    console.error(`[BrowserRegistry] destroy failed (${context})`, err);
  });
}

function upgradeIframeToTauri(
  itemId: string,
  iframeSession: IframeSession,
  url: string,
): TauriSession {
  const parent = iframeSession.hostDiv.parentElement;
  iframeSession.iframe.src = 'about:blank';
  iframeSession.hostDiv.remove();
  const fresh = createTauriSession(itemId, url);
  sessions.set(itemId, fresh);
  embedFailures.delete(itemId);
  if (parent) {
    parent.appendChild(fresh.hostDiv);
  }
  const bounds = fresh.lastBounds;
  if (bounds && bounds.width >= 1 && bounds.height >= 1) {
    void ensureCreated(itemId, fresh, bounds);
  }
  return fresh;
}

function promoteTauriToIframe(
  itemId: string,
  session: TauriSession,
  url: string,
  reason: string,
): IframeSession {
  embedFailures.set(itemId, reason);
  if (session.created) {
    void xmuxWebviewDestroy(session.label).catch((err) => {
      console.error('[BrowserRegistry] destroy failed during iframe fallback', err);
    });
  }
  const parent = session.hostDiv.parentElement;
  session.hostDiv.remove();
  const iframeSession = createIframeSession(url);
  if (parent) {
    parent.appendChild(iframeSession.hostDiv);
  }
  sessions.set(itemId, iframeSession);
  return iframeSession;
}

function ensureCreated(
  itemId: string,
  session: TauriSession,
  bounds: { x: number; y: number; width: number; height: number },
): Promise<void> {
  if (session.disposed || sessions.get(itemId) !== session) {
    void xmuxWebviewDestroy(session.label).catch(() => {});
    return Promise.resolve();
  }
  if (session.created) {
    return xmuxWebviewSetBounds(
      session.label,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
    ).catch((err) => {
      if (!logNativeBridgeError(session, '[BrowserRegistry] set_bounds failed', err)) {
        if (session.visible && sessions.get(itemId) === session && !session.pendingCreate) {
          return ensureCreated(itemId, session, bounds);
        }
      }
    });
  }
  if (session.pendingCreate) return session.pendingCreate;
  session.pendingCreate = enqueueCreate(() =>
    (session.disposed || sessions.get(itemId) !== session
      ? Promise.resolve()
      : xmuxWebviewCreate(
          session.label,
          session.url,
          bounds.x,
          bounds.y,
          bounds.width,
          bounds.height,
        ))
      .then(() => {
        if (session.disposed || sessions.get(itemId) !== session) {
          return xmuxWebviewDestroy(session.label).catch(() => {});
        }
        embedFailures.delete(itemId);
        session.created = true;
        if (!session.visible) {
          parkNativeWebview(session, 'post-create hidden session');
          return;
        }
        const latest = session.lastBounds;
        if (
          latest &&
          (latest.x !== bounds.x ||
            latest.y !== bounds.y ||
            latest.width !== bounds.width ||
            latest.height !== bounds.height)
        ) {
          return xmuxWebviewSetBounds(
            session.label,
            latest.x,
            latest.y,
            latest.width,
            latest.height,
          );
        }
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[BrowserRegistry] embed create failed; iframe fallback', err);
        promoteTauriToIframe(itemId, session, session.url, message);
      })
      .finally(() => {
        session.pendingCreate = null;
      }),
  );
  return session.pendingCreate;
}

function ensureNativeSession(itemId: string, url: string): Session | undefined {
  const session = sessions.get(itemId);
  if (!session) return undefined;
  if (isTauri() && session.kind === 'iframe') {
    return upgradeIframeToTauri(itemId, session, url);
  }
  return session;
}

function isNativePaintingSuspended(): boolean {
  return nativePaintSuspendCount > 0;
}

function parkAllNativeWebviews(context: string): void {
  if (!isTauri()) return;
  for (const session of sessions.values()) {
    if (session.kind === 'tauri') {
      parkNativeWebview(session, context, { preserveDesiredVisibility: true });
    }
  }
}

function showNativeWebviewAfterCreate(itemId: string, session: TauriSession): void {
  const current = sessions.get(itemId);
  if (!current || current !== session || current.kind !== 'tauri') return;
  if (current.disposed || !current.visible) return;
  void xmuxWebviewSetVisible(current.label, true).catch((err) => {
    logNativeBridgeError(current, '[BrowserRegistry] show (post-create) failed', err);
  });
}

function restoreNativeWebview(itemId: string, session: TauriSession, context: string): void {
  if (session.disposed || sessions.get(itemId) !== session || !session.visible) return;
  const bounds = session.lastBounds;
  if (!bounds || bounds.width < 1 || bounds.height < 1) return;
  if (!session.created) {
    if (!session.pendingCreate) {
      void ensureCreated(itemId, session, bounds).then(() =>
        showNativeWebviewAfterCreate(itemId, session),
      );
    }
    return;
  }
  void xmuxWebviewSetBounds(
    session.label,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
  )
    .then(() => xmuxWebviewSetVisible(session.label, true))
    .catch((err) => {
      const shouldLog = logNativeBridgeError(
        session,
        `[BrowserRegistry] restore failed (${context})`,
        err,
      );
      if (!shouldLog && session.visible && sessions.get(itemId) === session) {
        restoreNativeWebview(itemId, session, `${context} recreate`);
      }
    });
}

function restoreAllNativeWebviews(context: string): void {
  if (!isTauri()) return;
  for (const [itemId, session] of sessions.entries()) {
    if (session.kind === 'tauri') {
      restoreNativeWebview(itemId, session, context);
    }
  }
}

export function attach(itemId: string, slot: HTMLElement, initialUrl: string): void {
  let session = sessions.get(itemId);
  if (!session) {
    session = isTauri()
      ? createTauriSession(itemId, initialUrl)
      : createIframeSession(initialUrl);
    sessions.set(itemId, session);
  } else {
    session = ensureNativeSession(itemId, initialUrl) ?? session;
  }
  session.url = initialUrl;
  if (session.kind === 'iframe' && session.iframe.src !== initialUrl) {
    session.iframe.src = initialUrl;
  }
  if (session.hostDiv.parentElement !== slot) {
    slot.appendChild(session.hostDiv);
  }
  if (session.kind === 'tauri' && session.created && !session.visible) {
    session.visible = true;
    void xmuxWebviewSetVisible(session.label, true).catch((err) => {
      logNativeBridgeError(session, '[BrowserRegistry] show failed', err);
    });
  }

  void waitForTauriRuntime().then((ready) => {
    if (!ready) return;
    const current = sessions.get(itemId);
    if (!current) return;
    if (current.kind === 'iframe') {
      const upgraded = upgradeIframeToTauri(itemId, current, initialUrl);
      if (upgraded.hostDiv.parentElement !== slot) {
        slot.appendChild(upgraded.hostDiv);
      }
    }
  });
}

/** Upgrade sessions created before `__TAURI_INTERNALS__` was injected. */
export function migrateStaleIframeSessions(): void {
  if (!isTauri()) return;
  for (const [itemId, session] of Array.from(sessions.entries())) {
    if (session.kind === 'iframe') {
      upgradeIframeToTauri(itemId, session, session.url);
    }
  }
}

export function detach(itemId: string): void {
  const session = sessions.get(itemId);
  if (!session) return;
  const limbo = ensureLimbo();
  if (session.hostDiv.parentElement !== limbo) {
    limbo.appendChild(session.hostDiv);
  }
  if (session.kind === 'tauri') {
    parkNativeWebview(session, 'detach');
  }
}

export function getEmbedFailure(itemId: string): string | null {
  return embedFailures.get(itemId) ?? null;
}

/** Drop iframe fallback and recreate native embed on next attach/bounds tick. */
export function retryNativeEmbed(itemId: string, url: string): void {
  if (!isTauri()) return;
  embedFailures.delete(itemId);
  const session = sessions.get(itemId);
  if (session?.kind === 'iframe') {
    upgradeIframeToTauri(itemId, session, url);
    return;
  }
  if (session?.kind === 'tauri') {
    const tauriSession = session;
    if (tauriSession.created) {
      destroyNativeWebview(tauriSession, 'retry before recreate');
    }
    tauriSession.disposed = false;
    tauriSession.created = false;
    tauriSession.pendingCreate = null;
    tauriSession.visible = false;
    const bounds = tauriSession.lastBounds;
    if (bounds && bounds.width >= 1 && bounds.height >= 1) {
      void ensureCreated(itemId, tauriSession, bounds);
    }
  }
}

export function notifySlotVisible(itemId: string): void {
  const session = sessions.get(itemId);
  if (!session || session.kind !== 'tauri') return;
  session.visible = true;
  if (isNativePaintingSuspended()) return;
  const bounds = session.lastBounds;
  if (!bounds || bounds.width < 1 || bounds.height < 1) return;
  if (!session.created && !session.pendingCreate) {
    void ensureCreated(itemId, session, bounds);
  }
}

export function destroy(itemId: string): void {
  const session = sessions.get(itemId);
  if (!session) return;
  embedFailures.delete(itemId);
  session.hostDiv.remove();
  if (session.kind === 'tauri') {
    destroyNativeWebview(session, 'destroy');
  } else {
    session.iframe.src = 'about:blank';
  }
  sessions.delete(itemId);
}

export function navigate(itemId: string, url: string): void {
  const session = sessions.get(itemId);
  if (!session) return;
  session.url = url;
  if (session.kind === 'iframe') {
    if (session.iframe.src !== url) {
      session.iframe.src = url;
    }
    return;
  }
  if (!session.created) return;
  void xmuxWebviewNavigate(session.label, url).catch((err) => {
    logNativeBridgeError(session, '[BrowserRegistry] navigate failed', err);
  });
}

/** Always push bounds to the native webview (e.g. after URL change / layout settle). */
export function forceNativeBoundsSync(itemId: string, bounds: ViewBounds): void {
  const session = sessions.get(itemId);
  if (!session || session.kind !== 'tauri') return;
  session.lastBounds = bounds;
  if (isNativePaintingSuspended()) {
    session.visible = true;
    return;
  }
  const wasVisible = session.visible;
  session.visible = true;
  if (!session.created && !session.pendingCreate) {
    void ensureCreated(itemId, session, bounds).then(() => {
      showNativeWebviewAfterCreate(itemId, session);
    });
    return;
  }
  if (!session.created) return;
  if (!wasVisible) {
    void xmuxWebviewSetVisible(session.label, true).catch((err) => {
      logNativeBridgeError(session, '[BrowserRegistry] show failed', err);
    });
  }
  void xmuxWebviewSetBounds(
    session.label,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
  ).catch((err) => {
    if (!logNativeBridgeError(session, '[BrowserRegistry] force set_bounds failed', err)) {
      restoreNativeWebview(itemId, session, 'force set_bounds missing');
    }
  });
}

export function sessionKind(itemId: string): 'tauri' | 'iframe' | null {
  const session = sessions.get(itemId);
  if (!session) return null;
  return session.kind === 'tauri' ? 'tauri' : 'iframe';
}

export function setBounds(
  itemId: string,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const session = sessions.get(itemId);
  if (!session || session.kind !== 'tauri') return;
  const bounds = { x, y, width, height };
  session.lastBounds = bounds;
  if (isNativePaintingSuspended()) {
    session.visible = true;
    return;
  }
  const wasVisible = session.visible;
  session.visible = true;
  if (!session.created && !session.pendingCreate) {
    void ensureCreated(itemId, session, bounds).then(() => {
      showNativeWebviewAfterCreate(itemId, session);
    });
    return;
  }
  if (!session.created) return;
  if (!wasVisible) {
    void xmuxWebviewSetVisible(session.label, true).catch((err) => {
      logNativeBridgeError(session, '[BrowserRegistry] show failed', err);
    });
  }
  void xmuxWebviewSetBounds(session.label, x, y, width, height).catch((err) => {
    if (!logNativeBridgeError(session, '[BrowserRegistry] set_bounds failed', err)) {
      restoreNativeWebview(itemId, session, 'set_bounds missing');
    }
  });
}

export function setSlotHidden(itemId: string): void {
  const session = sessions.get(itemId);
  if (!session || session.kind !== 'tauri') return;
  parkNativeWebview(session, 'slot hidden');
}

export function suspendNativeBrowserPainting(reason: string = 'layout resize'): void {
  if (!isTauri()) return;
  nativePaintSuspendCount += 1;
  if (nativePaintSuspendCount === 1) {
    parkAllNativeWebviews(reason);
  }
}

export function resumeNativeBrowserPainting(): void {
  if (!isTauri()) return;
  nativePaintSuspendCount = Math.max(0, nativePaintSuspendCount - 1);
  if (nativePaintSuspendCount === 0) {
    restoreAllNativeWebviews('paint resume');
  }
}

export function getCurrentUrl(itemId: string): string | null {
  return sessions.get(itemId)?.url ?? null;
}

export function backendKind(): 'tauri' | 'iframe' {
  return isTauri() ? 'tauri' : 'iframe';
}

export function purgeOrphanNativeWebviews(): void {
  if (!isTauri()) return;
  for (const [itemId, session] of Array.from(sessions.entries())) {
    if (session.kind === 'tauri') {
      destroyNativeWebview(session, 'purge');
    } else {
      session.iframe.src = 'about:blank';
      session.hostDiv.remove();
    }
    sessions.delete(itemId);
  }
  void xmuxWebviewDestroyAll().catch((err) => {
    console.error('[BrowserRegistry] purgeOrphanNativeWebviews failed', err);
  });
}

export function destroyAllBrowserSessions(): void {
  for (const itemId of Array.from(sessions.keys())) {
    destroy(itemId);
  }
}

export function __resetForTests(): void {
  destroyAllBrowserSessions();
  embedFailures.clear();
  createChain = Promise.resolve();
  nativePaintSuspendCount = 0;
  if (limboDiv?.parentElement) {
    limboDiv.remove();
  }
  limboDiv = null;
}
