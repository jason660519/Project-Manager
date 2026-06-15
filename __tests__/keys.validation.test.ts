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

  it('validates a newly entered key before saving it to the bundled provider-key store', async () => {
    const { __resetProviderKeyStoreForTests } = await import('../lib/keys/providerKeyStore');
    const { loadProviderMetadata } = await import('../lib/keys/providerMetadata');
    const { saveAndValidateKey } = await import('../lib/keys/validation');
    __resetProviderKeyStoreForTests();
    const apiKey = `sk-${'a'.repeat(40)}`;
    validateProviderKeyMock.mockResolvedValue({
      ok: true,
      models: ['gpt-4o-mini'],
      errorReason: null,
    });

    const result = await saveAndValidateKey(provider('openai'), apiKey);

    expect(result.ok).toBe(true);
    expect(validateProviderKeyMock).toHaveBeenCalledWith({
      apiKind: 'openai-compatible',
      baseUrl: 'https://api.openai.com/v1',
      apiKey,
    });
    expect(JSON.parse(window.localStorage.getItem('projectManager-key:llm-provider-keys') ?? '{}')).toEqual(
      expect.objectContaining({ openai: apiKey }),
    );
    expect(loadProviderMetadata('openai')).toEqual(
      expect.objectContaining({
        status: 'ok',
        dynamicModels: ['gpt-4o-mini'],
      }),
    );
  });

  it('records failed validation metadata without saving the rejected key', async () => {
    const { __resetProviderKeyStoreForTests } = await import('../lib/keys/providerKeyStore');
    const { loadProviderMetadata } = await import('../lib/keys/providerMetadata');
    const { saveAndValidateKey } = await import('../lib/keys/validation');
    __resetProviderKeyStoreForTests();
    validateProviderKeyMock.mockResolvedValue({
      ok: false,
      models: [],
      errorReason: 'Provider rejected the key',
    });

    const result = await saveAndValidateKey(provider('openai'), `sk-${'b'.repeat(40)}`);

    expect(result.ok).toBe(false);
    expect(window.localStorage.getItem('projectManager-key:llm-provider-keys')).toBeNull();
    expect(loadProviderMetadata('openai')).toEqual(
      expect.objectContaining({
        status: 'fail',
        errorReason: 'Provider rejected the key',
      }),
    );
  });

  it('throws a clear error when a provider has no validation contract', async () => {
    const { saveAndValidateKey } = await import('../lib/keys/validation');

    await expect(saveAndValidateKey({
      id: 'custom-integration',
      label: 'Custom Integration',
      category: 'integration',
      placeholder: 'Paste API key',
      keychainKey: 'custom-integration-api-key',
      lsKey: 'projectManager-key:custom-integration',
      docUrl: 'https://example.com',
      apiKeyUrl: 'https://example.com',
      usageUrl: 'https://example.com',
      developerDocsUrl: 'https://example.com',
      envVarNames: ['CUSTOM_INTEGRATION_API_KEY'],
      supportedMethods: ['apiKey'],
    }, 'secret')).rejects.toThrow('No validation contract for provider: custom-integration');
    expect(validateProviderKeyMock).not.toHaveBeenCalled();
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

  it('does not call validation when the stored key is whitespace-only', async () => {
    const { setProviderKey, __resetProviderKeyStoreForTests } = await import(
      '../lib/keys/providerKeyStore'
    );
    const { revalidateStoredKey } = await import('../lib/keys/validation');
    __resetProviderKeyStoreForTests();
    await setProviderKey('openai', '   ');

    const result = await revalidateStoredKey(provider('openai'));

    expect(result.errorReason).toBe('No key configured');
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
