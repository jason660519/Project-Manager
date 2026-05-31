'use client';

// BrowserRegistry — iframe (web preview) or in-window native embed (Tauri + add_child).
//
// Tauri desktop uses embedded WKWebView/WebView2 in the browser slot only (cmux-style).
// A separate WebviewWindow child stacks above all React UI — that path is retired.

import {
  xmuxWebviewCreate,
  xmuxWebviewClearBrowsingData,
  xmuxWebviewClearConsole,
  xmuxWebviewClearCookies,
  xmuxWebviewConsoleEntries,
  xmuxWebviewCurrentUrl,
  xmuxWebviewDestroy,
  xmuxWebviewNavigate,
  xmuxWebviewEval,
  xmuxWebviewOpenDevtools,
  xmuxWebviewCloseDevtools,
  xmuxWebviewIsDevtoolsOpen,
  xmuxWebviewReload,
  xmuxWebviewSelectElement,
  xmuxWebviewSetBounds,
  xmuxWebviewSetZoom,
  xmuxWebviewSetVisible,
  xmuxWebviewDestroyAll,
} from '../../lib/bridge';
import { isTauriRuntime, waitForTauriRuntime } from '../../lib/runtime/tauri-ready';
import { EDITOR_BG } from '../../lib/tokens/editor-colors';
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
  nativeVisible: boolean;
  created: boolean;
  disposed: boolean;
  pendingCreate: Promise<void> | null;
  pendingNavigateUrl: string | null;
  lastNativeUrl: string | null;
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
  iframe.src = iframePreviewUrl(url);
  hostDiv.appendChild(iframe);

  return { kind: 'iframe', hostDiv, iframe, url };
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || hostname === '::1';
}

function iframePreviewUrl(url: string): string {
  if (typeof window === 'undefined') return url;
  try {
    const target = new URL(url, window.location.href);
    const current = new URL(window.location.href);
    const sameLoopbackApp =
      isLoopbackHost(target.hostname) &&
      isLoopbackHost(current.hostname) &&
      target.port === current.port;
    if (!sameLoopbackApp) return url;
    target.protocol = current.protocol;
    target.hostname = current.hostname;
    target.port = current.port;
    return target.toString();
  } catch {
    return url;
  }
}

function createTauriSession(itemId: string, url: string): TauriSession {
  const hostDiv = document.createElement('div');
  hostDiv.setAttribute('data-browser-anchor', itemId);
  hostDiv.style.cssText = `width:100%;height:100%;min-height:0;background:${EDITOR_BG};`;

  return {
    kind: 'tauri',
    hostDiv,
    label: webviewLabel(itemId),
    url,
    visible: false,
    nativeVisible: false,
    created: false,
    disposed: false,
    pendingCreate: null,
    pendingNavigateUrl: null,
    lastNativeUrl: null,
    lastBounds: null,
  };
}

