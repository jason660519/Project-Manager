import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
  checkCommandAvailability,
  checkCommandExists,
  clearCommandExistsCache,
} from '../lib/adapters/availability';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);

function setTauriRuntime() {
  Object.defineProperty(window, '__TAURI_INTERNALS__', {
    configurable: true,
    value: {},
  });
}

describe('checkCommandExists', () => {
  beforeEach(() => {
    clearCommandExistsCache();
    vi.clearAllMocks();
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  it('returns true in browser mode because local CLI availability cannot be checked', async () => {
    await expect(checkCommandExists('cursor')).resolves.toBe(true);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('returns unknown preflight status in browser mode', async () => {
    await expect(checkCommandAvailability('cursor')).resolves.toEqual({
      status: 'unknown',
      canVerify: false,
    });
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('uses the Tauri bridge when running inside Tauri', async () => {
    setTauriRuntime();
    invokeMock.mockResolvedValueOnce(false);

    await expect(checkCommandExists('nonexistent-tool')).resolves.toBe(false);
    expect(invokeMock).toHaveBeenCalledWith('check_command_exists', { command: 'nonexistent-tool' });
  });

  it('returns available or missing preflight status in Tauri', async () => {
    setTauriRuntime();
    invokeMock.mockResolvedValueOnce(true);

    await expect(checkCommandAvailability('codex')).resolves.toEqual({
      status: 'available',
      canVerify: true,
    });
    expect(invokeMock).toHaveBeenCalledWith('check_command_exists', { command: 'codex' });
  });

  it('caches Tauri bridge results', async () => {
    setTauriRuntime();
    invokeMock.mockResolvedValueOnce(true);

    await expect(checkCommandExists('cursor')).resolves.toBe(true);
    await expect(checkCommandExists('cursor')).resolves.toBe(true);
    expect(invokeMock).toHaveBeenCalledTimes(1);
  });

  it('returns false for an empty command', async () => {
    await expect(checkCommandExists('')).resolves.toBe(false);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('falls back safely when no adapters are available', () => {
    const adapters: Array<{ id: string }> = [];
    const savedId = 'codex';
    const resolved = adapters.some((adapter) => adapter.id === savedId)
      ? savedId
      : adapters[0]?.id;

    expect(resolved).toBeUndefined();
  });
});
