import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useArenaChat } from '../app/ui/views/Keys/useArenaChat';
import { KEYS_STORE_STORAGE_KEY, resetKeysStoreForTests } from '../lib/keys/store';

/**
 * F50 safety net (tdd-spec Suite B3/B6/B7/B8), updated in Phase 2 when
 * arenaRunner became the execution core:
 * - B3: a corrupt results payload falls back to empty results.
 * - B6: the matrix-level resultKey is still `provider-model` — the latest run
 *   wins in the table; trial-level records live in run history (Suite D6).
 * - B7: a timeout aborts the request (runner abort barrier) and surfaces as
 *   errorType=timeout.
 * - B8: a missing key is blocked by the preflight gate (no API call) and does
 *   not affect other models in the same batch.
 */

const LEGACY_RESULTS_KEY = 'pm.arena.llm.results';

const keyByProvider: Record<string, string> = {};

vi.mock('../lib/keys/loadProviderKey', () => ({
  loadProviderKey: vi.fn(async (provider: string) => keyByProvider[provider] ?? ''),
  hasProviderKey: vi.fn(async (provider: string) => Boolean(keyByProvider[provider])),
}));

// useArenaChat statically imports the Tauri-bridge caller; the browser-path
// tests below must never reach it.
vi.mock('../lib/scanner/runProjectScan', () => ({
  callSingleProvider: vi.fn(async () => {
    throw new Error('callSingleProvider must not be hit in browser-path tests');
  }),
}));

// Keys and runtime capability are injected; metadata freshness is stubbed so
// the preflight gate tests exactly what each case intends.
const TEST_OPTIONS = {
  preflightDeps: {
    lastValidatedAt: () => new Date().toISOString(),
    canImage: true,
  },
} as const;

function okChatResponse(content: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ content, model: 'effective-model', inputTokens: 10, outputTokens: 20 }),
  } as Response;
}

describe('useArenaChat safety (P0)', () => {
  beforeEach(() => {
    resetKeysStoreForTests();
    for (const key of Object.keys(keyByProvider)) delete keyByProvider[key];
    keyByProvider.openai = 'sk-test';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('B3: corrupt persisted results fall back to empty without throwing', () => {
    // Seeded via the legacy island — exercises the store-v2 migration path.
    window.localStorage.setItem(LEGACY_RESULTS_KEY, '{corrupt!!');
    const { result } = renderHook(() => useArenaChat('llmArenaResults', TEST_OPTIONS));
    expect(result.current.results).toEqual({});
  });

  it('B6: a second run for the same provider-model overwrites the first result', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okChatResponse('first answer'))
      .mockResolvedValueOnce(okChatResponse('second answer'));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useArenaChat('llmArenaResults', TEST_OPTIONS));
    const config = {
      models: [{ provider: 'openai' as const, model: 'gpt-x' }],
      systemPrompt: '',
      userPrompt: 'hello',
    };

    await act(async () => {
      await result.current.runComparison(config);
    });
    expect(result.current.results['openai-gpt-x']?.content).toBe('first answer');

    await act(async () => {
      await result.current.runComparison(config);
    });
    expect(Object.keys(result.current.results)).toHaveLength(1);
    expect(result.current.results['openai-gpt-x']?.content).toBe('second answer');

    // Write-back companion: the overwritten result is what gets persisted.
    await waitFor(() => {
      const raw = window.localStorage.getItem(KEYS_STORE_STORAGE_KEY);
      expect(raw && JSON.parse(raw).slices?.llmArenaResults?.['openai-gpt-x']?.content).toBe('second answer');
    });
  });

  it('B7: a hung request resolves to an errorType=timeout result', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<never>(() => {})),
    );

    const { result } = renderHook(() => useArenaChat('llmArenaResults', TEST_OPTIONS));
    await act(async () => {
      await result.current.runComparison({
        models: [{ provider: 'openai' as const, model: 'gpt-x' }],
        systemPrompt: '',
        userPrompt: 'hello',
        timeoutMs: 50,
      });
    });

    const entry = result.current.results['openai-gpt-x'];
    expect(entry?.errorType).toBe('timeout');
    expect(entry?.error).toMatch(/timed out after 50ms/);
    expect(entry?.httpStatus).toBeNull();
  });

  it('B8: a model with no saved key fails as missing_key without affecting the batch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okChatResponse('openai ok')));

    const { result } = renderHook(() => useArenaChat('llmArenaResults', TEST_OPTIONS));
    await act(async () => {
      await result.current.runComparison({
        models: [
          { provider: 'openai' as const, model: 'gpt-x' },
          { provider: 'anthropic' as const, model: 'claude-y' },
        ],
        systemPrompt: '',
        userPrompt: 'hello',
      });
    });

    expect(result.current.results['openai-gpt-x']?.content).toBe('openai ok');
    const missing = result.current.results['anthropic-claude-y'];
    expect(missing?.errorType).toBe('missing_key');
    expect(missing?.error).toMatch(/No API key saved for anthropic/);
  });
});
