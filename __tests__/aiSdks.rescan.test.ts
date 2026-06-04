import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/keys/providerKeyStore', () => ({
  hasProviderKeyInStore: vi.fn(),
}));

vi.mock('../lib/keys/validation', () => ({
  revalidateStoredKey: vi.fn(),
}));

import { rescanAiProviderModels } from '../lib/aiSdks/rescan';
import { hasProviderKeyInStore } from '../lib/keys/providerKeyStore';
import { revalidateStoredKey } from '../lib/keys/validation';

const mockHasKey = vi.mocked(hasProviderKeyInStore);
const mockRevalidate = vi.mocked(revalidateStoredKey);

afterEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe('rescanAiProviderModels', () => {
  it('skips providers with no key without calling revalidate', async () => {
    mockHasKey.mockResolvedValue(false);

    const summary = await rescanAiProviderModels(['anthropic']);

    expect(summary).toMatchObject({ scanned: 0, skipped: 1, newModels: 0, failed: [] });
    expect(mockRevalidate).not.toHaveBeenCalled();
  });

  it('counts only newly surfaced models for a scanned provider', async () => {
    mockHasKey.mockResolvedValue(true);
    mockRevalidate.mockResolvedValue({
      ok: true,
      models: ['claude-sonnet-4-6', 'claude-zzz-new'],
      errorReason: null,
    });

    const summary = await rescanAiProviderModels(['anthropic']);

    expect(summary).toMatchObject({ scanned: 1, skipped: 0, newModels: 1, failed: [] });
  });

  it('records a failure without throwing when revalidation fails', async () => {
    mockHasKey.mockResolvedValue(true);
    mockRevalidate.mockResolvedValue({ ok: false, models: [], errorReason: '401 invalid_api_key' });

    const summary = await rescanAiProviderModels(['anthropic']);

    expect(summary.scanned).toBe(0);
    expect(summary.failed).toEqual([{ id: 'anthropic', reason: '401 invalid_api_key' }]);
  });

  it('collects key store errors without throwing', async () => {
    mockHasKey.mockRejectedValue(new Error('keychain unavailable'));

    const summary = await rescanAiProviderModels(['anthropic']);

    expect(summary).toMatchObject({
      scanned: 0,
      skipped: 0,
      failed: [{ id: 'anthropic', reason: 'keychain unavailable' }],
    });
    expect(mockRevalidate).not.toHaveBeenCalled();
  });
});
