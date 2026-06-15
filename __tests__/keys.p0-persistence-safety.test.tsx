import React, { useLayoutEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { KeysProvider, useKeysContext } from '../app/ui/views/Keys/KeysContext';
import { resetKeysStoreForTests } from '../lib/keys/store';
import type { LlmProviderId } from '../lib/keys/llmProviders';

/**
 * F50 Phase 0 safety net (tdd-spec Suite B1/B2/B4), updated for store v2 in
 * Phase 1: corrupt or version-mismatched sheet payloads (seeded via the
 * legacy island so the migration path is exercised) must fall back to
 * defaults without throwing, and a quota-exceeded write must not break
 * in-memory UI state.
 */

const LEGACY_STORAGE_KEY = 'projectManager:keys-state:v1';
const DEFAULT_LLM_PROMPT = '你是哪一家公司的哪一個模型？';

function LlmStateProbe({
  onState,
}: {
  onState: (state: { userPrompt: string; selectedCount: number }) => void;
}) {
  const { llmState } = useKeysContext();
  useLayoutEffect(() => {
    onState({ userPrompt: llmState.userPrompt, selectedCount: llmState.selectedModels.length });
  }, [llmState, onState]);
  return null;
}

function SeedLlmModels({ count }: { count: number }) {
  const { setLlmState } = useKeysContext();
  useLayoutEffect(() => {
    const providerCycle: LlmProviderId[] = ['openai', 'anthropic'];
    setLlmState((prev) => ({
      ...prev,
      selectedModels: Array.from({ length: count }, (_, index) => ({
        provider: providerCycle[index % providerCycle.length],
        model: `model-${index + 1}`,
      })),
    }));
  }, [count, setLlmState]);
  return null;
}

describe('Keys persistence safety (P0)', () => {
  beforeEach(() => {
    resetKeysStoreForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('B1: corrupt JSON in the keys envelope falls back to defaults without throwing', async () => {
    window.localStorage.setItem(LEGACY_STORAGE_KEY, '{this is not json');

    let probed: { userPrompt: string; selectedCount: number } | null = null;
    render(
      <KeysProvider initialTab="llm_arena">
        <LlmStateProbe onState={(state) => (probed = state)} />
      </KeysProvider>,
    );

    await waitFor(() => {
      expect(probed).not.toBeNull();
    });
    expect(probed!.userPrompt).toBe(DEFAULT_LLM_PROMPT);
    expect(probed!.selectedCount).toBe(0);
  });

  it('B2: a sheet payload version other than 1 is rejected wholesale and defaults are used', async () => {
    window.localStorage.setItem(
      LEGACY_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        activeTab: 'llm_arena',
        llmState: {
          systemPrompt: 'sys',
          userPrompt: 'custom prompt that must NOT survive a version mismatch',
          selectedModels: [{ provider: 'openai', model: 'gpt-x' }],
          temperature: 0.7,
        },
      }),
    );

    let probed: { userPrompt: string; selectedCount: number } | null = null;
    render(
      <KeysProvider initialTab="llm_arena">
        <LlmStateProbe onState={(state) => (probed = state)} />
      </KeysProvider>,
    );

    await waitFor(() => {
      expect(probed).not.toBeNull();
    });
    expect(probed!.userPrompt).toBe(DEFAULT_LLM_PROMPT);
    expect(probed!.selectedCount).toBe(0);
  });

  it('B4: quota-exceeded writes are swallowed and in-memory state still updates', async () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError');
    });

    let probed: { userPrompt: string; selectedCount: number } | null = null;
    render(
      <KeysProvider initialTab="llm_arena">
        <SeedLlmModels count={3} />
        <LlmStateProbe onState={(state) => (probed = state)} />
      </KeysProvider>,
    );

    await waitFor(() => {
      expect(probed?.selectedCount).toBe(3);
    });
  });
});
