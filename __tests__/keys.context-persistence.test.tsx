import React, { useLayoutEffect } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { KeysProvider, useKeysContext } from '../app/ui/views/Keys/KeysContext';
import type { LlmProviderId } from '../lib/keys/llmProviders';

const STORAGE_KEY = 'projectManager:keys-state:v1';

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

function SelectedCountProbe({ onCount }: { onCount: (count: number) => void }) {
  const { llmState } = useKeysContext();
  useLayoutEffect(() => {
    onCount(llmState.selectedModels.length);
  }, [llmState.selectedModels.length, onCount]);
  return null;
}

describe('KeysContext persistence', () => {
  beforeEach(() => {
    window.localStorage.removeItem(STORAGE_KEY);
  });

  it('restores all selected LLM models after remount', async () => {
    const first = render(
      <KeysProvider initialTab="llm_arena">
        <SeedLlmModels count={10} />
      </KeysProvider>,
    );
    await waitFor(() => {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!);
      expect(parsed.llmState.selectedModels).toHaveLength(10);
    });
    first.unmount();

    let restoredCount = -1;
    render(
      <KeysProvider initialTab="llm_arena">
        <SelectedCountProbe onCount={(count) => (restoredCount = count)} />
      </KeysProvider>,
    );

    await waitFor(() => {
      expect(restoredCount).toBe(10);
    });
  });
});
