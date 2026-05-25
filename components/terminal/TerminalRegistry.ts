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
import { WebglAddon } from '@xterm/addon-webgl';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';

const SHELL = '/bin/zsh';
const MIN_DIM = 20; // hostDiv must be at least this large in both axes before we trust fit()

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
  webglAddon: WebglAddon | null;
  pty: PtyHandle | null;
  inputDisposable: { dispose: () => void };
  dataDisposable: { dispose: () => void } | null;
  resizeObserver: ResizeObserver | null;
  resizeTimer: ReturnType<typeof setTimeout> | null;
  cwd: string;
  pendingSpawn: Promise<void> | null;
  destroyed: boolean;
  // term.open() and WebglAddon init must happen on an attached div; otherwise
  // xterm caches a 0x0 canvas and the renderer never recovers. We defer the
  // expensive bits until the first attach() call.
  initialized: boolean;
}

const sessions = new Map<string, Session>();
let limboDiv: HTMLDivElement | null = null;

function ensureLimbo(): HTMLDivElement {
  if (typeof document === 'undefined') {
    throw new Error('TerminalRegistry: requires a DOM');
  }
  if (!limboDiv) {
    limboDiv = document.createElement('div');
    limboDiv.setAttribute('data-terminal-limbo', '');
    // Off-screen but still part of the layout tree so xterm DOM stays valid.
    limboDiv.style.cssText =
      'position:fixed;left:-99999px;top:-99999px;width:1px;height:1px;overflow:hidden;visibility:hidden;pointer-events:none;';
    document.body.appendChild(limboDiv);
  }
  return limboDiv;
}

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
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
    'position:relative;width:100%;height:100%;background:#1e1e1e;padding:4px;box-sizing:border-box;overflow:hidden;';

  const term = new Terminal({
    cursorBlink: true,
    fontSize: 13,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    allowProposedApi: true,
    scrollback: 5000,
    theme: {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      cursor: '#d4d4d4',
      selectionBackground: '#264f78',
    },
  });

  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);

  // NOTE: WebglAddon and term.open() are deferred to initializeIfNeeded() —
  // they need the host DIV to be DOM-attached with non-zero size.

  const session: Session = {
    hostDiv,
    term,
    fitAddon,
    webglAddon: null,
    pty: null,
    inputDisposable: { dispose: () => {} },
    dataDisposable: null,
    resizeObserver: null,
    resizeTimer: null,
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

// First-attach init: must happen with hostDiv in the DOM (so xterm's renderer
// reads real dimensions and WebGL gets a valid canvas to draw on).
function initializeIfNeeded(session: Session): void {
  if (session.initialized || session.destroyed) return;
  if (!session.hostDiv.isConnected) return;

  try {
    const webgl = new WebglAddon();
    session.term.loadAddon(webgl);
    session.webglAddon = webgl;
  } catch {
    session.webglAddon = null;
  }

  session.term.open(session.hostDiv);

  if (!isTauri()) {
    session.term.writeln(
      '\x1b[33mEmbedded terminal requires `npm run tauri:dev` (PTY + GPU xterm).\x1b[0m',
    );
    session.term.writeln(
      '\x1b[33mBrowser preview cannot host a shell inside the pane.\x1b[0m',
    );
  }

  // ResizeObserver fires whenever host dimensions change, including when the
  // host moves from a 0-sized limbo into a real slot. Used to fit xterm and to
  // trigger the deferred PTY spawn (we wait for real dims before spawning).
  const ro = new ResizeObserver(() => {
    if (session.destroyed) return;
    if (session.resizeTimer) clearTimeout(session.resizeTimer);
    session.resizeTimer = setTimeout(() => {
      if (session.destroyed) return;
      if (!session.hostDiv.isConnected) return;
      if (session.hostDiv.clientWidth < MIN_DIM || session.hostDiv.clientHeight < MIN_DIM) return;
      try {
        session.fitAddon.fit();
      } catch {
        return;
      }
      session.pty?.resize(session.term.cols, session.term.rows);
      if (!session.pty && !session.pendingSpawn && isTauri()) {
        session.pendingSpawn = startPty(session).finally(() => {
          session.pendingSpawn = null;
        });
      }
    }, 32);
  });
  ro.observe(session.hostDiv);
  session.resizeObserver = ro;

  session.initialized = true;
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
  // Now that hostDiv is attached, run the lazy init (xterm.open + addon load).
  initializeIfNeeded(session);
}

export function detach(itemId: string): void {
  const session = sessions.get(itemId);
  if (!session) return;
  const limbo = ensureLimbo();
  if (session.hostDiv.parentElement !== limbo) {
    limbo.appendChild(session.hostDiv);
  }
}

export function destroy(itemId: string): void {
  const session = sessions.get(itemId);
  if (!session) return;
  session.destroyed = true;
  if (session.resizeTimer) clearTimeout(session.resizeTimer);
  session.resizeObserver?.disconnect();
  session.inputDisposable.dispose();
  session.dataDisposable?.dispose();
  session.pty?.kill();
  session.webglAddon?.dispose();
  session.term.dispose();
  session.hostDiv.remove();
  sessions.delete(itemId);
}
