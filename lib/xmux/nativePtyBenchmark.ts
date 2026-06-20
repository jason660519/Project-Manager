'use client';

import { isTauriRuntime } from '../runtime/tauri-ready';
import { spawn } from 'tauri-pty';

const SHELL = '/bin/zsh';
const SENTINEL = '__XMUX_PTY_BENCH_DONE__';

export interface NativePtyBenchmarkOptions {
  cwd: string;
  bytes: number;
  timeoutMs: number;
}

export interface NativePtyBenchmarkResult {
  nativePtyAvailable: boolean;
  bytesRequested: number;
  bytesRead: number;
  elapsedMs: number;
  throughputBytesPerSecond: number;
  sentinelSeen: boolean;
  notes: string[];
}

type PtyHandle = {
  write: (data: string) => void;
  kill: (signal?: string) => void;
  onData: (listener: (data: unknown) => void) => { dispose: () => void };
  onExit: (listener: (event: { exitCode: number; signal?: number }) => void) => { dispose: () => void };
};

function buildBenchmarkCommand(bytes: number): string {
  const size = Math.max(1, Math.floor(bytes));
  return `stty -echo\nprintf '%*s' ${size} '' | tr ' ' x; printf '\\n${SENTINEL}\\n'; stty echo\n`;
}

function normalizePtyChunk(chunk: unknown): Uint8Array {
  if (ArrayBuffer.isView(chunk)) {
    return new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  }
  if (Array.isArray(chunk)) return Uint8Array.from(chunk);
  if (
    chunk &&
    typeof chunk === 'object' &&
    Array.isArray((chunk as { data?: unknown }).data)
  ) {
    return Uint8Array.from((chunk as { data: number[] }).data);
  }
  throw new Error('Unsupported PTY data chunk shape.');
}

export async function runNativePtyBenchmark(
  options: NativePtyBenchmarkOptions,
): Promise<NativePtyBenchmarkResult> {
  const bytesRequested = Math.max(1, Math.floor(options.bytes));
  const timeoutMs = Math.max(1, Math.floor(options.timeoutMs));
  if (!isTauriRuntime()) {
    return {
      nativePtyAvailable: false,
      bytesRequested,
      bytesRead: 0,
      elapsedMs: 0,
      throughputBytesPerSecond: 0,
      sentinelSeen: false,
      notes: ['Native PTY throughput requires the Tauri runtime.'],
    };
  }

  const startedAt = performance.now();
  const decoder = new TextDecoder();
  const pty = spawn(SHELL, ['-l'], {
    cols: 80,
    rows: 24,
    cwd: options.cwd,
    env: { TERM: 'xterm-256color' },
  }) as PtyHandle;

  return new Promise<NativePtyBenchmarkResult>((resolve) => {
    let bytesRead = 0;
    let buffer = '';
    let settled = false;
    let dataDisposable: { dispose: () => void } | null = null;
    let exitDisposable: { dispose: () => void } | null = null;

    const finish = (nativePtyAvailable: boolean, sentinelSeen: boolean, notes: string[]) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      dataDisposable?.dispose();
      exitDisposable?.dispose();
      try {
        pty.kill();
      } catch {
        // Best-effort cleanup; benchmark result should still be reported.
      }

      const elapsedMs = Math.max(1, Math.round(performance.now() - startedAt));
      resolve({
        nativePtyAvailable,
        bytesRequested,
        bytesRead,
        elapsedMs,
        throughputBytesPerSecond: Math.round((bytesRead / elapsedMs) * 1000),
        sentinelSeen,
        notes,
      });
    };

    const timeoutId = window.setTimeout(() => {
      finish(false, false, [`Native PTY benchmark timed out after ${timeoutMs}ms.`]);
    }, timeoutMs);

    dataDisposable = pty.onData((rawChunk) => {
      const chunk = normalizePtyChunk(rawChunk);
      bytesRead += chunk.byteLength;
      buffer += decoder.decode(chunk, { stream: true });
      if (bytesRead >= bytesRequested && buffer.includes(SENTINEL)) {
        finish(true, true, []);
      }
    });
    exitDisposable = pty.onExit((event) => {
      finish(false, false, [`Native PTY exited before sentinel: code ${event.exitCode}.`]);
    });

    pty.write(buildBenchmarkCommand(bytesRequested));
  });
}
