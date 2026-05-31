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
  iframe.src = url;
  hostDiv.appendChild(iframe);

  return { kind: 'iframe', hostDiv, iframe, url };
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
  if (session.kind === 'iframe' && session.iframe.src !== initialUrl) {
    session.iframe.src = initialUrl;
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
    if (session.iframe.src !== url) {
      session.iframe.src = url;
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
