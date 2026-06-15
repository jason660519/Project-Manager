/**
 * Unified Keys persistence store — the v2 envelope (F50 Phase 1).
 *
 * Before v2 the Keys sheets persisted into three unrelated localStorage
 * islands (`projectManager:keys-state:v1`, `pm.arena.llm.results`,
 * `projectManager:keys-vlm-image-to-image:v1`) with three different
 * versioning schemes; any schema change was a breaking change with no
 * migration path. This module owns the single versioned envelope and the
 * one-shot legacy migration.
 *
 * Responsibility split: the store handles the envelope (load / migrate /
 * commit / subscribe / corruption recovery). Slice *content* stays untyped
 * here — each consumer keeps its own sanitizer, exactly as it did against
 * its legacy island, so a corrupt slice degrades per-sheet instead of
 * killing the whole envelope.
 *
 * `pm:keys-metadata` and `projectManager-llm-provider-order` are NOT slices:
 * they are shared with Settings and the Scanner and remain standalone
 * modules (providerMetadata stays the single source of truth for model
 * availability).
 */

export const KEYS_STORE_STORAGE_KEY = 'projectManager:keys:v2';
const CORRUPT_BACKUP_KEY = `${KEYS_STORE_STORAGE_KEY}.corrupt.bak`;

export type KeysSliceName =
  | 'sheets'
  | 'llmArenaResults'
  | 'llmArenaHistory'
  | 'vlmImageToImage'
  | 'vlmCuratedModels';

/**
 * Legacy island per slice. `llmArenaHistory` and `vlmCuratedModels` are new
 * in v2 — never persisted before.
 */
export const LEGACY_KEY_BY_SLICE: Partial<Record<KeysSliceName, string>> = {
  sheets: 'projectManager:keys-state:v1',
  llmArenaResults: 'pm.arena.llm.results',
  vlmImageToImage: 'projectManager:keys-vlm-image-to-image:v1',
};

export interface KeysStoreRecovery {
  at: string;
  reason: string;
}

interface KeysStoreMeta {
  migratedAt: string | null;
  recoveries: KeysStoreRecovery[];
}

interface KeysStoreEnvelope {
  version: 2;
  slices: Partial<Record<KeysSliceName, unknown>>;
  meta: KeysStoreMeta;
}

type KeysSliceListener = (value: unknown) => void;

let envelope: KeysStoreEnvelope | null = null;
let lastCommitError: string | null = null;
const sliceListeners = new Map<KeysSliceName, Set<KeysSliceListener>>();

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function emptyEnvelope(): KeysStoreEnvelope {
  return { version: 2, slices: {}, meta: { migratedAt: null, recoveries: [] } };
}

function sanitizeMeta(value: unknown): KeysStoreMeta {
  if (!isRecord(value)) return { migratedAt: null, recoveries: [] };
  const recoveries = Array.isArray(value.recoveries)
    ? value.recoveries.filter(
        (entry): entry is KeysStoreRecovery =>
          isRecord(entry) && typeof entry.at === 'string' && typeof entry.reason === 'string',
      )
    : [];
  return {
    migratedAt: typeof value.migratedAt === 'string' ? value.migratedAt : null,
    recoveries,
  };
}

function recordRecovery(target: KeysStoreEnvelope, reason: string): void {
  target.meta.recoveries.push({ at: new Date().toISOString(), reason });
}

/** Corrupt payloads are backed up, never silently discarded. */
function backupCorruptEnvelope(raw: string): void {
  try {
    window.localStorage.setItem(CORRUPT_BACKUP_KEY, raw);
  } catch {
    // Backup is best-effort; recovery proceeds either way.
  }
}

function migrateLegacyIslands(target: KeysStoreEnvelope): void {
  for (const [slice, legacyKey] of Object.entries(LEGACY_KEY_BY_SLICE) as Array<
    [KeysSliceName, string]
  >) {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(legacyKey);
    } catch {
      continue;
    }
    if (raw === null) continue;
    try {
      window.localStorage.setItem(`${legacyKey}.bak`, raw);
    } catch {
      // Rollback copy is best-effort.
    }
    try {
      target.slices[slice] = JSON.parse(raw);
    } catch {
      recordRecovery(target, `legacy island ${legacyKey} failed to parse; backed up and dropped`);
    }
    try {
      window.localStorage.removeItem(legacyKey);
    } catch {
      // A surviving legacy key is harmless: nothing reads it after migration.
    }
  }
  target.meta.migratedAt = new Date().toISOString();
}

