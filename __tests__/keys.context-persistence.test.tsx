import React, { useLayoutEffect } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { KeysProvider, useKeysContext } from '../app/ui/views/Keys/KeysContext';
import {
  KEYS_STORE_STORAGE_KEY,
  LEGACY_KEY_BY_SLICE,
  commitKeysSlice,
  resetKeysStoreForTests,
} from '../lib/keys/store';
import type { LlmProviderId } from '../lib/keys/llmProviders';

const LEGACY_STORAGE_KEY = LEGACY_KEY_BY_SLICE.sheets!;

function readPersistedSheets(): any {
  const raw = window.localStorage.getItem(KEYS_STORE_STORAGE_KEY);
  if (!raw) return null;
  return JSON.parse(raw).slices?.sheets ?? null;
}
const NEW_DEFAULT_LLM_PROMPT = '你是哪一家公司的哪一個模型？';
const LEGACY_DEFAULT_LLM_PROMPT = 'Explain how a neural network works in simple terms.';

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

function LlmPromptProbe({ onPrompt }: { onPrompt: (prompt: string) => void }) {
  const { llmState } = useKeysContext();
  useLayoutEffect(() => {
    onPrompt(llmState.userPrompt);
  }, [llmState.userPrompt, onPrompt]);
  return null;
}

describe('KeysContext persistence', () => {
  beforeEach(() => {
    resetKeysStoreForTests();
  });

  it('restores all selected LLM models after remount', async () => {
    const first = render(
      <KeysProvider initialTab="llm_arena">
        <SeedLlmModels count={10} />
      </KeysProvider>,
    );
    await waitFor(() => {
      const sheets = readPersistedSheets();
      expect(sheets).toBeTruthy();
      expect(sheets.llmState.selectedModels).toHaveLength(10);
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

  it('uses the company/model identity question as the default LLM arena test prompt', async () => {
    let prompt = '';
    render(
      <KeysProvider initialTab="llm_arena">
        <LlmPromptProbe onPrompt={(value) => (prompt = value)} />
      </KeysProvider>,
    );

    await waitFor(() => {
      expect(prompt).toBe(NEW_DEFAULT_LLM_PROMPT);
    });
  });

  it('migrates the old default LLM arena test prompt without overwriting custom prompts', async () => {
    // Seed the LEGACY v1 island — covers the store-v2 migration path end to end.
    window.localStorage.setItem(
      LEGACY_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        activeTab: 'llm_arena',
        llmState: {
          systemPrompt: 'You are a helpful AI assistant. Respond clearly and concisely.',
          userPrompt: LEGACY_DEFAULT_LLM_PROMPT,
          selectedModels: [],
          temperature: 0.7,
        },
        vlmState: {
          systemPrompt: 'You are a helpful AI vision assistant. Describe what you see accurately.',
          userPrompt: 'What is happening in this image?',
          selectedModels: [],
          temperature: 0.4,
          imageDataUrl: null,
          imageDetail: 'auto',
        },
      }),
    );

    let migratedPrompt = '';
    const migrated = render(
      <KeysProvider initialTab="llm_arena">
        <LlmPromptProbe onPrompt={(value) => (migratedPrompt = value)} />
      </KeysProvider>,
    );

    await waitFor(() => {
      expect(migratedPrompt).toBe(NEW_DEFAULT_LLM_PROMPT);
    });
    migrated.unmount();

    const customPrompt = 'Keep this custom LLM arena test prompt.';
    // The envelope already exists now, so seed through the live store instead
    // of the (ignored) legacy key.
    commitKeysSlice('sheets', {
      version: 1,
      activeTab: 'llm_arena',
      llmState: {
        systemPrompt: 'You are a helpful AI assistant. Respond clearly and concisely.',
        userPrompt: customPrompt,
        selectedModels: [],
        temperature: 0.7,
      },
      vlmState: {
        systemPrompt: 'You are a helpful AI vision assistant. Describe what you see accurately.',
        userPrompt: 'What is happening in this image?',
        selectedModels: [],
        temperature: 0.4,
        imageDataUrl: null,
        imageDetail: 'auto',
      },
    });

    let restoredCustomPrompt = '';
    render(
      <KeysProvider initialTab="llm_arena">
        <LlmPromptProbe onPrompt={(value) => (restoredCustomPrompt = value)} />
      </KeysProvider>,
    );

    await waitFor(() => {
      expect(restoredCustomPrompt).toBe(customPrompt);
    });
  });
});
