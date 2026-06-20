import { beforeEach, describe, expect, it, vi } from 'vitest';

const spawnMock = vi.hoisted(() => vi.fn());
const ptyDataListeners: Array<(data: Uint8Array | number[] | { data: number[] }) => void> = [];
const killMock = vi.hoisted(() => vi.fn());
const writeMock = vi.hoisted(() => vi.fn());

vi.mock('../lib/runtime/tauri-ready', () => ({
  isTauriRuntime: () => true,
}));

vi.mock('tauri-pty', () => ({
  spawn: spawnMock,
}));

describe('xmux native PTY benchmark', () => {
  beforeEach(() => {
    spawnMock.mockReset();
    killMock.mockReset();
    writeMock.mockReset();
    ptyDataListeners.length = 0;
    spawnMock.mockImplementation(() => ({
      write: writeMock,
      resize: vi.fn(),
      kill: killMock,
      onData: (listener: (data: Uint8Array | number[] | { data: number[] }) => void) => {
        ptyDataListeners.push(listener);
        return { dispose: vi.fn() };
      },
      onExit: () => ({ dispose: vi.fn() }),
    }));
  });

  it('measures bytes read until the sentinel appears', async () => {
    const { runNativePtyBenchmark } = await import('../lib/xmux/nativePtyBenchmark');
    const pending = runNativePtyBenchmark({
      cwd: '/tmp/project-manager',
      bytes: 8,
      timeoutMs: 1000,
    });

    await vi.waitFor(() => expect(ptyDataListeners).toHaveLength(1));
    ptyDataListeners[0](new TextEncoder().encode('payload\n__XMUX_PTY_BENCH_DONE__\n'));

    const result = await pending;

    expect(result.nativePtyAvailable).toBe(true);
    expect(result.bytesRequested).toBe(8);
    expect(result.bytesRead).toBeGreaterThan(0);
    expect(result.sentinelSeen).toBe(true);
    expect(result.throughputBytesPerSecond).toBeGreaterThan(0);
    expect(writeMock).toHaveBeenCalledWith(expect.stringMatching(/^stty -echo\n/));
    expect(writeMock).toHaveBeenCalledWith(expect.stringContaining('__XMUX_PTY_BENCH_DONE__'));
    expect(killMock).toHaveBeenCalled();
  });

  it('kills the PTY and reports unavailable when output times out', async () => {
    vi.useFakeTimers();
    try {
      const { runNativePtyBenchmark } = await import('../lib/xmux/nativePtyBenchmark');
      const pending = runNativePtyBenchmark({
        cwd: '/tmp/project-manager',
        bytes: 64,
        timeoutMs: 25,
      });

      await vi.waitFor(() => expect(ptyDataListeners).toHaveLength(1));
      await vi.advanceTimersByTimeAsync(30);

      const result = await pending;

      expect(result.nativePtyAvailable).toBe(false);
      expect(result.sentinelSeen).toBe(false);
      expect(result.notes.join('\n')).toContain('timed out');
      expect(killMock).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('normalizes array-like PTY chunks returned by the Tauri plugin', async () => {
    const { runNativePtyBenchmark } = await import('../lib/xmux/nativePtyBenchmark');
    const pending = runNativePtyBenchmark({
      cwd: '/tmp/project-manager',
      bytes: 8,
      timeoutMs: 1000,
    });

    await vi.waitFor(() => expect(ptyDataListeners).toHaveLength(1));
    ptyDataListeners[0]({
      data: Array.from(new TextEncoder().encode('payload\n__XMUX_PTY_BENCH_DONE__\n')),
    });

    const result = await pending;

    expect(result.nativePtyAvailable).toBe(true);
    expect(result.bytesRead).toBeGreaterThan(0);
    expect(result.sentinelSeen).toBe(true);
    expect(Number.isFinite(result.throughputBytesPerSecond)).toBe(true);
  });
});
