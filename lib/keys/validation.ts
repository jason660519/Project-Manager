/**
 * Client-side orchestration for "validate then save" and "re-validate" flows.
 *
 * The Rust commands (`validate_provider_key`, `revalidate_provider_key`) only
 * do the network round-trip and return `{ ok, models, errorReason }`. This
 * module wires them to:
 *   1. The per-provider `apiKind` + `baseUrl` lookup (from llmProviders.ts).
 *   2. Keychain save (only on `ok === true`).
 *   3. Metadata persistence in localStorage.
 *
 * Keep this file thin — orchestration only, no UI concerns.
 */

import {
  validateProviderKey as bridgeValidate,
  type ProviderApiKind,
  type ValidateProviderKeyResult,
} from '../bridge';
import { listLlmProviders } from './llmProviders';
import { getProviderKey } from './providerKeyStore';
import { loadProviderSecret, saveProviderSecret } from './keychain';
import {
  clearProviderMetadata,
  saveProviderMetadata,
} from './providerMetadata';
import type { ProviderSpec } from './registry';

export interface ProviderApiContract {
  apiKind: ProviderApiKind;
  baseUrl?: string;
}

/**
 * Resolve which Rust validation path a provider should use. Returns `null`
 * for providers we don't know how to validate (future extension point).
 */
export function getProviderApiContract(
  provider: ProviderSpec,
): ProviderApiContract | null {
  // GitHub is the only integration provider today; validate via /user.
  if (provider.category === 'integration' && provider.id === 'github') {
    return { apiKind: 'github' };
  }
  if (provider.category !== 'ai') return null;

  const llm = listLlmProviders().find((p) => p.id === provider.id);
  if (!llm) return null;

  if (llm.apiKind === 'openai-compatible') {
    if (!llm.baseUrl) return null;
    return { apiKind: 'openai-compatible', baseUrl: llm.baseUrl };
  }
  return { apiKind: llm.apiKind };
}

/**
 * "Save & Validate" flow used when the user has just typed a key:
 *   1. Validate first (Rust pings the provider's list-models endpoint).
 *   2. On `ok=true` → persist key to keychain + write metadata.
 *   3. On `ok=false` → write *failure* metadata only; key is NOT stored.
 *
 * Returns the validation result so the caller can render success / error.
 */
export async function saveAndValidateKey(
  provider: ProviderSpec,
  apiKey: string,
): Promise<ValidateProviderKeyResult> {
  const contract = getProviderApiContract(provider);
  if (!contract) {
    throw new Error(`No validation contract for provider: ${provider.id}`);
  }

  const result = await bridgeValidate({
    apiKind: contract.apiKind,
    baseUrl: contract.baseUrl,
    apiKey,
  });

  const now = new Date().toISOString();

  if (result.ok) {
    // Persist secret first; if that fails we still want metadata to reflect
    // the validation outcome rather than silently rolling back.
    await saveProviderSecret(provider, apiKey);
    saveProviderMetadata(provider.id, {
      lastValidatedAt: now,
      status: 'ok',
      dynamicModels: result.models,
    });
  } else {
    saveProviderMetadata(provider.id, {
      lastValidatedAt: now,
      status: 'fail',
      errorReason: result.errorReason ?? 'Unknown error',
    });
  }

  return result;
}

/**
 * "Re-validate" flow for already-stored keys. The key never leaves the Rust
 * side — `revalidate_provider_key` reads from keychain itself.
 *
 * Updates metadata identically to `saveAndValidateKey` but does not touch
 * the keychain (the key was already there).
 */
export async function revalidateStoredKey(
  provider: ProviderSpec,
): Promise<ValidateProviderKeyResult> {
  const contract = getProviderApiContract(provider);
  if (!contract) {
    throw new Error(`No validation contract for provider: ${provider.id}`);
  }

  const apiKey =
    provider.category === 'ai'
      ? await getProviderKey(provider.id as Parameters<typeof getProviderKey>[0])
      : await loadProviderSecret(provider);

  const result = apiKey
    ? await bridgeValidate({
        apiKind: contract.apiKind,
        baseUrl: contract.baseUrl,
        apiKey,
      })
    : {
        ok: false,
        models: [],
        errorReason: 'No key configured',
      };

  const now = new Date().toISOString();
  if (result.ok) {
    saveProviderMetadata(provider.id, {
      lastValidatedAt: now,
      status: 'ok',
      dynamicModels: result.models,
    });
  } else {
    saveProviderMetadata(provider.id, {
      lastValidatedAt: now,
      status: 'fail',
      errorReason: result.errorReason ?? 'Unknown error',
    });
  }

  return result;
}

/**
 * Clear both the secret (from keychain) and the metadata. Called by the
 * detail sheet's "Clear" button. Treat keychain clear failures as fatal;
 * metadata clear is best-effort.
 */
export async function clearProviderKey(provider: ProviderSpec): Promise<void> {
  await saveProviderSecret(provider, '');
  clearProviderMetadata(provider.id);
}
