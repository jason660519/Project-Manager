'use client';

// TerminalRegistry — keep xterm.js + tauri-pty sessions alive outside React.
//
// Why: when the xmux layout tree restructures (sibling block closed → split
// collapses), React unmounts and remounts the surviving Block at a different
// position. If xterm lived inside that subtree, every collapse would kill the
// running shell. The registry holds the host DIV + xterm instance + PTY in
// module-level state and only moves the host DIV between slot containers in
// the React tree (or a hidden "limbo" container when no slot is mounted).
//
// API:
//   attach(itemId, slot, cwd)  → create session if new, append host DIV to slot
//   detach(itemId)             → move host DIV to limbo (session survives)
//   destroy(itemId)            → kill PTY, dispose xterm, drop session

import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { isTauriRuntime } from '../../lib/runtime/tauri-ready';
import { EDITOR_BG, XTERM_THEME } from '../../lib/tokens/editor-colors';

const SHELL = '/bin/zsh';
const MIN_DIM = 20; // hostDiv must be at least this large in both axes before we trust fit()
const MAX_OPEN_ATTEMPTS = 180; // ~3s at 60fps

type PtyHandle = {
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: (signal?: string) => void;
  onData: (listener: (data: Uint8Array) => void) => { dispose: () => void };
};

interface Session {
  hostDiv: HTMLDivElement;
  term: Terminal;
  fitAddon: FitAddon;
  pty: PtyHandle | null;
  inputDisposable: { dispose: () => void };
  dataDisposable: { dispose: () => void } | null;
  resizeObserver: ResizeObserver | null;
  resizeTimer: ReturnType<typeof setTimeout> | null;
  openRafId: number | null;
  openAttempts: number;
  cwd: string;
  pendingSpawn: Promise<void> | null;
  destroyed: boolean;
  initialized: boolean;
}

const sessions = new Map<string, Session>();
let limboDiv: HTMLDivElement | null = null;

function hostHasUsableSize(hostDiv: HTMLDivElement): boolean {
  return (
    hostDiv.isConnected &&
    hostDiv.clientWidth >= MIN_DIM &&
    hostDiv.clientHeight >= MIN_DIM
  );
}

function ensureLimbo(): HTMLDivElement {
  if (typeof document === 'undefined') {
    throw new Error('TerminalRegistry: requires a DOM');
  }
  if (!limboDiv) {
    limboDiv = document.createElement('div');
    limboDiv.setAttribute('data-terminal-limbo', '');
    limboDiv.style.cssText =
      'position:fixed;left:-99999px;top:-99999px;width:1px;height:1px;overflow:hidden;visibility:hidden;pointer-events:none;';
    document.body.appendChild(limboDiv);
  }
  return limboDiv;
}

async function spawnPty(cwd: string, cols: number, rows: number): Promise<PtyHandle> {
  const { spawn } = await import('tauri-pty');
  return spawn(SHELL, ['-l'], {
    cols,
    rows,
    cwd,
    env: { TERM: 'xterm-256color' },
  }) as PtyHandle;
}

function createSession(itemId: string, cwd: string): Session {
  const hostDiv = document.createElement('div');
  hostDiv.setAttribute('data-terminal-host', itemId);
  hostDiv.style.cssText =
    `position:relative;width:100%;height:100%;background:${EDITOR_BG};padding:4px;box-sizing:border-box;overflow:hidden;`;

  const term = new Terminal({
    cursorBlink: true,
    fontSize: 13,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    allowProposedApi: true,
    scrollback: 5000,
    theme: XTERM_THEME,
  });

  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);

  const session: Session = {
    hostDiv,
    term,
    fitAddon,
    pty: null,
    inputDisposable: { dispose: () => {} },
    dataDisposable: null,
    resizeObserver: null,
    resizeTimer: null,
    openRafId: null,
    openAttempts: 0,
    cwd,
    pendingSpawn: null,
    destroyed: false,
    initialized: false,
  };

  session.inputDisposable = term.onData((data) => {
    session.pty?.write(data);
  });

  return session;
}

function tryOpenTerminal(session: Session): boolean {
  if (session.initialized || session.destroyed) return false;
  if (!hostHasUsableSize(session.hostDiv)) return false;

  session.term.open(session.hostDiv);

  if (!isTauriRuntime()) {
    session.term.writeln(
      '\x1b[33mEmbedded terminal requires `npm run tauri:dev` (PTY + xterm).\x1b[0m',
    );
    session.term.writeln(
      '\x1b[33mBrowser preview cannot host a shell inside the pane.\x1b[0m',
    );
  }

  session.initialized = true;
  return true;
}

