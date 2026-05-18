/**
 * Runtime-agnostic secret save/load. Centralises the Tauri-vs-dev branching
 * that used to be duplicated inside every KeysView row.
 */

import { getSecret, setSecret } from '../bridge';
import { KEYCHAIN_SERVICE, type ProviderSpec } from './registry';

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function loadProviderSecret(provider: ProviderSpec): Promise<string> {
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

export async function saveProviderSecret(provider: ProviderSpec, value: string): Promise<void> {
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
