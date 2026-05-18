import { getSecret } from '../bridge';

export const KEYCHAIN_SERVICE = 'projectmanager';
export const KEYCHAIN_ANTHROPIC_KEY = 'anthropic-api-key';
export const LS_ANTHROPIC_KEY = 'projectManager-key:anthropic';

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Load the user's Anthropic API key — Keychain in Tauri, localStorage in dev.
 * Runtime detection lives here so callers stay runtime-agnostic.
 */
export async function loadAnthropicKey(): Promise<string> {
  if (isTauriRuntime()) {
    try {
      return (await getSecret(KEYCHAIN_SERVICE, KEYCHAIN_ANTHROPIC_KEY)) ?? '';
    } catch {
      return '';
    }
  }
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(LS_ANTHROPIC_KEY) ?? '';
  } catch {
    return '';
  }
}

/** Preflight helper used to gate Scan UI before any user-triggered scan fires. */
export async function hasAnthropicKey(): Promise<boolean> {
  return (await loadAnthropicKey()).trim().length > 0;
}
