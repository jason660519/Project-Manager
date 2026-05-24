import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PROVIDERS } from '../lib/keys/registry';

const validateProviderKeyMock = vi.fn();

vi.mock('../lib/bridge', () => ({
  validateProviderKey: (opts: unknown) => validateProviderKeyMock(opts),
}));

function provider(id: string) {
  const found = PROVIDERS.find((p) => p.id === id);
  if (!found) throw new Error(`Missing provider fixture: ${id}`);
  return found;
}

describe('keys validation orchestration', () => {
  beforeEach(() => {
    validateProviderKeyMock.mockReset();
    window.localStorage.clear();
  });

  it('revalidates LLM providers from the bundled provider-key store', async () => {
    const { setProviderKey, __resetProviderKeyStoreForTests } = await import(
      '../lib/keys/providerKeyStore'
    );
    const { revalidateStoredKey } = await import('../lib/keys/validation');
    __resetProviderKeyStoreForTests();
    await setProviderKey('anthropic', 'sk-ant-from-bundle');
    validateProviderKeyMock.mockResolvedValue({
      ok: true,
      models: ['claude-sonnet-4-6'],
      errorReason: null,
    });

    const result = await revalidateStoredKey(provider('anthropic'));

    expect(result.ok).toBe(true);
    expect(validateProviderKeyMock).toHaveBeenCalledWith({
      apiKind: 'anthropic',
      baseUrl: undefined,
      apiKey: 'sk-ant-from-bundle',
    });
  });

  it('returns a clear failed result when no stored key exists', async () => {
    const { __resetProviderKeyStoreForTests } = await import('../lib/keys/providerKeyStore');
    const { revalidateStoredKey } = await import('../lib/keys/validation');
    __resetProviderKeyStoreForTests();

    const result = await revalidateStoredKey(provider('openai'));

    expect(result).toEqual({
      ok: false,
      models: [],
      errorReason: 'No key configured',
    });
    expect(validateProviderKeyMock).not.toHaveBeenCalled();
  });

  it('uses the global Moonshot endpoint for Kimi keys', async () => {
    const { getProviderApiContract } = await import('../lib/keys/validation');

    expect(getProviderApiContract(provider('kimi'))).toEqual({
      apiKind: 'openai-compatible',
      baseUrl: 'https://api.moonshot.ai/v1',
    });
  });
});