function markMissingNativeWebview(session: TauriSession): void {
  session.created = false;
  session.nativeVisible = false;
  session.lastNativeUrl = null;
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

function nativeItemId(target: TauriSession): string | null {
  for (const [itemId, session] of sessions.entries()) {
    if (session === target) return itemId;
  }
  return null;
}

function flushPendingNavigation(itemId: string, session: TauriSession, context: string): void {
  if (session.disposed || sessions.get(itemId) !== session) return;
  const target = session.pendingNavigateUrl ?? session.url;
  if (!target) return;
  if (!session.created) {
    if (session.pendingCreate) {
      void session.pendingCreate.then(() =>
        flushPendingNavigation(itemId, session, `${context} post-create`),
      );
      return;
    }
    const bounds = session.lastBounds;
    if (bounds && bounds.width >= 1 && bounds.height >= 1) {
      void ensureCreated(itemId, session, bounds).then(() =>
        flushPendingNavigation(itemId, session, `${context} recreate`),
      );
    }
    return;
  }
  if (target === session.lastNativeUrl) {
    if (session.pendingNavigateUrl === target) {
      session.pendingNavigateUrl = null;
    }
    return;
  }
  void xmuxWebviewNavigate(session.label, target)
    .then(() => {
      if (session.disposed || sessions.get(itemId) !== session) return;
      session.lastNativeUrl = target;
      if (session.pendingNavigateUrl === target) {
        session.pendingNavigateUrl = null;
      }
      if (session.pendingNavigateUrl && session.pendingNavigateUrl !== target) {
        flushPendingNavigation(itemId, session, `${context} latest`);
      }
    })
    .catch((err) => {
      const shouldLog = logNativeBridgeError(
        session,
        `[BrowserRegistry] navigate failed (${context})`,
        err,
      );
      if (shouldLog || session.disposed || sessions.get(itemId) !== session) return;
      session.pendingNavigateUrl = target;
      const bounds = session.lastBounds;
      if (bounds && bounds.width >= 1 && bounds.height >= 1) {
        void ensureCreated(itemId, session, bounds).then(() =>
          flushPendingNavigation(itemId, session, `${context} missing recreate`),
        );
      }
    });
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
  session.nativeVisible = false;
  const restoreIfStillDesired = () => {
    if (session.visible && !isNativePaintingSuspended()) {
      const itemId = nativeItemId(session);
      if (itemId) restoreNativeWebview(itemId, session, `${context} stale hide`);
    }
  };
  void xmuxWebviewSetBounds(
    session.label,
    OFFSCREEN_BOUNDS.x,
    OFFSCREEN_BOUNDS.y,
    OFFSCREEN_BOUNDS.width,
    OFFSCREEN_BOUNDS.height,
  )
    .then(restoreIfStillDesired)
    .catch((err) => {
      logNativeBridgeError(session, `[BrowserRegistry] park failed (${context})`, err);
    });
  void xmuxWebviewSetVisible(session.label, false)
    .then(() => {
      session.nativeVisible = false;
      restoreIfStillDesired();
    })
    .catch((err) => {
      logNativeBridgeError(session, `[BrowserRegistry] hide failed (${context})`, err);
    });
}

function destroyNativeWebview(session: TauriSession, context: string): void {
  const hadNativeWebview = session.created;
  session.disposed = true;
  session.visible = false;
  session.nativeVisible = false;
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
  session.pendingCreate = enqueueCreate(() => {
    if (session.disposed || sessions.get(itemId) !== session) {
      return Promise.resolve();
    }
    const createUrl = session.url;
    return xmuxWebviewCreate(
      session.label,
      createUrl,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
    )
      .then(() => {
        if (session.disposed || sessions.get(itemId) !== session) {
          return xmuxWebviewDestroy(session.label).catch(() => {});
        }
        embedFailures.delete(itemId);
        session.created = true;
        session.nativeVisible = session.visible;
        session.lastNativeUrl = createUrl;
        if (session.pendingNavigateUrl === createUrl) {
          session.pendingNavigateUrl = null;
        } else if (session.pendingNavigateUrl) {
          flushPendingNavigation(itemId, session, 'post-create');
        }
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
      });
  });
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
  void xmuxWebviewSetVisible(current.label, true)
    .then(() => {
      current.nativeVisible = true;
    })
    .catch((err) => {
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
    .then(() => {
      session.nativeVisible = true;
    })
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
  if (session.kind === 'iframe') {
    const previewUrl = iframePreviewUrl(initialUrl);
    if (session.iframe.src !== previewUrl) {
      session.iframe.src = previewUrl;
    }
  }
  if (session.hostDiv.parentElement !== slot) {
    slot.appendChild(session.hostDiv);
  }
  if (session.kind === 'tauri' && session.created && (!session.visible || !session.nativeVisible)) {
    session.visible = true;
    restoreNativeWebview(itemId, session, 'attach');
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
    tauriSession.pendingNavigateUrl = url;
    tauriSession.lastNativeUrl = null;
    tauriSession.nativeVisible = false;
    tauriSession.visible = false;
    tauriSession.url = url;
    const bounds = tauriSession.lastBounds;
    if (bounds && bounds.width >= 1 && bounds.height >= 1) {
      void ensureCreated(itemId, tauriSession, bounds).then(() =>
        flushPendingNavigation(itemId, tauriSession, 'retry native embed'),
      );
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
    return;
  }
  if (session.created) {
    restoreNativeWebview(itemId, session, 'slot visible');
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
    const previewUrl = iframePreviewUrl(url);
    if (session.iframe.src !== previewUrl) {
      session.iframe.src = previewUrl;
    }
    return;
  }
  session.pendingNavigateUrl = url;
  flushPendingNavigation(itemId, session, 'navigate');
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
  const shouldShow = !wasVisible || !session.nativeVisible;
  session.visible = true;
  if (!session.created && !session.pendingCreate) {
    void ensureCreated(itemId, session, bounds).then(() => {
      showNativeWebviewAfterCreate(itemId, session);
    });
    return;
  }
  if (!session.created) return;
  if (shouldShow) {
    void xmuxWebviewSetVisible(session.label, true)
      .then(() => {
        session.nativeVisible = true;
      })
      .catch((err) => {
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
  const shouldShow = !wasVisible || !session.nativeVisible;
  session.visible = true;
  if (!session.created && !session.pendingCreate) {
    void ensureCreated(itemId, session, bounds).then(() => {
      showNativeWebviewAfterCreate(itemId, session);
    });
    return;
  }
  if (!session.created) return;
  if (shouldShow) {
    void xmuxWebviewSetVisible(session.label, true)
      .then(() => {
        session.nativeVisible = true;
      })
      .catch((err) => {
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

function requireNativeSession(itemId: string): TauriSession {
  const session = sessions.get(itemId);
  if (!session) {
    throw new Error('Browser session is not ready yet.');
  }
  if (session.kind !== 'tauri') {
    throw new Error('This browser action requires the Tauri native webview.');
  }
  if (!session.created) {
    throw new Error('Native browser is still loading. Try again after the page appears.');
  }
  return session;
}

function requireIframeSession(itemId: string): IframeSession {
  const session = sessions.get(itemId);
  if (!session) {
    throw new Error('Browser session is not ready yet.');
  }
  if (session.kind !== 'iframe') {
    throw new Error('This browser action requires the iframe browser preview.');
  }
  return session;
}

function iframeWindow(session: IframeSession): Window {
  const win = session.iframe.contentWindow;
  if (!win) {
    throw new Error('Browser preview iframe is not ready yet.');
  }
  return win;
}

function iframeDocument(session: IframeSession): Document {
  const doc = session.iframe.contentDocument;
  if (!doc?.documentElement) {
    throw new Error('Browser preview document is not ready yet.');
  }
  return doc;
}

function waitForIframeDocument(session: IframeSession, timeoutMs = 5000): Promise<Document> {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      try {
        const doc = iframeDocument(session);
        const href = session.iframe.contentWindow?.location.href ?? '';
        const ready = doc.readyState === 'interactive' || doc.readyState === 'complete';
        const notInitialBlank = href !== 'about:blank' || session.url === 'about:blank';
        if (ready && notInitialBlank) {
          resolve(doc);
          return;
        }
      } catch (err) {
        reject(err);
        return;
      }
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error('Browser preview document did not finish loading in time.'));
        return;
      }
      window.setTimeout(check, 50);
    };
    check();
  });
}

async function selectIframeBrowserElement(itemId: string): Promise<string> {
  const session = requireIframeSession(itemId);
  const doc = await waitForIframeDocument(session);
  const win = iframeWindow(session);
  const key = '__pmXmuxSelectElement';
  const previous = (win as unknown as Record<string, { cleanup?: () => void }>)[key];
  previous?.cleanup?.();

  return new Promise((resolve) => {
    const style = doc.createElement('style');
    style.textContent =
      '* { cursor: crosshair !important; } [data-pm-xmux-hover="true"] { outline: 2px solid Highlight !important; outline-offset: 2px !important; }';
    doc.documentElement.appendChild(style);

    let hovered: Element | null = null;
    const ElementCtor = (doc.defaultView as unknown as { Element?: typeof Element } | null)?.Element;
    const isFrameElement = (value: unknown): value is Element =>
      Boolean(ElementCtor && value instanceof ElementCtor);
    const cssApi = (win as unknown as { CSS?: { escape?: (value: string) => string } }).CSS;
    const escapeCss = (value: string) => cssApi?.escape ? cssApi.escape(value) : value.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
    const textOf = (node: Element) => (node.textContent || '').replace(/\s+/g, ' ').trim();
    const attrsOf = (node: Element) =>
      Object.fromEntries(Array.from(node.attributes || []).map((attr) => [attr.name, attr.value]));
    const computedStyleOf = (node: Element) => {
      const style = win.getComputedStyle(node);
      return Object.fromEntries(Array.from(style).map((name) => [name, style.getPropertyValue(name)]));
    };
    const computedStyleSummaryOf = (node: Element) => {
      const style = win.getComputedStyle(node);
      return {
        display: style.display,
        position: style.position,
        zIndex: style.zIndex,
        boxSizing: style.boxSizing,
        width: style.width,
        height: style.height,
        margin: style.margin,
        padding: style.padding,
        border: style.border,
        borderRadius: style.borderRadius,
        backgroundColor: style.backgroundColor,
        color: style.color,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing,
        opacity: style.opacity,
        overflow: style.overflow,
        flex: style.flex,
        gridTemplateColumns: style.gridTemplateColumns,
        alignItems: style.alignItems,
        justifyContent: style.justifyContent,
      };
    };
    const boxModelOf = (node: Element) => {
      const rect = node.getBoundingClientRect();
      const style = win.getComputedStyle(node);
      const number = (name: string) => Number.parseFloat(style.getPropertyValue(name)) || 0;
      const margin = { top: number('margin-top'), right: number('margin-right'), bottom: number('margin-bottom'), left: number('margin-left') };
      const border = { top: number('border-top-width'), right: number('border-right-width'), bottom: number('border-bottom-width'), left: number('border-left-width') };
      const padding = { top: number('padding-top'), right: number('padding-right'), bottom: number('padding-bottom'), left: number('padding-left') };
      return {
        rect: { x: rect.x, y: rect.y, top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left, width: rect.width, height: rect.height },
        margin,
        border,
        padding,
        content: {
          width: Math.max(0, rect.width - border.left - border.right - padding.left - padding.right),
          height: Math.max(0, rect.height - border.top - border.bottom - padding.top - padding.bottom),
        },
      };
    };
    const selectorFor = (node: Element) => {
      const parts: string[] = [];
      let current: Element | null = node;
      while (current && current.nodeType === Node.ELEMENT_NODE) {
        let part = current.tagName.toLowerCase();
        if (current.id) {
          part += `#${escapeCss(current.id)}`;
          parts.unshift(part);
          break;
        }
        const classes = Array.from(current.classList || []).map((name) => `.${escapeCss(name)}`).join('');
        part += classes;
        const parentEl: Element | null = current.parentElement;
        if (parentEl) {
          const currentTag = current.tagName;
          const siblings = Array.from(parentEl.children).filter((child) => child.tagName === currentTag);
          if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
        }
        parts.unshift(part);
        current = parentEl;
      }
      return parts.join(' > ');
    };
    const serializeNode = (node: Element): Record<string, unknown> => ({
      tag: node.tagName.toLowerCase(),
      id: node.id || '',
      className: typeof node.className === 'string' ? node.className : '',
      role: node.getAttribute('role') || '',
      ariaLabel: node.getAttribute('aria-label') || '',
      text: textOf(node),
      attributes: attrsOf(node),
      children: Array.from(node.children || []).map(serializeNode),
    });
    const ancestryOf = (node: Element) => {
      const out: Array<Record<string, string>> = [];
      let current: Element | null = node;
      while (current && current.nodeType === Node.ELEMENT_NODE) {
        out.push({
          tag: current.tagName.toLowerCase(),
          id: current.id || '',
          className: typeof current.className === 'string' ? current.className : '',
          role: current.getAttribute('role') || '',
          ariaLabel: current.getAttribute('aria-label') || '',
        });
        current = current.parentElement;
      }
      return out;
    };
    const positionTagFor = (rect: DOMRect) => {
      const y = rect.top + rect.height / 2;
      const x = rect.left + rect.width / 2;
      const vertical = y < win.innerHeight / 3 ? 'top' : y > win.innerHeight * 2 / 3 ? 'bottom' : 'middle';
      const horizontal = x < win.innerWidth / 3 ? 'left' : x > win.innerWidth * 2 / 3 ? 'right' : 'center';
      if (vertical === 'middle') return horizontal;
      if (horizontal === 'center') return vertical;
      return `${vertical}-${horizontal}`;
    };
    const clearHover = () => {
      hovered?.removeAttribute('data-pm-xmux-hover');
      hovered = null;
    };
    const cleanup = () => {
      clearHover();
      style.remove();
      doc.removeEventListener('mouseover', onHover, true);
      doc.removeEventListener('click', onClick, true);
      doc.removeEventListener('keydown', onKeyDown, true);
      delete (win as unknown as Record<string, unknown>)[key];
    };
    const cancel = () => {
      cleanup();
      resolve(JSON.stringify({ cancelled: true }));
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cancel();
      }
    };
    const onHover = (event: MouseEvent) => {
      clearHover();
      hovered = isFrameElement(event.target) ? event.target : null;
      hovered?.setAttribute('data-pm-xmux-hover', 'true');
    };
    const onClick = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const el = event.target;
      if (!isFrameElement(el)) {
        cleanup();
        resolve(JSON.stringify({ error: 'Clicked target was not an element.' }));
        return;
      }
      if (el === doc.documentElement || el === doc.body) {
        cleanup();
        resolve(JSON.stringify({ cancelled: true, reason: 'blank-area' }));
        return;
      }
      const rect = el.getBoundingClientRect();
      const payload = {
        source: 'Project Manager Xmux Select Element',
        url: win.location.href,
        capturedAt: new Date().toISOString(),
        selector: selectorFor(el),
        cssPath: selectorFor(el),
        positionTag: positionTagFor(rect),
        elementTag: el.tagName.toLowerCase(),
        classList: Array.from(el.classList || []),
        computedStyle: computedStyleOf(el),
        computedStyleSummary: computedStyleSummaryOf(el),
        boxModel: boxModelOf(el),
        element: {
          tag: el.tagName.toLowerCase(),
          id: el.id || '',
          className: typeof el.className === 'string' ? el.className : '',
          role: el.getAttribute('role') || '',
          ariaLabel: el.getAttribute('aria-label') || '',
          text: textOf(el),
          attributes: attrsOf(el),
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        },
        ancestry: ancestryOf(el),
        domTree: serializeNode(el),
        outerHTML: el.outerHTML,
      };
      cleanup();
      resolve(JSON.stringify(payload));
    };

    (win as unknown as Record<string, { cleanup: () => void; cancel: () => void }>)[key] = { cleanup, cancel };
    doc.addEventListener('mouseover', onHover, true);
    doc.addEventListener('click', onClick, true);
    doc.addEventListener('keydown', onKeyDown, true);
  });
}

export async function cancelBrowserElementSelection(itemId: string): Promise<void> {
  const session = sessions.get(itemId);
  if (!session) return;
  if (session.kind === 'tauri') {
    await xmuxWebviewEval(session.label, 'window.__pmXmuxSelectElement?.cancel?.();');
    return;
  }
  const win = iframeWindow(session);
  const state = (win as unknown as Record<string, { cancel?: () => void }>).__pmXmuxSelectElement;
  state?.cancel?.();
}

export async function getNativeCurrentUrl(itemId: string): Promise<string> {
  const session = requireNativeSession(itemId);
  const nativeUrl = await xmuxWebviewCurrentUrl(session.label);
  session.url = nativeUrl;
  session.lastNativeUrl = nativeUrl;
  return nativeUrl;
}

export async function reloadNativeBrowser(itemId: string): Promise<void> {
  const session = requireNativeSession(itemId);
  await xmuxWebviewReload(session.label);
}

export async function setNativeBrowserZoom(itemId: string, scaleFactor: number): Promise<void> {
  const session = requireNativeSession(itemId);
  await xmuxWebviewSetZoom(session.label, scaleFactor);
}

export async function clearNativeBrowsingData(itemId: string): Promise<void> {
  const session = requireNativeSession(itemId);
  await xmuxWebviewClearBrowsingData(session.label);
}

export async function clearNativeCookies(itemId: string): Promise<void> {
  const session = requireNativeSession(itemId);
  await xmuxWebviewClearCookies(session.label);
}

export async function evalNativeBrowserScript(itemId: string, script: string): Promise<void> {
  const session = requireNativeSession(itemId);
  await xmuxWebviewEval(session.label, script);
}

export async function openNativeBrowserDevtools(itemId: string): Promise<void> {
  const session = requireNativeSession(itemId);
  await xmuxWebviewOpenDevtools(session.label);
}

export async function closeNativeBrowserDevtools(itemId: string): Promise<void> {
  const session = requireNativeSession(itemId);
  await xmuxWebviewCloseDevtools(session.label);
}

export async function isNativeBrowserDevtoolsOpen(itemId: string): Promise<boolean> {
  const session = requireNativeSession(itemId);
  return xmuxWebviewIsDevtoolsOpen(session.label);
}

export async function getNativeConsoleEntries(itemId: string): Promise<string> {
  const session = requireNativeSession(itemId);
  return xmuxWebviewConsoleEntries(session.label);
}

export async function clearNativeConsoleEntries(itemId: string): Promise<void> {
  const session = requireNativeSession(itemId);
  await xmuxWebviewClearConsole(session.label);
}

export async function selectNativeBrowserElement(itemId: string): Promise<string> {
  const session = requireNativeSession(itemId);
  return xmuxWebviewSelectElement(session.label);
}

export async function selectBrowserElement(itemId: string): Promise<string> {
  const session = sessions.get(itemId);
  if (!session) {
    throw new Error('Browser session is not ready yet.');
  }
  if (session.kind === 'tauri') {
    if (!session.created) {
      throw new Error('Native browser is still loading. Try again after the page appears.');
    }
    return xmuxWebviewSelectElement(session.label);
  }
  return selectIframeBrowserElement(itemId);
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
