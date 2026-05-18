/**
 * Tests for the consolidated provider-key store.
 *
 * Why this exists: macOS Keychain access is prompted per-item per-app. With
 * 11 LLM providers stored as 11 separate Keychain items, an unsigned dev
 * build asks the user for permission up to 11 times every launch. The
 * store consolidates all provider keys into a single Keychain item plus an
 * in-memory cache for the rest of the session:
 *
 *   - First read in the session → 1 Keychain prompt (worst case), populates
 *     the entire cache, every subsequent read is cache-only.
 *   - Save updates the cache AND writes the bundle (also 1 prompt worst case
 *     on a fresh "Always Allow"; silent thereafter).
 *   - Migration: when the bundled item doesn't exist yet (existing users),
 *     fall back to reading each per-provider item once and bundle them.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ALL_LLM_PROVIDERS } from '../lib/keys/providerOrder';

// Mocks for the bridge — track every call so we can assert prompt frequency.
const getSecretMock = vi.fn();
const setSecretMock = vi.fn();

vi.mock('../lib/bridge', () => ({
  getSecret: (service: string, key: string) => getSecretMock(service, key),
  setSecret: (service: string, key: string, value: string) =>
    setSecretMock(service, key, value),
}));

// Import lazily so the mocks are wired before module init.
async function loadStore() {
  const mod = await import('../lib/keys/providerKeyStore');
  mod.__resetProviderKeyStoreForTests();
  return mod;
}

const TAURI_INTERNALS = Symbol('tauri');

beforeEach(() => {
  getSecretMock.mockReset();
  setSecretMock.mockReset();
  // Pretend we're in Tauri so the store hits the Keychain path.
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = TAURI_INTERNALS;
});

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
});

describe('providerKeyStore — first-load consolidation', () => {
  it('hits the bundled Keychain item once and caches every provider', async () => {
    const bundle = JSON.stringify({
      anthropic: 'sk-ant-aaa',
      openai: 'sk-bbb',
    });
    getSecretMock.mockResolvedValue(bundle);

    const { getProviderKey } = await loadStore();
    const a = await getProviderKey('anthropic');
    const b = await getProviderKey('openai');
    const c = await getProviderKey('gemini');

    expect(a).toBe('sk-ant-aaa');
    expect(b).toBe('sk-bbb');
    expect(c).toBe(''); // missing in the bundle ⇒ empty string

    // Crucially: only ONE getSecret invocation for the bundle, regardless of
    // how many providers we asked for. That's the whole point.
    expect(getSecretMock).toHaveBeenCalledTimes(1);
    expect(getSecretMock).toHaveBeenCalledWith('projectmanager', 'llm-provider-keys');
  });

  it('returns the cached value on subsequent reads without hitting the bridge', async () => {
    getSecretMock.mockResolvedValueOnce(JSON.stringify({ anthropic: 'sk-ant-x' }));
    const { getProviderKey } = await loadStore();
    await getProviderKey('anthropic');
    await getProviderKey('anthropic');
    await getProviderKey('anthropic');
    expect(getSecretMock).toHaveBeenCalledTimes(1);
  });

  it('migrates from per-provider items when the bundle is missing', async () => {
    // First call (bundle key) returns null → migration kicks in and reads
    // each per-provider Keychain item once.
    getSecretMock.mockImplementation((service: string, key: string) => {
      if (key === 'llm-provider-keys') return Promise.resolve(null);
      if (key === 'anthropic-api-key') return Promise.resolve('sk-ant-legacy');
      if (key === 'openai-api-key') return Promise.resolve('sk-openai-legacy');
      return Promise.resolve(null);
    });

    const { getProviderKey } = await loadStore();
    expect(await getProviderKey('anthropic')).toBe('sk-ant-legacy');
    expect(await getProviderKey('openai')).toBe('sk-openai-legacy');
    expect(await getProviderKey('deepseek')).toBe(''); // legacy didn't know about deepseek

    // 1 bundle attempt + 11 per-provider migration reads
    expect(getSecretMock).toHaveBeenCalledTimes(1 + ALL_LLM_PROVIDERS.length);

    // …and the migrated bundle was written back so the next launch is silent.
    expect(setSecretMock).toHaveBeenCalledTimes(1);
    const [svc, key, raw] = setSecretMock.mock.calls[0];
    expect(svc).toBe('projectmanager');
    expect(key).toBe('llm-provider-keys');
    const parsed = JSON.parse(raw);
    expect(parsed.anthropic).toBe('sk-ant-legacy');
    expect(parsed.openai).toBe('sk-openai-legacy');
  });
});

describe('providerKeyStore — save path', () => {
  it('updates the cache AND writes the bundle (one setSecret call per save)', async () => {
    getSecretMock.mockResolvedValue(JSON.stringify({ openai: 'sk-old' }));
    const { getProviderKey, setProviderKey } = await loadStore();
    // Warm the cache first so the save doesn't trigger a read.
    await getProviderKey('openai');

    await setProviderKey('openai', 'sk-new');
    expect(setSecretMock).toHaveBeenCalledTimes(1);
    const [, , raw] = setSecretMock.mock.calls[0];
    expect(JSON.parse(raw).openai).toBe('sk-new');

    // Read after save returns the new value without re-hitting the bridge.
    expect(await getProviderKey('openai')).toBe('sk-new');
    expect(getSecretMock).toHaveBeenCalledTimes(1); // still just the warm-up
  });

  it('treats empty values as "cleared" — bundle keeps the entry but the field is empty', async () => {
    getSecretMock.mockResolvedValue(JSON.stringify({ openai: 'sk-old' }));
    const { getProviderKey, setProviderKey } = await loadStore();
    await getProviderKey('openai');
    await setProviderKey('openai', '');
    expect(await getProviderKey('openai')).toBe('');
    const [, , raw] = setSecretMock.mock.calls[setSecretMock.mock.calls.length - 1];
    expect(JSON.parse(raw).openai).toBe('');
  });
});

describe('providerKeyStore — browser dev fallback', () => {
  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
    window.localStorage.clear();
  });

  it('uses localStorage when not in Tauri', async () => {
    window.localStorage.setItem(
      'projectManager-key:llm-provider-keys',
      JSON.stringify({ anthropic: 'sk-ant-local', kimi: 'sk-kimi-local' }),
    );
    const { getProviderKey } = await loadStore();
    expect(await getProviderKey('anthropic')).toBe('sk-ant-local');
    expect(await getProviderKey('kimi')).toBe('sk-kimi-local');
    expect(getSecretMock).not.toHaveBeenCalled();
  });

  it('migrates legacy per-provider localStorage entries into the bundle', async () => {
    window.localStorage.setItem('projectManager-key:anthropic', 'sk-ant-legacy-ls');
    window.localStorage.setItem('projectManager-key:openai', 'sk-openai-legacy-ls');
    const { getProviderKey } = await loadStore();
    expect(await getProviderKey('anthropic')).toBe('sk-ant-legacy-ls');
    expect(await getProviderKey('openai')).toBe('sk-openai-legacy-ls');
    const bundled = JSON.parse(
      window.localStorage.getItem('projectManager-key:llm-provider-keys') ?? '{}',
    );
    expect(bundled.anthropic).toBe('sk-ant-legacy-ls');
    expect(bundled.openai).toBe('sk-openai-legacy-ls');
  });
});
