import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  KEYS_STORE_STORAGE_KEY,
  LEGACY_KEY_BY_SLICE,
  commitKeysSlice,
  getKeysStoreMeta,
  getLastKeysCommitError,
  readKeysSlice,
  resetKeysStoreForTests,
  subscribeKeysSlice,
} from '../lib/keys/store';

/**
 * F50 Phase 1 (tdd-spec Suite C): the v2 envelope and the one-shot migration
 * from the three legacy localStorage islands. Corruption never destroys data
 * silently — corrupt payloads are backed up and recorded in meta.recoveries.
 */

const LEGACY_SHEETS_KEY = LEGACY_KEY_BY_SLICE.sheets!;
const LEGACY_RESULTS_KEY = LEGACY_KEY_BY_SLICE.llmArenaResults!;
const LEGACY_VLM_KEY = LEGACY_KEY_BY_SLICE.vlmImageToImage!;

const SHEETS_PAYLOAD = { version: 1, activeTab: 'llm_arena', llmState: { userPrompt: 'kept' } };
const RESULTS_PAYLOAD = { 'openai-gpt-x': { provider: 'openai', model: 'gpt-x', latencyMs: 5, timestamp: 1 } };
const VLM_PAYLOAD = { version: 1, rows: [], historyByResultKey: {} };

describe('keys store v2 migration (Suite C)', () => {
  beforeEach(() => {
    resetKeysStoreForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetKeysStoreForTests();
  });

  it('C1: migrates all legacy islands, backs them up, and removes the originals', () => {
    window.localStorage.setItem(LEGACY_SHEETS_KEY, JSON.stringify(SHEETS_PAYLOAD));
    window.localStorage.setItem(LEGACY_RESULTS_KEY, JSON.stringify(RESULTS_PAYLOAD));
    window.localStorage.setItem(LEGACY_VLM_KEY, JSON.stringify(VLM_PAYLOAD));
    resetKeysStoreForTests({ clearStorage: false });

    expect(readKeysSlice('sheets')).toEqual(SHEETS_PAYLOAD);
    expect(readKeysSlice('llmArenaResults')).toEqual(RESULTS_PAYLOAD);
    expect(readKeysSlice('vlmImageToImage')).toEqual(VLM_PAYLOAD);

    // Rollback copies exist, originals are gone, v2 envelope is persisted.
    expect(window.localStorage.getItem(`${LEGACY_SHEETS_KEY}.bak`)).toBe(JSON.stringify(SHEETS_PAYLOAD));
    expect(window.localStorage.getItem(LEGACY_SHEETS_KEY)).toBeNull();
    expect(window.localStorage.getItem(LEGACY_RESULTS_KEY)).toBeNull();
    expect(window.localStorage.getItem(LEGACY_VLM_KEY)).toBeNull();
    const envelope = JSON.parse(window.localStorage.getItem(KEYS_STORE_STORAGE_KEY)!);
    expect(envelope.version).toBe(2);
    expect(getKeysStoreMeta().migratedAt).toBeTruthy();
  });

  it('C2: partial legacy data migrates what exists without failing', () => {
    window.localStorage.setItem(LEGACY_SHEETS_KEY, JSON.stringify(SHEETS_PAYLOAD));
    resetKeysStoreForTests({ clearStorage: false });

    expect(readKeysSlice('sheets')).toEqual(SHEETS_PAYLOAD);
    expect(readKeysSlice('llmArenaResults')).toBeNull();
    expect(readKeysSlice('vlmImageToImage')).toBeNull();
    expect(readKeysSlice('llmArenaHistory')).toBeNull();
  });

  it('C3: a corrupt legacy island degrades alone — backed up, recorded, others migrate', () => {
    window.localStorage.setItem(LEGACY_SHEETS_KEY, JSON.stringify(SHEETS_PAYLOAD));
    window.localStorage.setItem(LEGACY_VLM_KEY, '{corrupt!!');
    resetKeysStoreForTests({ clearStorage: false });

    expect(readKeysSlice('sheets')).toEqual(SHEETS_PAYLOAD);
    expect(readKeysSlice('vlmImageToImage')).toBeNull();
    expect(window.localStorage.getItem(`${LEGACY_VLM_KEY}.bak`)).toBe('{corrupt!!');
    const meta = getKeysStoreMeta();
    expect(meta.recoveries.some((entry) => entry.reason.includes(LEGACY_VLM_KEY))).toBe(true);
  });

  it('C4: an existing v2 envelope is never re-migrated or overwritten by legacy keys', () => {
    commitKeysSlice('sheets', { version: 1, activeTab: 'vlm_arena' });
    // A legacy key appearing afterwards (e.g. rollback experiment) is ignored.
    window.localStorage.setItem(LEGACY_SHEETS_KEY, JSON.stringify(SHEETS_PAYLOAD));
    resetKeysStoreForTests({ clearStorage: false });

    expect(readKeysSlice('sheets')).toEqual({ version: 1, activeTab: 'vlm_arena' });
    expect(window.localStorage.getItem(LEGACY_SHEETS_KEY)).toBe(JSON.stringify(SHEETS_PAYLOAD));
  });

  it('C5: commit persists once and notifies slice subscribers exactly once', () => {
    const seen: unknown[] = [];
    const unsubscribe = subscribeKeysSlice('llmArenaResults', (value) => seen.push(value));
    commitKeysSlice('llmArenaResults', RESULTS_PAYLOAD);

    expect(seen).toEqual([RESULTS_PAYLOAD]);
    const envelope = JSON.parse(window.localStorage.getItem(KEYS_STORE_STORAGE_KEY)!);
    expect(envelope.slices.llmArenaResults).toEqual(RESULTS_PAYLOAD);

    unsubscribe();
    commitKeysSlice('llmArenaResults', {});
    expect(seen).toHaveLength(1);
  });

  it('C6: quota-exceeded commits keep the in-memory store authoritative and observable', () => {
    readKeysSlice('sheets'); // warm the envelope before storage starts failing
    const setItem = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError');
    });

    expect(() => commitKeysSlice('sheets', SHEETS_PAYLOAD)).not.toThrow();
    expect(readKeysSlice('sheets')).toEqual(SHEETS_PAYLOAD);
    expect(getLastKeysCommitError()).toMatch(/quota/i);
    expect(getKeysStoreMeta().recoveries.some((entry) => entry.reason.includes('commit failed'))).toBe(true);

    setItem.mockRestore();
  });

  it('a corrupt v2 envelope is backed up and rebuilt from surviving legacy keys', () => {
    window.localStorage.setItem(KEYS_STORE_STORAGE_KEY, 'not json at all');
    window.localStorage.setItem(LEGACY_SHEETS_KEY, JSON.stringify(SHEETS_PAYLOAD));
    resetKeysStoreForTests({ clearStorage: false });

    expect(readKeysSlice('sheets')).toEqual(SHEETS_PAYLOAD);
    expect(window.localStorage.getItem(`${KEYS_STORE_STORAGE_KEY}.corrupt.bak`)).toBe('not json at all');
    expect(getKeysStoreMeta().recoveries.some((entry) => entry.reason.includes('failed to parse'))).toBe(true);
  });
});
