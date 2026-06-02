'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useKeysContext } from './KeysContext';
import { useArenaChat } from './useArenaChat';
import { hasProviderKey } from '../../../../lib/keys/loadProviderKey';
import { useI18n } from '../../../../lib/i18n';
import { LlmArenaMatrixTable } from './LlmArenaMatrixTable';
import { LlmArenaDetailSheet } from './LlmArenaDetailSheet';
import { formatResultSummary, type EvaluationLevel, type RunHistoryEntry } from './LlmArenaTypes';
import { buildLlmArenaResultRow } from './LlmArenaEvaluation';
import type { ArenaModelSpec } from './useArenaChat';

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
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
    return items;
  }
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function removeIndexedRecord<T>(record: Record<number, T>, removedIndex: number, length: number): Record<number, T> {
  const next: Record<number, T> = {};
  for (let index = 0; index < length; index += 1) {
    if (index === removedIndex) continue;
    const value = record[index];
    if (value === undefined) continue;
    next[index > removedIndex ? index - 1 : index] = value;
  }
  return next;
}

function moveIndexedRecord<T>(record: Record<number, T>, fromIndex: number, toIndex: number, length: number): Record<number, T> {
  const values = Array.from({ length }, (_, index) => record[index]);
  const moved = moveItem(values, fromIndex, toIndex);
  const next: Record<number, T> = {};
  moved.forEach((value, index) => {
    if (value !== undefined) next[index] = value;
  });
  return next;
}

