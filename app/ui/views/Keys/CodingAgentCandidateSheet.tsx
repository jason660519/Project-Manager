'use client';

import React, { useEffect } from 'react';
import { useKeysContext } from './KeysContext';
import { useI18n } from '../../../../lib/i18n';
import { CodingAgentCandidateTable } from './CodingAgentCandidateTable';
import type { CodingCandidateRow } from '../../../../lib/keys/codingCandidates';
import type { LlmProviderId } from '../../../../lib/keys/llmProviders';

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
      return { rows: nextRows.filter((row) => Boolean(row.model)) };
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
      return { rows: [...prev.rows, row] };
    });
  };

  const removeRow = (index: number) => {
    setCodingState((prev) => ({ rows: prev.rows.filter((_, i) => i !== index) }));
  };

  const updateModel = (index: number, providerId: string, model: string) => {
    setCodingState((prev) => {
      const next = [...prev.rows];
      const current = next[index];
      if (!current) return prev;
      next[index] = { ...current, provider: providerId as LlmProviderId, model };
      return { rows: next };
    });
  };

  const toggleEnabled = (index: number, enabled: boolean) => {
    setCodingState((prev) => {
      const next = [...prev.rows];
      const current = next[index];
      if (!current) return prev;
      next[index] = { ...current, enabled };
      return { rows: next };
    });
  };

  const setNote = (index: number, note: string) => {
    setCodingState((prev) => {
      const next = [...prev.rows];
      const current = next[index];
      if (!current) return prev;
      next[index] = { ...current, note };
      return { rows: next };
    });
  };

  const moveRow = (fromIndex: number, toIndex: number) => {
    setCodingState((prev) => ({ rows: moveItem(prev.rows, fromIndex, toIndex) }));
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
      return { rows: [...prev.rows, ...additions] };
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
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
