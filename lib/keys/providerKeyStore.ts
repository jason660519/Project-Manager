/**
 * In-memory + bundled-Keychain provider-key store.
 *
 * macOS Keychain prompts the user per-item per-app the first time an
 * unsigned (or differently-signed) binary tries to read a credential. An
 * `tauri:dev` build re-signs ad-hoc on every rebuild, which invalidates
 * the user's "Always Allow" ACL — so a 11-provider list would prompt up
 * to 11 times every launch.
 *
 * This store consolidates all LLM provider keys behind:
 *
 *   1. A **single Keychain item** (key = `llm-provider-keys`) whose value
 *      is a JSON object mapping provider id → API key. One item ⇒ one
 *      potential prompt for the entire batch.
 *   2. A **module-level cache** populated on the first read of the session.
 *      Every subsequent `getProviderKey` / `setProviderKey` operates on
 *      the cache; only `setProviderKey` writes back to Keychain.
 *   3. A **one-shot migration**: if the bundle item doesn't exist yet
 *      (existing users from before this change), read each per-provider
 *      legacy item, build the bundle, and write it. Next launch is silent.
 *
 * Outside Tauri (browser dev), the same shape lives in localStorage —
 * still a single key `projectManager-key:llm-provider-keys` plus the
 * legacy `projectManager-key:<provider>` migration path.
 */

import { getSecret, setSecret } from '../bridge';
import { getLlmProviderIds, type LlmProviderId } from './llmProviders';

const KEYCHAIN_SERVICE = 'projectmanager';
const BUNDLE_KEY = 'llm-provider-keys';
const LS_BUNDLE_KEY = 'projectManager-key:llm-provider-keys';
const LS_LEGACY_PREFIX = 'projectManager-key:';

type ProviderKeyMap = Partial<Record<LlmProviderId, string>>;

let cache: ProviderKeyMap | null = null;
let loadPromise: Promise<ProviderKeyMap> | null = null;

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function parseBundle(raw: string | null): ProviderKeyMap | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? (obj as ProviderKeyMap) : null;
  } catch {
    return null;
  }
}

async function readLegacyTauri(): Promise<ProviderKeyMap> {
  const ids = getLlmProviderIds();
  const out: ProviderKeyMap = {};
  for (const id of ids) {
    // Per-provider legacy items used `<id>-api-key`; we read them all once
    // and then never touch them again.
    try {
      const v = await getSecret(KEYCHAIN_SERVICE, `${id}-api-key`);
      if (v != null && v.length > 0) out[id] = v;
    } catch {
      /* ignore individual misses */
    }
  }
  return out;
}

function readLegacyLocalStorage(): ProviderKeyMap {
  if (typeof window === 'undefined') return {};
  const out: ProviderKeyMap = {};
  for (const id of getLlmProviderIds()) {
    try {
      const v = window.localStorage.getItem(`${LS_LEGACY_PREFIX}${id}`);
      if (v && v.length > 0) out[id] = v;
    } catch {
      /* ignore */
    }
  }
  return out;
}

async function writeBundle(map: ProviderKeyMap): Promise<void> {
  const raw = JSON.stringify(map);
  if (isTauriRuntime()) {
    await setSecret(KEYCHAIN_SERVICE, BUNDLE_KEY, raw);
    return;
  }
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LS_BUNDLE_KEY, raw);
  } catch {
    /* ignore quota / private-mode */
  }
}

async function loadOnce(): Promise<ProviderKeyMap> {
  if (cache) return cache;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    let map: ProviderKeyMap | null = null;
    let migrated = false;

    if (isTauriRuntime()) {
      try {
        const raw = await getSecret(KEYCHAIN_SERVICE, BUNDLE_KEY);
        map = parseBundle(raw);
      } catch {
        map = null;
      }
      if (!map) {
        map = await readLegacyTauri();
        migrated = true;
      }
    } else if (typeof window !== 'undefined') {
      try {
        map = parseBundle(window.localStorage.getItem(LS_BUNDLE_KEY));
      } catch {
        map = null;
      }
      if (!map) {
        map = readLegacyLocalStorage();
        migrated = true;
      }
    } else {
      map = {};
    }

    cache = { ...map };
    if (migrated) {
      // Best-effort: write the migrated bundle so the next launch reads
      // a single item with a stable ACL. Surfacing errors here doesn't
      // help the caller — fall back to per-launch migration if it fails.
      try {
        await writeBundle(cache);
      } catch {
        /* ignore */
      }
    }
    return cache;
  })();
  return loadPromise;
}

/**
 * Read the API key for one provider. Triggers a one-time bundled read on
 * first call per session; subsequent calls are pure cache hits and never
 * prompt the user.
 */
export async function getProviderKey(provider: LlmProviderId): Promise<string> {
  const map = await loadOnce();
  return (map[provider] ?? '').trim() === '' ? map[provider] ?? '' : map[provider]!;
}

/** Returns true when a non-empty key is stored for this provider. */
export async function hasProviderKeyInStore(provider: LlmProviderId): Promise<boolean> {
  return (await getProviderKey(provider)).trim().length > 0;
}

/**
 * Persist a provider's key. Updates the in-memory cache *and* writes the
 * bundled Keychain item. Empty value keeps the field in the bundle (with
 * value `""`) so subsequent `hasProviderKey` returns false without losing
 * neighbouring keys.
 */
export async function setProviderKey(
  provider: LlmProviderId,
  value: string,
): Promise<void> {
  const map = await loadOnce();
  map[provider] = value;
  cache = map;
  await writeBundle(map);
}

/** Returns a snapshot of every cached provider key — used by Settings batch preflight. */
export async function getAllProviderKeys(): Promise<ProviderKeyMap> {
  return { ...(await loadOnce()) };
}

/** Test seam — drops the cache so vitest can simulate cold starts. */
export function __resetProviderKeyStoreForTests(): void {
  cache = null;
  loadPromise = null;
}