export function LlmArenaSheet() {
  const { t } = useI18n();
  const copy = t.keysArena.llm;
  const { llmState, setLlmState, validatedLlmProviders } = useKeysContext();
  const { runComparison, results, clearResults } = useArenaChat('pm.arena.llm.results');
  const allProviders = validatedLlmProviders;
  const seenResultTimestampRef = useRef<Record<string, number>>({});
  const [evaluationByIndex, setEvaluationByIndex] = useState<Record<number, EvaluationLevel>>({});
  const [noteByIndex, setNoteByIndex] = useState<Record<number, string>>({});
  const [promptOverrideByIndex, setPromptOverrideByIndex] = useState<Record<number, string>>({});
  const [historyByResultKey, setHistoryByResultKey] = useState<Record<string, RunHistoryEntry[]>>({});
  const [selectedDetailIndex, setSelectedDetailIndex] = useState<number | null>(null);
  const [runningIndexes, setRunningIndexes] = useState<Set<number>>(new Set());
  const autoAddSignatureRef = useRef<string>('');
  const providersSignature = allProviders
    .map((provider) => `${provider.id}:${provider.availableModels.join(',')}`)
    .join('|');

  useEffect(() => {
    setLlmState((prev) => {
      if (prev.selectedModels.length === 0) return prev;
      if (allProviders.length === 0) {
        return { ...prev, selectedModels: [] };
      }

      const allowedByProvider = new Map(allProviders.map((p) => [p.id, p.availableModels]));
      const fallbackProvider = allProviders[0]?.id;
      const fallbackModel = allProviders[0] ? preferredModelForProvider(allProviders[0]) : '';

      let changed = false;
      const nextSelected = prev.selectedModels.map((spec) => {
        const allowedModels = allowedByProvider.get(spec.provider);
        if (allowedModels && allowedModels.includes(spec.model)) return spec;
        changed = true;
        if (allowedModels && allowedModels.length > 0) {
          const provider = allProviders.find((item) => item.id === spec.provider);
          return { provider: spec.provider, model: provider ? preferredModelForProvider(provider) : allowedModels[0] };
        }
        return { provider: fallbackProvider, model: fallbackModel };
      });

      if (!changed) return prev;
      return { ...prev, selectedModels: nextSelected.filter((spec) => Boolean(spec.model)) };
    });
  }, [providersSignature, allProviders.length, setLlmState]);

  useEffect(() => {
    setEvaluationByIndex((prev) => {
      const next = { ...prev };
      llmState.selectedModels.forEach((_, index) => {
        if (!next[index]) next[index] = 'pending';
      });
      Object.keys(next).forEach((key) => {
        const index = Number(key);
        if (Number.isFinite(index) && index >= llmState.selectedModels.length) delete next[index];
      });
      return next;
    });

    setNoteByIndex((prev) => {
      const next = { ...prev };
      llmState.selectedModels.forEach((_, index) => {
        if (typeof next[index] !== 'string') next[index] = '';
      });
      Object.keys(next).forEach((key) => {
        const index = Number(key);
        if (Number.isFinite(index) && index >= llmState.selectedModels.length) delete next[index];
      });
      return next;
    });

    setPromptOverrideByIndex((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        const index = Number(key);
        if (Number.isFinite(index) && index >= llmState.selectedModels.length) delete next[index];
      });
      return next;
    });
  }, [llmState.selectedModels]);

  useEffect(() => {
    const indexByResultKey: Record<string, number> = {};
    llmState.selectedModels.forEach((spec, index) => {
      indexByResultKey[`${spec.provider}-${spec.model}`] = index;
    });
    const nextEntries: Array<{ key: string; entry: RunHistoryEntry }> = [];

    Object.entries(results).forEach(([resultKey, result]) => {
      const lastSeen = seenResultTimestampRef.current[resultKey] ?? 0;
      if (!result.timestamp || result.timestamp <= lastSeen) return;
      if (indexByResultKey[resultKey] === undefined) return;
      const index = indexByResultKey[resultKey];
      const spec = llmState.selectedModels[index];
      if (!spec) return;
      seenResultTimestampRef.current[resultKey] = result.timestamp;
      const existingSuccesses = historyByResultKey[resultKey]?.filter((entry) => !entry.error).length ?? 0;
      const existingTotal = historyByResultKey[resultKey]?.length ?? 0;
      const successRateRecent = existingTotal === 0 ? null : existingSuccesses / existingTotal;
      const resultRow = buildLlmArenaResultRow({
        runId: `pm-llm-arena-${result.timestamp}-${resultKey}`,
        provider: spec.provider,
        model: spec.model,
        systemPrompt: llmState.systemPrompt,
        userPrompt: promptOverrideByIndex[index] ?? llmState.userPrompt,
        result,
        temperature: llmState.temperature,
        maxTokens: llmState.maxTokens,
        timeoutMs: llmState.timeoutMs,
        profile: llmState.scoringProfile,
        successRateRecent,
        note: noteByIndex[index] ?? null,
      });
      nextEntries.push({
        key: resultKey,
        entry: {
          timestamp: result.timestamp,
          summary: formatResultSummary(result, copy),
          latencyMs: result.latencyMs,
          inputTokens: result.inputTokens ?? 0,
          outputTokens: result.outputTokens ?? 0,
          evaluationLevel: resultRow.evaluation_level,
          evaluationMessage: resultRow.evaluation_message,
          overallScore: resultRow.overall_score,
          resultRow,
          error: result.error,
        },
      });
      setEvaluationByIndex((prev) => ({ ...prev, [index]: resultRow.evaluation_level }));
      setNoteByIndex((prev) => ({ ...prev, [index]: resultRow.evaluation_message }));
    });

    if (nextEntries.length === 0) return;
    setHistoryByResultKey((prev) => {
      const next = { ...prev };
      nextEntries.forEach(({ key, entry }) => {
        const history = next[key] ? [...next[key]] : [];
        history.unshift(entry);
        next[key] = history.slice(0, 10);
      });
      return next;
    });
  }, [
    results,
    llmState.selectedModels,
    llmState.systemPrompt,
    llmState.userPrompt,
    llmState.temperature,
    llmState.maxTokens,
    llmState.timeoutMs,
    llmState.scoringProfile,
    historyByResultKey,
    promptOverrideByIndex,
    noteByIndex,
    copy,
  ]);

  const addModel = () => {
    const defaultProvider = allProviders[0];
    if (!defaultProvider) return;
    setLlmState((prev) => ({
      ...prev,
      selectedModels: [
        ...prev.selectedModels,
        { provider: defaultProvider.id, model: preferredModelForProvider(defaultProvider) }
      ]
    }));
  };

  const removeModel = (index: number) => {
    const length = llmState.selectedModels.length;
    setLlmState((prev) => ({
      ...prev,
      selectedModels: prev.selectedModels.filter((_, i) => i !== index)
    }));
    setEvaluationByIndex((prev) => removeIndexedRecord(prev, index, length));
    setNoteByIndex((prev) => removeIndexedRecord(prev, index, length));
    setPromptOverrideByIndex((prev) => removeIndexedRecord(prev, index, length));
  };

  const updateModel = (index: number, providerId: string, modelStr: string) => {
    setLlmState((prev) => {
      const next = [...prev.selectedModels];
      next[index] = { provider: providerId as any, model: modelStr };
      return { ...prev, selectedModels: next };
    });
  };

  const importModels = (models: ArenaModelSpec[]) => {
    setLlmState((prev) => ({
      ...prev,
      selectedModels: models.slice(0, 10),
    }));
    setEvaluationByIndex({});
    setNoteByIndex({});
    setPromptOverrideByIndex({});
  };

  const moveModel = (fromIndex: number, toIndex: number) => {
    const length = llmState.selectedModels.length;
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= length || toIndex >= length) return;
    setLlmState((prev) => ({
      ...prev,
      selectedModels: moveItem(prev.selectedModels, fromIndex, toIndex),
    }));
    setEvaluationByIndex((prev) => moveIndexedRecord(prev, fromIndex, toIndex, length));
    setNoteByIndex((prev) => moveIndexedRecord(prev, fromIndex, toIndex, length));
    setPromptOverrideByIndex((prev) => moveIndexedRecord(prev, fromIndex, toIndex, length));
  };

  const runSingleRow = async (index: number) => {
    const spec = llmState.selectedModels[index];
    const effectivePrompt = promptOverrideByIndex[index] ?? llmState.userPrompt;
    if (!spec || !effectivePrompt.trim()) return;
    setRunningIndexes((prev) => new Set(prev).add(index));
    try {
      for (let trial = 0; trial < llmState.sampleCount; trial += 1) {
        await runComparison({
          models: [spec],
          systemPrompt: llmState.systemPrompt,
          userPrompt: effectivePrompt,
          temperature: llmState.temperature,
          maxTokens: llmState.maxTokens,
          timeoutMs: llmState.timeoutMs,
        });
      }
    } finally {
      setRunningIndexes((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }
  };

  const handleRowPromptChange = (index: number, value: string) => {
    setPromptOverrideByIndex((prev) => ({ ...prev, [index]: value }));
  };

  const runSelectedRows = async () => {
    if (!llmState.userPrompt.trim()) return;
    await Promise.allSettled(llmState.selectedModels.map((_, index) => runSingleRow(index)));
  };

  const handleClearAll = () => {
    clearResults();
    setHistoryByResultKey({});
    seenResultTimestampRef.current = {};
    setEvaluationByIndex({});
    setNoteByIndex({});
  };

  const handleAutoAddTopModels = async () => {
    const rank = [
      'anthropic',
      'openai',
      'gemini',
      'deepseek',
      'grok',
      'openrouter',
      'qwen',
      'perplexity',
      'together',
      'kimi',
      'zhipu',
    ];

    const providersById = new Map(allProviders.map((p) => [p.id, p]));
    const candidateModels: { provider: (typeof llmState.selectedModels)[number]['provider']; model: string }[] = [];

    for (const providerId of rank) {
      const provider = providersById.get(providerId as any);
      if (!provider) continue;
      const hasKey = await hasProviderKey(provider.id);
      if (!hasKey) continue;
      const model = preferredModelForProvider(provider);
      if (!model) continue;
      candidateModels.push({ provider: provider.id, model });
    }

    if (candidateModels.length === 0) return;

    setLlmState((prev) => {
      const remainingSlots = Math.max(0, 10 - prev.selectedModels.length);
      if (remainingSlots === 0) return prev;
      const existing = new Set(prev.selectedModels.map((m) => `${m.provider}::${m.model}`));
      const additions = candidateModels
        .filter((candidate) => {
          const dedupeKey = `${candidate.provider}::${candidate.model}`;
          if (existing.has(dedupeKey)) return false;
          existing.add(dedupeKey);
          return true;
        })
        .slice(0, remainingSlots);
      if (additions.length === 0) return prev;
      return {
        ...prev,
        selectedModels: [...prev.selectedModels, ...additions],
      };
    });
  };

  useEffect(() => {
    if (llmState.selectedModels.length > 0) return;
    if (allProviders.length === 0) return;
    if (autoAddSignatureRef.current === providersSignature) return;
    autoAddSignatureRef.current = providersSignature;
    void handleAutoAddTopModels();
  }, [llmState.selectedModels.length, allProviders.length, providersSignature]);

  const selectedSpec = selectedDetailIndex !== null ? llmState.selectedModels[selectedDetailIndex] : undefined;
  const selectedResultKey =
    selectedSpec != null ? `${selectedSpec.provider}-${selectedSpec.model}` : undefined;
  const selectedResult = selectedResultKey ? results[selectedResultKey] : undefined;
  const selectedHistory = selectedResultKey ? historyByResultKey[selectedResultKey] ?? [] : [];

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <LlmArenaMatrixTable
        copy={copy}
        commonCopy={t.keysArena.common}
        selectedModels={llmState.selectedModels}
        providers={allProviders}
        results={results}
        isRunning={runningIndexes.size > 0}
        runningIndexes={runningIndexes}
        userPrompt={llmState.userPrompt}
        evaluationByIndex={evaluationByIndex}
        noteByIndex={noteByIndex}
        promptOverrideByIndex={promptOverrideByIndex}
        historyByResultKey={historyByResultKey}
        onClearAll={handleClearAll}
        onAddModel={addModel}
        onImportModels={importModels}
        onMoveModel={moveModel}
        onRunSelectedRows={() => void runSelectedRows()}
        onRunSingleRow={(index) => void runSingleRow(index)}
        onRemoveModel={removeModel}
        onUpdateModel={updateModel}
        onEvaluationChange={(index, level) => setEvaluationByIndex((prev) => ({ ...prev, [index]: level }))}
        onNoteChange={(index, note) => setNoteByIndex((prev) => ({ ...prev, [index]: note }))}
        onRowPromptChange={handleRowPromptChange}
        onOpenDetail={setSelectedDetailIndex}
      />

      <LlmArenaDetailSheet
        copy={copy}
        selectedIndex={selectedDetailIndex}
        selectedSpec={selectedSpec}
        selectedResult={selectedResult}
        selectedHistory={selectedHistory}
        onClose={() => setSelectedDetailIndex(null)}
      />
    </div>
  );
}
