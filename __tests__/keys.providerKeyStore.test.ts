import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/bridge', () => ({
  getSecret: vi.fn(),
  setSecret: vi.fn(),
}));

describe('providerKeyStore legacy migration', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.resetModules();
  });

  it('migrates legacy per-provider keys when the bundled store is an empty object', async () => {
    window.localStorage.setItem('projectManager-key:llm-provider-keys', '{}');
    window.localStorage.setItem('projectManager-key:openai', 'sk-openai-legacy');

    const { getProviderKey, __resetProviderKeyStoreForTests } = await import(
      '../lib/keys/providerKeyStore'
    );
    __resetProviderKeyStoreForTests();

    await expect(getProviderKey('openai')).resolves.toBe('sk-openai-legacy');
  });

  it('treats whitespace-only stored keys as absent for revalidation', async () => {
    window.localStorage.setItem(
      'projectManager-key:llm-provider-keys',
      JSON.stringify({ openai: '   ' }),
    );

    const { getProviderKey, __resetProviderKeyStoreForTests } = await import(
      '../lib/keys/providerKeyStore'
    );
    __resetProviderKeyStoreForTests();

    await expect(getProviderKey('openai')).resolves.toBe('');
  });
});
