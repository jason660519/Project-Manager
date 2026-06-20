import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const loadedAddons: unknown[] = [];
const terminalWrites: unknown[] = [];
const terminalLines: string[] = [];
const ptyDataListeners: Array<(data: Uint8Array) => void> = [];
const ptyExitListeners: Array<(event: { exitCode: number; signal?: number }) => void> = [];
const spawnMock = vi.hoisted(() => vi.fn());

vi.mock('../lib/runtime/tauri-ready', () => ({
  isTauriRuntime: () => true,
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class FitAddon {
    fit() {}
  },
}));

vi.mock('@xterm/addon-webgl', () => ({
  WebglAddon: class WebglAddon {
    readonly kind = 'webgl';
  },
}));

vi.mock('@xterm/xterm', () => ({
  Terminal: class Terminal {
    cols = 80;
    rows = 24;

    loadAddon(addon: unknown) {
      loadedAddons.push(addon);
    }

    onData() {
      return { dispose: vi.fn() };
    }

    open() {}
    focus() {}
    dispose() {}
    writeln(line: string) {
      terminalLines.push(line);
    }

    write(data: unknown) {
      terminalWrites.push(data);
    }
  },
}));

vi.mock('tauri-pty', () => ({
  spawn: spawnMock,
}));

describe('TerminalRegistry performance behavior', () => {
  beforeEach(() => {
    loadedAddons.length = 0;
    terminalWrites.length = 0;
    terminalLines.length = 0;
    ptyDataListeners.length = 0;
    ptyExitListeners.length = 0;
    spawnMock.mockReset();
    spawnMock.mockImplementation(async () => ({
      write: vi.fn(),
      resize: vi.fn(),
      kill: vi.fn(),
      onData: (listener: (data: Uint8Array) => void) => {
        ptyDataListeners.push(listener);
        return { dispose: vi.fn() };
      },
      onExit: (listener: (event: { exitCode: number; signal?: number }) => void) => {
        ptyExitListeners.push(listener);
        return { dispose: vi.fn() };
      },
    }));
    vi.useFakeTimers();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      return window.setTimeout(() => callback(performance.now()), 16);
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      window.clearTimeout(id);
    });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 640,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get: () => 360,
    });
  });

  afterEach(async () => {
    const registry = await import('../components/terminal/TerminalRegistry');
    registry.destroy('terminal-perf');
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('loads the WebGL addon promised by ADR-013', async () => {
    const registry = await import('../components/terminal/TerminalRegistry');
    const slot = document.createElement('div');
    document.body.appendChild(slot);

    registry.attach('terminal-perf', slot, '/tmp/project-manager');

    expect(loadedAddons.some((addon) => (addon as { kind?: string }).kind === 'webgl')).toBe(true);
  });

  it('batches PTY output into a single terminal write per animation frame', async () => {
    const registry = await import('../components/terminal/TerminalRegistry');
    const slot = document.createElement('div');
    document.body.appendChild(slot);

    registry.attach('terminal-perf', slot, '/tmp/project-manager');
    await vi.advanceTimersByTimeAsync(64);

    expect(ptyDataListeners).toHaveLength(1);

    ptyDataListeners[0](new TextEncoder().encode('a'));
    ptyDataListeners[0](new TextEncoder().encode('b'));

    expect(terminalWrites).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(16);

    expect(terminalWrites).toHaveLength(1);
    expect(new TextDecoder().decode(terminalWrites[0] as Uint8Array)).toBe('ab');
  });

  it('surfaces unexpected PTY exit and respawns with bounded backoff', async () => {
    const registry = await import('../components/terminal/TerminalRegistry');
    const slot = document.createElement('div');
    document.body.appendChild(slot);

    registry.attach('terminal-perf', slot, '/tmp/project-manager');
    await vi.advanceTimersByTimeAsync(64);

    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(ptyExitListeners).toHaveLength(1);

    ptyExitListeners[0]({ exitCode: 7 });

    expect(terminalLines.some((line) => line.includes('Shell exited with code 7'))).toBe(true);

    await vi.advanceTimersByTimeAsync(499);
    expect(spawnMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(33);
    expect(spawnMock).toHaveBeenCalledTimes(2);
  });

  it('does not auto-respawn after a clean PTY exit', async () => {
    const registry = await import('../components/terminal/TerminalRegistry');
    const slot = document.createElement('div');
    document.body.appendChild(slot);

    registry.attach('terminal-perf', slot, '/tmp/project-manager');
    await vi.advanceTimersByTimeAsync(64);

    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(ptyExitListeners).toHaveLength(1);

    ptyExitListeners[0]({ exitCode: 0 });

    expect(terminalLines.some((line) => line.includes('Shell exited with code 0'))).toBe(true);

    await vi.advanceTimersByTimeAsync(2000);
    expect(spawnMock).toHaveBeenCalledTimes(1);
  });
});
