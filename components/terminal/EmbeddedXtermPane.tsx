'use client';

import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { useEffect, useRef, useState } from 'react';
import '@xterm/xterm/css/xterm.css';

type PtyHandle = {
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: (signal?: string) => void;
  onData: (listener: (data: Uint8Array) => void) => { dispose: () => void };
};

function defaultShell(): string {
  return '/bin/zsh';
}

async function spawnPty(
  shell: string,
  cwd: string,
  cols: number,
  rows: number,
): Promise<PtyHandle> {
  const { spawn } = await import('tauri-pty');
  return spawn(shell, ['-l'], {
    cols,
    rows,
    cwd,
    env: { TERM: 'xterm-256color' },
  }) as PtyHandle;
}

export interface EmbeddedXtermPaneProps {
  title: string;
  cwd: string;
  /** Stable id so multiple panes do not share one PTY session. */
  sessionKey: string;
}

export function EmbeddedXtermPane({ title, cwd, sessionKey }: EmbeddedXtermPaneProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [isTauri, setIsTauri] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setIsTauri(typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window);
  }, []);

  useEffect(() => {
    if (!isTauri || !hostRef.current || !cwd) return;

    let disposed = false;
    const host = hostRef.current;
    setError(null);
    setReady(false);

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        selectionBackground: '#264f78',
      },
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(host);
    fitAddon.fit();

    const ptyRef: { current: PtyHandle | null } = { current: null };
    let dataDisposable: { dispose: () => void } | null = null;
    const inputDisposable = term.onData((data) => {
      ptyRef.current?.write(data);
    });

    void (async () => {
      try {
        const shell = defaultShell();
        const handle = await spawnPty(shell, cwd, term.cols, term.rows);
        if (disposed) {
          handle.kill();
          return;
        }
        ptyRef.current = handle;
        dataDisposable = handle.onData((chunk) => {
          term.write(chunk);
        });
        setReady(true);
      } catch (err) {
        if (!disposed) {
          const message = err instanceof Error ? err.message : String(err);
          setError(message);
          term.writeln(`\r\n\x1b[31mFailed to start shell: ${message}\x1b[0m`);
        }
      }
    })();

    const resizeObserver = new ResizeObserver(() => {
      if (disposed) return;
      fitAddon.fit();
      if (ptyRef.current) {
        ptyRef.current.resize(term.cols, term.rows);
      }
    });
    resizeObserver.observe(host);

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      inputDisposable.dispose();
      dataDisposable?.dispose();
      ptyRef.current?.kill();
      ptyRef.current = null;
      term.dispose();
      setReady(false);
    };
  }, [isTauri, cwd, sessionKey]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#1e1e1e]">
      <div className="flex h-7 shrink-0 items-center justify-between border-b border-stone-800 px-2 text-[11px] text-stone-500">
        <span>{title}</span>
        <span className="truncate font-mono text-[10px] text-stone-600" title={cwd}>
          {ready ? cwd : 'Starting…'}
        </span>
      </div>
      <div className="relative min-h-0 flex-1">
        <div ref={hostRef} className="h-full overflow-hidden p-1" aria-label={`${title} embedded terminal`} />
        {!isTauri ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[#1e1e1e]/95 p-4 text-center text-[12px] text-stone-400">
            Embedded terminal requires the Project Manager desktop app (
            <code className="text-stone-300">npm run tauri:dev</code>). Web preview cannot host a PTY inside the pane.
          </div>
        ) : null}
      </div>
      {error ? <p className="shrink-0 border-t border-stone-800 px-2 py-1 text-[10px] text-red-300">{error}</p> : null}
    </div>
  );
}
