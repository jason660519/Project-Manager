/**
 * Runtime-agnostic secret save/load used by the Keys view and `.env` import.
 *
 * AI providers go through `providerKeyStore` (single bundled Keychain item
 * + memory cache → one prompt per session). Non-LLM integrations like the
 * GitHub PAT keep their own per-item entry — there's just the one, and it
 * has its own ACL flow including OAuth Device Flow.
 */

import { getSecret, setSecret } from '../bridge';
import { getLlmProvider, type LlmProviderId } from './llmProviders';
import { getProviderKey, setProviderKey } from './providerKeyStore';
import { enableProviderInOrder } from './providerOrder';
import { KEYCHAIN_SERVICE, type ProviderSpec } from './registry';

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function isLlmProvider(spec: ProviderSpec): boolean {
  return spec.category === 'ai' && getLlmProvider(spec.id as LlmProviderId) !== undefined;
}

export async function loadProviderSecret(provider: ProviderSpec): Promise<string> {
  if (isLlmProvider(provider)) {
    return getProviderKey(provider.id as LlmProviderId);
  }
  // Non-LLM (currently just GitHub) — direct Keychain / localStorage access.
  if (isTauri()) {
    const v = await getSecret(KEYCHAIN_SERVICE, provider.keychainKey);
    return v ?? '';
  }
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(provider.lsKey) ?? '';
  } catch {
    return '';
  }
}

export async function saveProviderSecret(
  provider: ProviderSpec,
  value: string,
): Promise<void> {
  if (isLlmProvider(provider)) {
    const id = provider.id as LlmProviderId;
    await setProviderKey(id, value);
    // Saving a non-empty key is the user's explicit opt-in for this
    // provider — flip the fallback-order entry to enabled so the row
    // doesn't appear struck-through in Settings. Don't downgrade on
    // empty value: the user might be clearing a key but keeping the
    // provider position in the chain.
    if (value.trim().length > 0) {
      await enableProviderInOrder(id);
    }
    return;
  }
  if (isTauri()) {
    await setSecret(KEYCHAIN_SERVICE, provider.keychainKey, value);
    return;
  }
  if (typeof window === 'undefined') return;
  try {
    if (value) window.localStorage.setItem(provider.lsKey, value);
    else window.localStorage.removeItem(provider.lsKey);
  } catch {
    /* ignore quota errors */
  }
}
