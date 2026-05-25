import { afterEach, describe, expect, it, vi } from 'vitest';
import { isTauriRuntime, waitForTauriRuntime } from '../lib/runtime/tauri-ready';

describe('tauri-ready', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
  });

  it('isTauriRuntime is false before internals are injected', () => {
    expect(isTauriRuntime()).toBe(false);
  });

  it('waitForTauriRuntime resolves when internals appear', async () => {
    const promise = waitForTauriRuntime(500);
    setTimeout(() => {
      Object.defineProperty(window, '__TAURI_INTERNALS__', {
        value: {},
        configurable: true,
      });
    }, 30);
    await expect(promise).resolves.toBe(true);
    expect(isTauriRuntime()).toBe(true);
  });
});
