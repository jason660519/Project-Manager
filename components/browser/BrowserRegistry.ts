'use client';

// BrowserRegistry — single contract, two backends.
//
//   Web preview (no Tauri):  iframe in a host DIV (subject to X-Frame-Options)
//   Tauri runtime:           native child Webview overlay, positioned via
//                            set_bounds calls from BrowserSlot's ResizeObserver
//                            (NOT subject to X-Frame-Options)
//
// Both backends honour the same lifecycle: attach claims the slot, detach
// returns to limbo / hides, destroy disposes for good. Callers (BrowserSlot,
// Block) don't know which backend is in use.

import {
  xmuxWebviewCreate,
  xmuxWebviewDestroy,
  xmuxWebviewNavigate,
  xmuxWebviewSetBounds,
  xmuxWebviewSetVisible,
} from '../../lib/bridge';

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function webviewLabel(itemId: string): string {
  return `xmux-browser-${itemId}`;
}

// ── Iframe backend (web preview / fallback) ─────────────────────────────────

interface IframeSession {
  kind: 'iframe';
  hostDiv: HTMLDivElement;
  iframe: HTMLIFrameElement;
  url: string;
}

// ── Tauri native webview backend ────────────────────────────────────────────
//
// `hostDiv` here is just a positional anchor — it stays empty. The actual
// content is an OS-level webview that the Rust side overlays on top of it.
// Slot rect → set_bounds keeps the overlay aligned with the anchor.

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
  hostDiv.style.cssText = 'width:100%;height:100%;display:flex;';

  const iframe = document.createElement('iframe');
  iframe.title = 'xmux browser pane';
  iframe.style.cssText = 'flex:1;min-height:0;border:0;background:white;';
  iframe.src = url;
  hostDiv.appendChild(iframe);

  return { kind: 'iframe', hostDiv, iframe, url };
}

function createTauriSession(itemId: string, url: string): TauriSession {
  const hostDiv = document.createElement('div');
  hostDiv.setAttribute('data-browser-anchor', itemId);
  // Anchor div is empty + transparent — the overlay sits on top.
  hostDiv.style.cssText = 'width:100%;height:100%;background:#1e1e1e;';

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

// Lazy: don't fire xmux_webview_create until we have real bounds from a
// setBounds call. Creating with placeholder dims caused the webview to land at
// the wrong rect and never sync until the next bounds change.
function ensureCreated(
  session: TauriSession,
  bounds: { x: number; y: number; width: number; height: number },
): Promise<void> {
  if (session.created) {
    // Bounds changed since last set? Push the latest.
    return xmuxWebviewSetBounds(
      session.label,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
    ).catch((err) => {
      console.error('[BrowserRegistry] set_bounds (post-create) failed', err);
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
      // The slot might have moved while create was in-flight — sync once.
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
      console.error('[BrowserRegistry] xmux_webview_create failed', err);
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
  if (session.hostDiv.parentElement !== slot) {
    slot.appendChild(session.hostDiv);
  }
  if (session.kind === 'tauri') {
    // Defer create until first setBounds delivers real dimensions.
    // BrowserSlot's rAF tick will reach setBounds within one frame.
    if (session.created && !session.visible) {
      session.visible = true;
      void xmuxWebviewSetVisible(session.label, true).catch((err) => {
        console.error('[BrowserRegistry] show failed', err);
      });
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
  // Pull the host DIV out of the DOM immediately so any visual association
  // with the (still-OS-level) webview ends right now even if close has latency.
  session.hostDiv.remove();
  if (session.kind === 'tauri') {
    // Hide first (synchronous-looking from user's perspective), then close.
    // If close has a bug or latency, at least the overlay is gone visually.
    void xmuxWebviewSetVisible(session.label, false).catch(() => {});
    void xmuxWebviewDestroy(session.label).catch((err) => {
      console.error('[BrowserRegistry] destroy failed', err);
    });
  }
  sessions.delete(itemId);
}

export function navigate(itemId: string, url: string): void {
  const session = sessions.get(itemId);
  if (!session) return;
  if (session.url === url) return;
  session.url = url;
  if (session.kind === 'iframe') {
    session.iframe.src = url;
    return;
  }
  // Tauri: if webview not yet created (no real bounds yet), the url is already
  // stored on the session and create will pick it up. Otherwise navigate.
  if (!session.created) return;
  void xmuxWebviewNavigate(session.label, url).catch((err) => {
    console.error('[BrowserRegistry] navigate failed', err);
  });
}

// Slot's rAF tick feeds rect updates here. First call (when !created) triggers
// xmux_webview_create with real bounds; subsequent calls update position.
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
    // First real bounds — create now and let the show-on-attach finish below.
    void ensureCreated(session, bounds).then(() => {
      if (!session.visible) {
        session.visible = true;
        return xmuxWebviewSetVisible(session.label, true).catch((err) => {
          console.error('[BrowserRegistry] show (post-create) failed', err);
        });
      }
    });
    return;
  }
  if (!session.created) return; // create in-flight; will sync on completion
  // Ensure visible — slot might have come back from display:none.
  if (!session.visible) {
    session.visible = true;
    void xmuxWebviewSetVisible(session.label, true).catch((err) => {
      console.error('[BrowserRegistry] show (rect-restore) failed', err);
    });
  }
  void xmuxWebviewSetBounds(session.label, x, y, width, height).catch((err) => {
    console.error('[BrowserRegistry] set_bounds failed', err);
  });
}

// Slot's rAF tick calls this when its rect is zero-area (parent is
// display:none — usually because another tab is active in the same block).
// Without this, every created webview stays set_visible(true) and they stack
// on top of each other in OS z-order, so the user keeps seeing the LAST
// webview no matter which React tab is active. Critical for tab switching.
export function setSlotHidden(itemId: string): void {
  const session = sessions.get(itemId);
  if (!session || session.kind !== 'tauri') return;
  if (!session.visible) return;
  session.visible = false;
  void xmuxWebviewSetVisible(session.label, false).catch((err) => {
    console.error('[BrowserRegistry] hide (slot zero-area) failed', err);
  });
}

export function getCurrentUrl(itemId: string): string | null {
  return sessions.get(itemId)?.url ?? null;
}

export function backendKind(): 'tauri' | 'iframe' {
  return isTauri() ? 'tauri' : 'iframe';
}

// Test helper: clear all session state. Production code never calls this;
// vitest setup calls it in beforeEach to prevent module-level state from
// leaking across test cases.
export function __resetForTests(): void {
  for (const session of sessions.values()) {
    session.hostDiv.remove();
  }
  sessions.clear();
  if (limboDiv && limboDiv.parentElement) {
    limboDiv.remove();
  }
  limboDiv = null;
}
