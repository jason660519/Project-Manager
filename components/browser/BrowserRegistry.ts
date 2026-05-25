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

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
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
  pendingCreate: Promise<void> | null;
  lastBounds: { x: number; y: number; width: number; height: number } | null;
}

type Session = IframeSession | TauriSession;

const sessions = new Map<string, Session>();
let limboDiv: HTMLDivElement | null = null;

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
    pendingCreate: null,
    lastBounds: null,
  };
}

function promoteTauriToIframe(itemId: string, session: TauriSession, url: string): IframeSession {
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
  if (session.created) {
    return xmuxWebviewSetBounds(
      session.label,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
    ).catch((err) => {
      console.error('[BrowserRegistry] set_bounds failed', err);
    });
  }
  if (session.pendingCreate) return session.pendingCreate;
  session.pendingCreate = xmuxWebviewCreate(
    session.label,
    session.url,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
  )
    .then(() => {
      session.created = true;
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
      console.error('[BrowserRegistry] embed create failed; iframe fallback', err);
      promoteTauriToIframe(itemId, session, session.url);
    })
    .finally(() => {
      session.pendingCreate = null;
    });
  return session.pendingCreate;
}

export function attach(itemId: string, slot: HTMLElement, initialUrl: string): void {
  let session = sessions.get(itemId);
  if (!session) {
    session = isTauri()
      ? createTauriSession(itemId, initialUrl)
      : createIframeSession(initialUrl);
    sessions.set(itemId, session);
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
      console.error('[BrowserRegistry] show failed', err);
    });
  }
}

export function detach(itemId: string): void {
  const session = sessions.get(itemId);
  if (!session) return;
  const limbo = ensureLimbo();
  if (session.hostDiv.parentElement !== limbo) {
    limbo.appendChild(session.hostDiv);
  }
  if (session.kind === 'tauri' && session.visible) {
    session.visible = false;
    void xmuxWebviewSetVisible(session.label, false).catch((err) => {
      console.error('[BrowserRegistry] hide failed', err);
    });
  }
}

export function destroy(itemId: string): void {
  const session = sessions.get(itemId);
  if (!session) return;
  session.hostDiv.remove();
  if (session.kind === 'tauri') {
    void xmuxWebviewSetVisible(session.label, false).catch(() => {});
    void xmuxWebviewDestroy(session.label).catch((err) => {
      console.error('[BrowserRegistry] destroy failed', err);
    });
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
    console.error('[BrowserRegistry] navigate failed', err);
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
  if (!session.created && !session.pendingCreate) {
    void ensureCreated(itemId, session, bounds).then(() => {
      const current = sessions.get(itemId);
      if (!current || current.kind !== 'tauri') return;
      if (!current.visible) {
        current.visible = true;
        return xmuxWebviewSetVisible(current.label, true).catch((err) => {
          console.error('[BrowserRegistry] show (post-create) failed', err);
        });
      }
    });
    return;
  }
  if (!session.created) return;
  if (!session.visible) {
    session.visible = true;
    void xmuxWebviewSetVisible(session.label, true).catch((err) => {
      console.error('[BrowserRegistry] show failed', err);
    });
  }
  void xmuxWebviewSetBounds(session.label, x, y, width, height).catch((err) => {
    console.error('[BrowserRegistry] set_bounds failed', err);
  });
}

export function setSlotHidden(itemId: string): void {
  const session = sessions.get(itemId);
  if (!session || session.kind !== 'tauri') return;
  if (!session.visible) return;
  session.visible = false;
  void xmuxWebviewSetVisible(session.label, false).catch((err) => {
    console.error('[BrowserRegistry] hide (slot hidden) failed', err);
  });
}

export function getCurrentUrl(itemId: string): string | null {
  return sessions.get(itemId)?.url ?? null;
}

export function backendKind(): 'tauri' | 'iframe' {
  return isTauri() ? 'tauri' : 'iframe';
}

export function purgeOrphanNativeWebviews(): void {
  if (!isTauri()) return;
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
  if (limboDiv?.parentElement) {
    limboDiv.remove();
  }
  limboDiv = null;
}
