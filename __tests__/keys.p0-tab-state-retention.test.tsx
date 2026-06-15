import React, { useLayoutEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { I18nProvider } from '../lib/i18n';
import { KeysView } from '../app/ui/views/KeysView';
import { KeysProvider, useKeysContext, type KeysTab } from '../app/ui/views/Keys/KeysContext';
import { KEYS_STORE_STORAGE_KEY, resetKeysStoreForTests } from '../lib/keys/store';

/**
 * F50 Phase 0 safety net (tdd-spec Suite B5).
 *
 * The four Keys sheets are mounted in parallel and display-toggled
 * (KeysView.tsx) so each sheet keeps its component state across tab switches.
 * This pins both halves of that contract:
 * 1. KeysView keeps all four sheet containers mounted (same DOM nodes) when
 *    the active sheet changes via route prop.
 * 2. KeysContext retains per-sheet state while activeTab cycles through all
 *    four tabs, and persists the envelope.
 */

// Sheet stubs: B5 is about the KeysView mount contract, not sheet internals —
// the real sheets pull in tables/IPC that are covered by their own suites.
vi.mock('../app/ui/views/Keys/ApiKeyValidationSheet', () => ({
  ApiKeyValidationSheet: () => <div data-testid="sheet-api" />,
}));
vi.mock('../app/ui/views/Keys/LlmArenaSheet', () => ({
  LlmArenaSheet: () => <div data-testid="sheet-llm" />,
}));
vi.mock('../app/ui/views/Keys/VlmArenaSheet', () => ({
  VlmArenaSheet: () => <div data-testid="sheet-vlm" />,
}));
vi.mock('../app/ui/views/Keys/CodingAgentCandidateSheet', () => ({
  CodingAgentCandidateSheet: () => <div data-testid="sheet-coding" />,
}));

function isHidden(element: HTMLElement): boolean {
  // `hidden` as an exact class — `overflow-hidden` must not match.
  return element.parentElement!.classList.contains('hidden');
}

describe('Keys tab state retention (P0)', () => {
  beforeEach(() => {
    resetKeysStoreForTests();
  });

  it('B5a: all four sheets stay mounted across sheet-route changes (display toggle)', async () => {
    const view = render(
      <I18nProvider>
        <KeysView initialSheet="llm-arena" />
      </I18nProvider>,
    );

    const before = {
      api: view.getByTestId('sheet-api'),
      llm: view.getByTestId('sheet-llm'),
      vlm: view.getByTestId('sheet-vlm'),
      coding: view.getByTestId('sheet-coding'),
    };
    expect(isHidden(before.llm)).toBe(false);
    expect(isHidden(before.vlm)).toBe(true);

    view.rerender(
      <I18nProvider>
        <KeysView initialSheet="vlm-arena" />
      </I18nProvider>,
    );

    await waitFor(() => {
      expect(isHidden(view.getByTestId('sheet-vlm'))).toBe(false);
    });
    expect(isHidden(view.getByTestId('sheet-llm'))).toBe(true);

    // Same DOM nodes — sheets were toggled, not remounted.
    expect(view.getByTestId('sheet-api')).toBe(before.api);
    expect(view.getByTestId('sheet-llm')).toBe(before.llm);
    expect(view.getByTestId('sheet-vlm')).toBe(before.vlm);
    expect(view.getByTestId('sheet-coding')).toBe(before.coding);
  });

  it('B5b: per-sheet context state survives cycling through all four tabs', async () => {
    let snapshot: { llmModels: number; vlmPrompt: string; codingRows: number } | null = null;

    function Harness() {
      const { setActiveTab, setLlmState, setVlmState, setCodingState, llmState, vlmState, codingState } =
        useKeysContext();

      useLayoutEffect(() => {
        setLlmState((prev) => ({
          ...prev,
          selectedModels: [
            { provider: 'openai', model: 'gpt-x' },
            { provider: 'anthropic', model: 'claude-y' },
          ],
        }));
        setVlmState((prev) => ({ ...prev, userPrompt: 'vlm custom prompt' }));
        setCodingState({
          rows: [{ provider: 'openai', model: 'gpt-x', note: 'n', enabled: true }],
        });
        const cycle: KeysTab[] = ['api_key_validation', 'llm_arena', 'vlm_arena', 'coding_agent_candidate'];
        for (const tab of cycle) setActiveTab(tab);
      }, [setActiveTab, setLlmState, setVlmState, setCodingState]);

      useLayoutEffect(() => {
        snapshot = {
          llmModels: llmState.selectedModels.length,
          vlmPrompt: vlmState.userPrompt,
          codingRows: codingState.rows.length,
        };
      }, [llmState, vlmState, codingState]);

      return null;
    }

    render(
      <KeysProvider initialTab="llm_arena">
        <Harness />
      </KeysProvider>,
    );

    await waitFor(() => {
      expect(snapshot).toEqual({ llmModels: 2, vlmPrompt: 'vlm custom prompt', codingRows: 1 });
    });

    // The persisted v2 envelope carries all three sheet states + the final tab.
    await waitFor(() => {
      const raw = window.localStorage.getItem(KEYS_STORE_STORAGE_KEY);
      expect(raw).toBeTruthy();
      const sheets = JSON.parse(raw!).slices?.sheets;
      expect(sheets.version).toBe(1);
      expect(sheets.activeTab).toBe('coding_agent_candidate');
      expect(sheets.llmState.selectedModels).toHaveLength(2);
      expect(sheets.vlmState.userPrompt).toBe('vlm custom prompt');
      expect(sheets.codingState.rows).toHaveLength(1);
    });
  });
});
