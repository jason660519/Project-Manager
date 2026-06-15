import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nProvider } from '../lib/i18n';
import { KeysProvider } from '../app/ui/views/Keys/KeysContext';
import { CodingAgentCandidateSheet } from '../app/ui/views/Keys/CodingAgentCandidateSheet';
import {
  KEYS_STORE_STORAGE_KEY,
  commitKeysSlice,
  resetKeysStoreForTests,
} from '../lib/keys/store';
import { listCodingAgentCandidates } from '../lib/keys/codingCandidates';

/**
 * F50 Phase 4 (tdd-spec E4–E7): the Arena → Coding Candidates promotion
 * pipeline, end to end against the real store + context + sheet.
 */

const NOW = () => new Date().toISOString();

function seedValidatedOpenai() {
  window.localStorage.setItem(
    'pm:keys-metadata',
    JSON.stringify({ openai: { lastValidatedAt: NOW(), status: 'ok', dynamicModels: [] } }),
  );
}

function passingHistory(model: string, count: number, score = 88) {
  return Array.from({ length: count }, (_, index) => ({
    timestamp: 1_765_000_000_000 + index,
    summary: 'ok',
    latencyMs: 100,
    inputTokens: 10,
    outputTokens: 20,
    evaluationLevel: 'pass',
    overallScore: score,
    resultRow: {
      run_id: `pm-arena-run-${index}`,
      provider: 'openai',
      model_id: model,
      overall_score: score,
    },
  }));
}

function renderSheet() {
  return render(
    <I18nProvider>
      <KeysProvider initialTab="coding_agent_candidate">
        <CodingAgentCandidateSheet />
      </KeysProvider>
    </I18nProvider>,
  );
}

function persistedCodingState() {
  const raw = window.localStorage.getItem(KEYS_STORE_STORAGE_KEY);
  return raw ? JSON.parse(raw).slices?.sheets?.codingState ?? null : null;
}

describe('Arena → Coding Candidates promotion pipeline (Suite E4–E7)', () => {
  beforeEach(() => {
    resetKeysStoreForTests();
    window.localStorage.removeItem('pm:keys-metadata');
  });

  it('E4: a master-tier model from arena history appears as a suggestion', async () => {
    seedValidatedOpenai();
    commitKeysSlice('llmArenaHistory', { 'openai-gpt-4o': passingHistory('gpt-4o', 6) });

    renderSheet();

    const panel = await screen.findByTestId('coding-suggestions-panel');
    expect(panel.textContent).toContain('openai/gpt-4o');
    expect(panel.textContent).toContain('master');
    expect(panel.textContent).toContain('success 100%');
    expect(panel.textContent).toContain('score 88');
  });

  it('E4: accepting a suggestion creates a provenance-carrying enabled row', async () => {
    seedValidatedOpenai();
    commitKeysSlice('llmArenaHistory', { 'openai-gpt-4o': passingHistory('gpt-4o', 6) });

    renderSheet();
    fireEvent.click(await screen.findByText('Accept'));

    await waitFor(() => {
      const codingState = persistedCodingState();
      expect(codingState?.rows).toHaveLength(1);
      const row = codingState.rows[0];
      expect(row).toMatchObject({
        provider: 'openai',
        model: 'gpt-4o',
        enabled: true,
        origin: 'accepted',
        sourceRunId: 'pm-arena-run-0',
        scoreSnapshot: 88,
      });
    });

    // Accepted pairs leave the suggestion panel (they exist as rows now).
    await waitFor(() => {
      expect(screen.queryByTestId('coding-suggestions-panel')).toBeNull();
    });

    // E7: the AI Assistant selector keeps its contract and carries provenance.
    const candidates = listCodingAgentCandidates(persistedCodingState());
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      provider: 'openai',
      model: 'gpt-4o',
      origin: 'accepted',
      sourceRunId: 'pm-arena-run-0',
    });
    expect(typeof candidates[0].id).toBe('string');
  });

  it('E5: a dismissed suggestion never comes back, even after remount', async () => {
    seedValidatedOpenai();
    commitKeysSlice('llmArenaHistory', { 'openai-gpt-4o': passingHistory('gpt-4o', 6) });

    const first = renderSheet();
    fireEvent.click(await screen.findByText('Dismiss'));
    await waitFor(() => {
      expect(screen.queryByTestId('coding-suggestions-panel')).toBeNull();
    });
    await waitFor(() => {
      const codingState = persistedCodingState();
      expect(Object.keys(codingState?.dismissedSuggestions ?? {})).toHaveLength(1);
    });
    first.unmount();

    renderSheet();
    await waitFor(() => {
      expect(screen.queryByTestId('coding-suggestions-panel')).toBeNull();
    });
  });

  it('does not suggest rejected or insufficient-data models', async () => {
    seedValidatedOpenai();
    commitKeysSlice('llmArenaHistory', {
      // 4 trials → insufficient_data
      'openai-gpt-4o': passingHistory('gpt-4o', 4),
      // 6 trials but 3 failures → rejected
      'openai-o1': [
        ...passingHistory('o1', 3),
        ...passingHistory('o1', 3).map((entry) => ({ ...entry, error: 'boom', evaluationLevel: 'fail' })),
      ],
    });

    renderSheet();
    await waitFor(() => {
      expect(screen.queryByTestId('coding-suggestions-panel')).toBeNull();
    });
  });

  it('E6: candidates whose providers lost validation show the stale warning', async () => {
    // No provider metadata at all — every persisted row is stale.
    commitKeysSlice('sheets', {
      version: 1,
      activeTab: 'coding_agent_candidate',
      codingState: {
        rows: [{ provider: 'openai', model: 'gpt-4o', note: '', enabled: true }],
      },
    });

    renderSheet();

    const warning = await screen.findByTestId('coding-stale-warning');
    expect(warning.textContent).toContain('openai/gpt-4o');
  });
});
