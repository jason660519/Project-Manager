'use client';

import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { Terminal } from '@xterm/xterm';
import { useEffect, useRef, useState } from 'react';
import '@xterm/xterm/css/xterm.css';

type PtyHandle = {
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: (signal?: string) => void;
  onData: (listener: (data: Uint8Array) => void) => { dispose: () => void };
};

const SHELL = '/bin/zsh';

async function spawnPty(cwd: string, cols: number, rows: number): Promise<PtyHandle> {
  const { spawn } = await import('tauri-pty');
  return spawn(SHELL, ['-l'], {
    cols,
    rows,
    cwd,
    env: { TERM: 'xterm-256color' },
  }) as PtyHandle;
}

export interface EmbeddedXtermPaneProps {
  cwd: string;
  sessionKey: string;
}

export function EmbeddedXtermPane({ cwd, sessionKey }: EmbeddedXtermPaneProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [isTauri, setIsTauri] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renderer, setRenderer] = useState<'webgl' | 'canvas'>('canvas');

  useEffect(() => {
    setIsTauri(typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window);
  }, []);

  useEffect(() => {
    if (!isTauri || !hostRef.current || !cwd) return;

    let disposed = false;
    const host = hostRef.current;
    setError(null);

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

    let webglAddon: WebglAddon | null = null;
    try {
      webglAddon = new WebglAddon();
      term.loadAddon(webglAddon);
      if (!disposed) setRenderer('webgl');
    } catch {
      if (!disposed) setRenderer('canvas');
    }

    term.open(host);
    fitAddon.fit();

    const ptyRef: { current: PtyHandle | null } = { current: null };
    let dataDisposable: { dispose: () => void } | null = null;

    const inputDisposable = term.onData((data) => {
      ptyRef.current?.write(data);
    });

    void (async () => {
      try {
        const handle = await spawnPty(cwd, term.cols, term.rows);
        if (disposed) {
          handle.kill();
          return;
        }
        ptyRef.current = handle;
        dataDisposable = handle.onData((chunk) => {
          term.write(chunk);
        });
      } catch (err) {
        if (!disposed) {
          const message = err instanceof Error ? err.message : String(err);
          setError(message);
          term.writeln(`\r\n\x1b[31mFailed to start shell: ${message}\x1b[0m`);
        }
      }
    })();

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (disposed) return;
        fitAddon.fit();
        if (ptyRef.current) {
          ptyRef.current.resize(term.cols, term.rows);
        }
      }, 32);
    };

    const resizeObserver = new ResizeObserver(scheduleResize);
    resizeObserver.observe(host);

    return () => {
      disposed = true;
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      inputDisposable.dispose();
      dataDisposable?.dispose();
      ptyRef.current?.kill();
      ptyRef.current = null;
      webglAddon?.dispose();
      term.dispose();
    };
  }, [isTauri, cwd, sessionKey]);

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-[#1e1e1e]">
      <div ref={hostRef} className="h-full overflow-hidden p-1" aria-label="Embedded terminal" />
      {!isTauri ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1e1e1e]/95 p-4 text-center text-[12px] text-stone-400">
          Embedded terminal requires <code className="text-stone-300">npm run tauri:dev</code> (PTY + GPU xterm).
          Browser preview cannot host a shell inside the pane.
        </div>
      ) : null}
      {isTauri ? (
        <div className="pointer-events-none absolute bottom-1 right-2 font-mono text-[9px] text-stone-600">
          {renderer === 'webgl' ? 'xterm/webgl' : 'xterm/canvas'} · libghostty planned
        </div>
      ) : null}
      {error ? (
        <p className="absolute bottom-0 left-0 right-0 border-t border-stone-800 bg-[#1e1e1e] px-2 py-1 text-[10px] text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