function persistEnvelope(target: KeysStoreEnvelope): void {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.setItem(KEYS_STORE_STORAGE_KEY, JSON.stringify(target));
    lastCommitError = null;
  } catch (error) {
    // Quota / private mode: keep the in-memory store authoritative for this
    // session and surface the failure instead of swallowing it.
    lastCommitError = error instanceof Error ? error.message : String(error);
    recordRecovery(target, `commit failed: ${lastCommitError}`);
    console.warn('[keys-store] persist failed; in-memory state kept', lastCommitError);
  }
}

function loadEnvelope(): KeysStoreEnvelope {
  if (envelope) return envelope;
  if (!canUseLocalStorage()) {
    envelope = emptyEnvelope();
    return envelope;
  }

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEYS_STORE_STORAGE_KEY);
  } catch {
    envelope = emptyEnvelope();
    return envelope;
  }

  let corruptReason: string | null = null;
  if (raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isRecord(parsed) && parsed.version === 2 && isRecord(parsed.slices)) {
        envelope = {
          version: 2,
          slices: parsed.slices as Partial<Record<KeysSliceName, unknown>>,
          meta: sanitizeMeta(parsed.meta),
        };
        return envelope;
      }
      corruptReason = 'v2 envelope had an unexpected shape';
    } catch {
      corruptReason = 'v2 envelope failed to parse';
    }
    backupCorruptEnvelope(raw);
  }

  const fresh = emptyEnvelope();
  if (corruptReason) {
    recordRecovery(fresh, `${corruptReason}; backed up to ${CORRUPT_BACKUP_KEY}`);
    console.warn(`[keys-store] ${corruptReason}; backed up to ${CORRUPT_BACKUP_KEY} and rebuilt`);
  }
  // First load (or recovery from a corrupt envelope while legacy keys still
  // exist): pull the legacy islands in.
  migrateLegacyIslands(fresh);
  envelope = fresh;
  persistEnvelope(envelope);
  return envelope;
}

/** Raw (already-parsed) slice value, or null when absent. Caller sanitizes. */
export function readKeysSlice(name: KeysSliceName): unknown {
  const slice = loadEnvelope().slices[name];
  return slice === undefined ? null : slice;
}

export function commitKeysSlice(name: KeysSliceName, value: unknown): void {
  const target = loadEnvelope();
  target.slices[name] = value;
  persistEnvelope(target);
  const listeners = sliceListeners.get(name);
  if (listeners) {
    for (const listener of listeners) listener(value);
  }
}

export function subscribeKeysSlice(name: KeysSliceName, listener: KeysSliceListener): () => void {
  let listeners = sliceListeners.get(name);
  if (!listeners) {
    listeners = new Set();
    sliceListeners.set(name, listeners);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getKeysStoreMeta(): KeysStoreMeta {
  const { meta } = loadEnvelope();
  return { migratedAt: meta.migratedAt, recoveries: [...meta.recoveries] };
}

export function getLastKeysCommitError(): string | null {
  return lastCommitError;
}

/**
 * Drop the in-module memo (and optionally all persisted keys) so each test
 * starts from a cold load — module state would otherwise leak across tests.
 */
export function resetKeysStoreForTests(options?: { clearStorage?: boolean }): void {
  envelope = null;
  lastCommitError = null;
  sliceListeners.clear();
  if (options?.clearStorage === false || !canUseLocalStorage()) return;
  try {
    window.localStorage.removeItem(KEYS_STORE_STORAGE_KEY);
    window.localStorage.removeItem(CORRUPT_BACKUP_KEY);
    for (const legacyKey of Object.values(LEGACY_KEY_BY_SLICE)) {
      window.localStorage.removeItem(legacyKey);
      window.localStorage.removeItem(`${legacyKey}.bak`);
    }
  } catch {
    // Mocked/read-only storage in tests must not break the reset.
  }
}
