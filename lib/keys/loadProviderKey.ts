/**
 * Multi-provider key loader. Delegates to the consolidated
 * `providerKeyStore` so all readers share a single in-memory cache and a
 * single bundled Keychain item (one prompt per session instead of one per
 * provider — see ADR-comment in `providerKeyStore.ts`).
 */

import { getProviderKey, hasProviderKeyInStore } from './providerKeyStore';
import type { LlmProviderId } from './llmProviders';

/**
 * Read a provider's API key. First call per session may prompt for
 * Keychain access (Tauri); every subsequent call is a cache hit.
 */
export async function loadProviderKey(provider: LlmProviderId): Promise<string> {
  return getProviderKey(provider);
}

/** Same as `loadProviderKey` but returns a boolean for use in preflight gates. */
export async function hasProviderKey(provider: LlmProviderId): Promise<boolean> {
  return hasProviderKeyInStore(provider);
}
