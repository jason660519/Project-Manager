import React, { useLayoutEffect } from 'react';
import { describe, expect, it } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { I18nProvider } from '../lib/i18n';
import { KeysProvider, useKeysContext } from '../app/ui/views/Keys/KeysContext';
import { LlmArenaSheet } from '../app/ui/views/Keys/LlmArenaSheet';
import { saveProviderMetadata } from '../lib/keys/providerMetadata';

function Harness({ selectedModels }: { selectedModels: Array<{ provider: any; model: string }> }) {
  const { setLlmState } = useKeysContext();

  useLayoutEffect(() => {
    setLlmState((prev) => ({ ...prev, selectedModels }));
  }, [selectedModels, setLlmState]);

  return <LlmArenaSheet />;
}

function optionValues(select: HTMLSelectElement) {
  return Array.from(select.querySelectorAll('option'))
    .map((option) => option.getAttribute('value') ?? '')
    .filter(Boolean);
}

function findProviderSelect(container: HTMLElement, providerIds: string[]) {
  const selects = Array.from(container.querySelectorAll('select')) as HTMLSelectElement[];
  return selects.find((select) => providerIds.some((id) => select.querySelector(`option[value="${id}"]`)));
}

function findModelSelect(container: HTMLElement, modelIds: string[]) {
  const selects = Array.from(container.querySelectorAll('select')) as HTMLSelectElement[];
  return selects.find((select) => modelIds.some((id) => select.querySelector(`option[value="${id}"]`)));
}

describe('Keys / LLM Arena model selection', () => {
  it('limits providers + models to the validated dynamic model set', async () => {
    saveProviderMetadata('anthropic', {
      lastValidatedAt: '2026-05-27T00:00:00Z',
      status: 'ok',
      dynamicModels: ['claude-test-a', 'claude-test-b'],
    });
    saveProviderMetadata('openai', {
      lastValidatedAt: '2026-05-27T00:00:00Z',
      status: 'ok',
      dynamicModels: ['o1-test'],
    });

    const { container } = render(
      <I18nProvider>
        <KeysProvider initialTab="llm_arena">
          <Harness selectedModels={[{ provider: 'anthropic', model: 'claude-test-a' }]} />
        </KeysProvider>
      </I18nProvider>,
    );

    await waitFor(() => {
      const providerSelect = findProviderSelect(container, ['anthropic', 'openai']);
      expect(providerSelect).toBeTruthy();
      const values = optionValues(providerSelect!);
      expect(new Set(values)).toEqual(new Set(['anthropic', 'openai']));
    });

    await waitFor(() => {
      const modelSelect = findModelSelect(container, ['claude-test-a', 'claude-test-b']);
      expect(modelSelect).toBeTruthy();
      expect(optionValues(modelSelect!)).toEqual(['claude-test-a', 'claude-test-b']);
    });
  });

  it('syncs immediately when validated model lists change (re-validate / update / invalidate)', async () => {
    saveProviderMetadata('anthropic', {
      lastValidatedAt: '2026-05-27T00:00:00Z',
      status: 'ok',
      dynamicModels: ['claude-old'],
    });

    const { container } = render(
      <I18nProvider>
        <KeysProvider initialTab="llm_arena">
          <Harness selectedModels={[{ provider: 'anthropic', model: 'claude-old' }]} />
        </KeysProvider>
      </I18nProvider>,
    );

    await waitFor(() => {
      const modelSelect = findModelSelect(container, ['claude-old']);
      expect(modelSelect).toBeTruthy();
      expect(optionValues(modelSelect!)).toEqual(['claude-old']);
    });

    saveProviderMetadata('anthropic', {
      lastValidatedAt: '2026-05-27T00:05:00Z',
      status: 'ok',
      dynamicModels: ['claude-new-1', 'claude-new-2'],
    });

    await waitFor(() => {
      const modelSelect = findModelSelect(container, ['claude-new-1', 'claude-new-2']);
      expect(modelSelect).toBeTruthy();
      expect(optionValues(modelSelect!)).toEqual(['claude-new-1', 'claude-new-2']);
    });
  });

  it('shows no selectable providers when nothing is validated', async () => {
    const { container } = render(
      <I18nProvider>
        <KeysProvider initialTab="llm_arena">
          <Harness selectedModels={[]} />
        </KeysProvider>
      </I18nProvider>,
    );

    await waitFor(() => {
      const providerSelect = findProviderSelect(container, ['anthropic', 'openai', 'gemini']);
      expect(providerSelect).toBeUndefined();
    });
  });
});

