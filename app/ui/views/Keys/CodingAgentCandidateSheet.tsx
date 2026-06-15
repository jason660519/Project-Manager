'use client';

import React, { useEffect } from 'react';
import { useKeysContext } from './KeysContext';
import { useI18n } from '../../../../lib/i18n';
import { CodingAgentCandidateTable } from './CodingAgentCandidateTable';
import type { CodingCandidateRow } from '../../../../lib/keys/codingCandidates';
import type { LlmProviderId } from '../../../../lib/keys/llmProviders';
import {
  useArenaPromotionSuggestions,
  type ArenaPromotionSuggestion,
} from './useArenaPromotionSuggestions';

const MAX_CODING_CANDIDATES = 20;

function preferredModelForProvider(provider: {
  availableModels: readonly string[];
  defaultModel?: string;
}): string {
  if (provider.defaultModel && provider.availableModels.includes(provider.defaultModel)) {
    return provider.defaultModel;
  }
  return provider.availableModels[0] ?? '';
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length
  ) {
    return items;
  }
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export function CodingAgentCandidateSheet() {
  const { t } = useI18n();
  const copy = t.keysArena.coding;
  const { codingState, setCodingState, validatedLlmProviders } = useKeysContext();
  const providers = validatedLlmProviders;
  const rows = codingState.rows;
  const suggestions = useArenaPromotionSuggestions({ codingState, providers });

  // Steady-state staleness only happens when no provider is validated at all
  // (with validated providers present, the reconcile effect below repoints
  // rows instead). Surface it instead of letting the AI Assistant consume
  // candidates that cannot run.
  const staleModels =
    providers.length === 0 && rows.length > 0 ? rows.map((row) => `${row.provider}/${row.model}`) : [];

  const acceptSuggestion = (suggestion: ArenaPromotionSuggestion) => {
    setCodingState((prev) => {
      if (prev.rows.length >= MAX_CODING_CANDIDATES) return prev;
      const exists = prev.rows.some(
        (row) => row.provider === suggestion.provider && row.model === suggestion.model,
      );
      if (exists) return prev;
      const { tier, successRate, averageScore } = suggestion.verdict;
      const row: CodingCandidateRow = {
        provider: suggestion.provider,
        model: suggestion.model,
        note: `Arena ${tier} · success ${Math.round(successRate * 100)}%${
          averageScore == null ? '' : ` · score ${averageScore}`
        }${suggestion.sourceRunId ? ` · ${suggestion.sourceRunId}` : ''}`,
        enabled: true,
        origin: 'accepted',
        ...(suggestion.sourceRunId ? { sourceRunId: suggestion.sourceRunId } : {}),
        ...(averageScore == null ? {} : { scoreSnapshot: averageScore }),
      };
      return { ...prev, rows: [...prev.rows, row] };
    });
  };

  const dismissSuggestion = (suggestion: ArenaPromotionSuggestion) => {
    setCodingState((prev) => ({
      ...prev,
      dismissedSuggestions: {
        ...prev.dismissedSuggestions,
        [suggestion.id]: new Date().toISOString(),
      },
    }));
  };

  // Reconcile rows when the set of validated providers/models changes: repoint a
  // row's model if it is no longer available, or repoint to a fallback provider
  // if the provider's key was removed. We never wipe the whole list on a
  // transient key issue (no validated providers) — the curation is persisted and
  // recovers when keys return.
  const providersSignature = providers
    .map((p) => `${p.id}:${p.availableModels.join(',')}`)
    .join('|');

  useEffect(() => {
    if (providers.length === 0) return;
    setCodingState((prev) => {
      if (prev.rows.length === 0) return prev;
      const allowedByProvider = new Map(providers.map((p) => [p.id, p.availableModels]));
      const fallback = providers[0];
      let changed = false;
      const nextRows = prev.rows.map((row) => {
        const allowed = allowedByProvider.get(row.provider);
        if (allowed && allowed.includes(row.model)) return row;
        changed = true;
        if (allowed && allowed.length > 0) {
          const provider = providers.find((p) => p.id === row.provider);
          return { ...row, model: provider ? preferredModelForProvider(provider) : allowed[0] };
        }
        return { ...row, provider: fallback.id, model: preferredModelForProvider(fallback) };
      });
      if (!changed) return prev;
      return { ...prev, rows: nextRows.filter((row) => Boolean(row.model)) };
    });
    // providersSignature captures the meaningful provider/model changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providersSignature]);

  const addRow = () => {
    const provider = providers[0];
    if (!provider) return;
    setCodingState((prev) => {
      if (prev.rows.length >= MAX_CODING_CANDIDATES) return prev;
      const model = preferredModelForProvider(provider);
      if (!model) return prev;
      const existing = new Set(prev.rows.map((r) => `${r.provider}::${r.model}`));
      if (existing.has(`${provider.id}::${model}`)) return prev;
      const row: CodingCandidateRow = { provider: provider.id, model, note: '', enabled: true };
      return { ...prev, rows: [...prev.rows, row] };
    });
  };

  const removeRow = (index: number) => {
    setCodingState((prev) => ({ ...prev, rows: prev.rows.filter((_, i) => i !== index) }));
  };

  const updateModel = (index: number, providerId: string, model: string) => {
    setCodingState((prev) => {
      const next = [...prev.rows];
      const current = next[index];
      if (!current) return prev;
      next[index] = { ...current, provider: providerId as LlmProviderId, model };
      return { ...prev, rows: next };
    });
  };

  const toggleEnabled = (index: number, enabled: boolean) => {
    setCodingState((prev) => {
      const next = [...prev.rows];
      const current = next[index];
      if (!current) return prev;
      next[index] = { ...current, enabled };
      return { ...prev, rows: next };
    });
  };

  const setNote = (index: number, note: string) => {
    setCodingState((prev) => {
      const next = [...prev.rows];
      const current = next[index];
      if (!current) return prev;
      next[index] = { ...current, note };
      return { ...prev, rows: next };
    });
  };

  const moveRow = (fromIndex: number, toIndex: number) => {
    setCodingState((prev) => ({ ...prev, rows: moveItem(prev.rows, fromIndex, toIndex) }));
  };

  const importModels = (models: { provider: LlmProviderId; model: string }[]) => {
    setCodingState((prev) => {
      const existing = new Set(prev.rows.map((r) => `${r.provider}::${r.model}`));
      const additions: CodingCandidateRow[] = [];
      for (const m of models) {
        const key = `${m.provider}::${m.model}`;
        if (existing.has(key)) continue;
        if (prev.rows.length + additions.length >= MAX_CODING_CANDIDATES) break;
        existing.add(key);
        additions.push({ provider: m.provider, model: m.model, note: '', enabled: true });
      }
      if (additions.length === 0) return prev;
      return { ...prev, rows: [...prev.rows, ...additions] };
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {staleModels.length > 0 && (
        <div
          role="alert"
          data-testid="coding-stale-warning"
          className="rounded-md border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300"
        >
          {copy.staleWarning} {staleModels.join(', ')}
        </div>
      )}

      {suggestions.length > 0 && (
        <div
          data-testid="coding-suggestions-panel"
          className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-3 py-2"
        >
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
            {copy.suggestionsTitle}
          </div>
          <ul className="mt-1 flex flex-col gap-1">
            {suggestions.map((suggestion) => (
              <li
                key={suggestion.id}
                data-testid="coding-suggestion-row"
                className="flex items-center justify-between gap-3 text-xs text-stone-200"
              >
                <span>
                  {suggestion.provider}/{suggestion.model} — {suggestion.verdict.tier} · success{' '}
                  {Math.round(suggestion.verdict.successRate * 100)}%
                  {suggestion.verdict.averageScore == null
                    ? ''
                    : ` · score ${suggestion.verdict.averageScore}`}
                </span>
                <span className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    className="rounded border border-emerald-400/40 px-2 py-0.5 text-emerald-300 hover:bg-emerald-500/20"
                    onClick={() => acceptSuggestion(suggestion)}
                  >
                    {copy.suggestionAccept}
                  </button>
                  <button
                    type="button"
                    className="rounded border border-stone-400/30 px-2 py-0.5 text-stone-400 hover:bg-stone-500/20"
                    onClick={() => dismissSuggestion(suggestion)}
                  >
                    {copy.suggestionDismiss}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <CodingAgentCandidateTable
        copy={copy}
        rows={rows}
        providers={providers}
        canAdd={providers.length > 0 && rows.length < MAX_CODING_CANDIDATES}
        maxRows={MAX_CODING_CANDIDATES}
        onAddRow={addRow}
        onRemoveRow={removeRow}
        onUpdateModel={updateModel}
        onToggleEnabled={toggleEnabled}
        onNoteChange={setNote}
        onMoveRow={moveRow}
        onImportModels={importModels}
      />
    </div>
  );
}