function scheduleOpenAttempts(session: Session): void {
  if (session.initialized || session.destroyed) return;
  if (session.openRafId !== null) return;

  const tick = () => {
    session.openRafId = null;
    if (session.destroyed || session.initialized) return;
    if (tryOpenTerminal(session)) {
      scheduleFitAndSpawn(session);
      return;
    }
    session.openAttempts += 1;
    if (session.openAttempts >= MAX_OPEN_ATTEMPTS) {
      if (session.hostDiv.isConnected) {
        session.term.writeln(
          '\r\n\x1b[31mTerminal pane has no usable size — try resizing the split.\x1b[0m',
        );
        session.initialized = true;
      }
      return;
    }
    if (session.hostDiv.isConnected) {
      session.openRafId = requestAnimationFrame(tick);
    }
  };
  session.openRafId = requestAnimationFrame(tick);
}

function scheduleFitAndSpawn(session: Session): void {
  if (session.destroyed || !session.initialized) return;
  if (!hostHasUsableSize(session.hostDiv)) return;
  if (session.resizeTimer) clearTimeout(session.resizeTimer);
  session.resizeTimer = setTimeout(() => {
    if (session.destroyed || !session.initialized) return;
    if (!hostHasUsableSize(session.hostDiv)) return;
    try {
      session.fitAddon.fit();
    } catch {
      return;
    }
    session.pty?.resize(session.term.cols, session.term.rows);
    if (!session.pty && !session.pendingSpawn && isTauriRuntime()) {
      session.pendingSpawn = startPty(session).finally(() => {
        session.pendingSpawn = null;
      });
    }
  }, 32);
}

function ensureResizeObserver(session: Session): void {
  if (session.resizeObserver) return;
  const ro = new ResizeObserver(() => {
    if (session.destroyed) return;
    if (!session.initialized) {
      scheduleOpenAttempts(session);
      return;
    }
    scheduleFitAndSpawn(session);
  });
  ro.observe(session.hostDiv);
  session.resizeObserver = ro;
}

async function startPty(session: Session): Promise<void> {
  if (session.pty || session.destroyed) return;
  try {
    const cols = session.term.cols > 0 ? session.term.cols : 80;
    const rows = session.term.rows > 0 ? session.term.rows : 24;
    const pty = await spawnPty(session.cwd, cols, rows);
    if (session.destroyed) {
      pty.kill();
      return;
    }
    session.pty = pty;
    session.dataDisposable = pty.onData((chunk) => {
      session.term.write(chunk);
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    session.term.writeln(`\r\n\x1b[31mFailed to start shell: ${message}\x1b[0m`);
  }
}

export function attach(itemId: string, slot: HTMLElement, cwd: string): void {
  let session = sessions.get(itemId);
  if (!session) {
    session = createSession(itemId, cwd);
    sessions.set(itemId, session);
  }
  if (session.hostDiv.parentElement !== slot) {
    slot.appendChild(session.hostDiv);
  }
  session.openAttempts = 0;
  ensureResizeObserver(session);
  scheduleOpenAttempts(session);
  if (session.initialized) {
    scheduleFitAndSpawn(session);
  }
}

/** Called when a terminal tab becomes visible — opens/fits if still deferred. */
export function notifySlotVisible(itemId: string): void {
  const session = sessions.get(itemId);
  if (!session || session.destroyed) return;
  ensureResizeObserver(session);
  session.openAttempts = 0;
  scheduleOpenAttempts(session);
  if (session.initialized) {
    scheduleFitAndSpawn(session);
  }
}

export function writeTerminalInput(itemId: string, text: string): void {
  const session = sessions.get(itemId);
  if (!session || session.destroyed || !text) return;
  session.term.focus();
  if (session.pty) {
    session.pty.write(text);
    return;
  }
  session.term.write(text);
}

export function detach(itemId: string): void {
  const session = sessions.get(itemId);
  if (!session) return;
  if (session.openRafId !== null) {
    cancelAnimationFrame(session.openRafId);
    session.openRafId = null;
  }
  const limbo = ensureLimbo();
  if (session.hostDiv.parentElement !== limbo) {
    limbo.appendChild(session.hostDiv);
  }
}

export function destroy(itemId: string): void {
  const session = sessions.get(itemId);
  if (!session) return;
  session.destroyed = true;
  if (session.openRafId !== null) {
    cancelAnimationFrame(session.openRafId);
    session.openRafId = null;
  }
  if (session.resizeTimer) clearTimeout(session.resizeTimer);
  session.resizeObserver?.disconnect();
  session.inputDisposable.dispose();
  session.dataDisposable?.dispose();
  session.pty?.kill();
  session.term.dispose();
  session.hostDiv.remove();
  sessions.delete(itemId);
}
