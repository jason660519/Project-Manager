'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useKeysContext } from './KeysContext';
import { useArenaChat } from './useArenaChat';
import { useI18n } from '../../../../lib/i18n';
import { LlmArenaMethodPanel } from './LlmArenaMethodPanel';
import { LlmArenaMatrixTable } from './LlmArenaMatrixTable';
import { LlmArenaDetailSheet } from './LlmArenaDetailSheet';
import { formatResultSummary, type EvaluationLevel, type RunHistoryEntry } from './LlmArenaTypes';

export function LlmArenaSheet() {
  const { t } = useI18n();
  const copy = t.keysArena.llm;
  const { llmState, setLlmState, validatedLlmProviders } = useKeysContext();
  const { runComparison, results, clearResults, isRunning } = useArenaChat();
  const allProviders = validatedLlmProviders;
  const seenResultTimestampRef = useRef<Record<string, number>>({});
  const [enabledByIndex, setEnabledByIndex] = useState<Record<number, boolean>>({});
  const [evaluationByIndex, setEvaluationByIndex] = useState<Record<number, EvaluationLevel>>({});
  const [noteByIndex, setNoteByIndex] = useState<Record<number, string>>({});
  const [historyByResultKey, setHistoryByResultKey] = useState<Record<string, RunHistoryEntry[]>>({});
  const [selectedDetailIndex, setSelectedDetailIndex] = useState<number | null>(null);
  const [autoAddHint, setAutoAddHint] = useState<string>('');
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
      const fallbackModel = allProviders[0]?.availableModels[0] ?? '';

      let changed = false;
      const nextSelected = prev.selectedModels.map((spec) => {
        const allowedModels = allowedByProvider.get(spec.provider);
        if (allowedModels && allowedModels.includes(spec.model)) return spec;
        changed = true;
        if (allowedModels && allowedModels.length > 0) {
          return { provider: spec.provider, model: allowedModels[0] };
        }
        return { provider: fallbackProvider, model: fallbackModel };
      });

      if (!changed) return prev;
      return { ...prev, selectedModels: nextSelected.filter((spec) => Boolean(spec.model)) };
    });
  }, [providersSignature, allProviders.length, setLlmState]);

  useEffect(() => {
    setEnabledByIndex((prev) => {
      const next = { ...prev };
      llmState.selectedModels.forEach((_, index) => {
        if (typeof next[index] !== 'boolean') next[index] = true;
      });
      Object.keys(next).forEach((key) => {
        const index = Number(key);
        if (Number.isFinite(index) && index >= llmState.selectedModels.length) delete next[index];
      });
      return next;
    });

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
      seenResultTimestampRef.current[resultKey] = result.timestamp;
      nextEntries.push({
        key: resultKey,
        entry: {
          timestamp: result.timestamp,
          summary: formatResultSummary(result, copy),
          latencyMs: result.latencyMs,
          inputTokens: result.inputTokens ?? 0,
          outputTokens: result.outputTokens ?? 0,
          error: result.error,
        },
      });
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
  }, [results, llmState.selectedModels, copy]);

  const addModel = () => {
    const defaultProvider = allProviders[0];
    if (!defaultProvider) return;
    setLlmState((prev) => ({
      ...prev,
      selectedModels: [
        ...prev.selectedModels,
        { provider: defaultProvider.id, model: defaultProvider.availableModels[0] || '' }
      ]
    }));
  };

  const removeModel = (index: number) => {
    setLlmState((prev) => ({
      ...prev,
      selectedModels: prev.selectedModels.filter((_, i) => i !== index)
    }));
  };

  const updateModel = (index: number, providerId: string, modelStr: string) => {
    setLlmState((prev) => {
      const next = [...prev.selectedModels];
      next[index] = { provider: providerId as any, model: modelStr };
      return { ...prev, selectedModels: next };
    });
  };

  const runSingleRow = async (index: number) => {
    const spec = llmState.selectedModels[index];
    if (!spec || !llmState.userPrompt.trim()) return;
    await runComparison({
      models: [spec],
      systemPrompt: llmState.systemPrompt,
      userPrompt: llmState.userPrompt,
    });
  };

  const runSelectedRows = async () => {
    if (!llmState.userPrompt.trim()) return;
    const enabledIndexes = llmState.selectedModels
      .map((_, index) => index)
      .filter((index) => enabledByIndex[index] !== false);
    for (const index of enabledIndexes) {
      await runSingleRow(index);
    }
  };

  const handleClearAll = () => {
    clearResults();
    setHistoryByResultKey({});
    seenResultTimestampRef.current = {};
    setEvaluationByIndex({});
    setNoteByIndex({});
  };

  const handleAutoAddTopModels = async () => {
    const topModelByProvider: Partial<Record<string, string>> = {
      anthropic: 'claude-opus-4-1',
      openai: 'o1',
      gemini: 'gemini-2.5-pro',
      deepseek: 'deepseek-reasoner',
      grok: 'grok-2-latest',
      openrouter: 'anthropic/claude-3.5-sonnet',
      perplexity: 'sonar-pro',
      together: 'Qwen/Qwen2.5-72B-Instruct-Turbo',
      qwen: 'qwen-max',
      kimi: 'kimi-k2.6',
      zhipu: 'glm-4-plus',
    };

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

    const existing = new Set(llmState.selectedModels.map((m) => `${m.provider}::${m.model}`));
    const providersById = new Map(allProviders.map((p) => [p.id, p]));
    const nextToAdd: { provider: (typeof llmState.selectedModels)[number]['provider']; model: string }[] = [];

    for (const providerId of rank) {
      const provider = providersById.get(providerId as any);
      if (!provider) continue;
      const preferred = topModelByProvider[provider.id];
      const model =
        (preferred && provider.availableModels.includes(preferred) && preferred) ||
        provider.defaultModel ||
        provider.availableModels[0] ||
        '';
      if (!model) continue;
      const dedupeKey = `${provider.id}::${model}`;
      if (existing.has(dedupeKey)) continue;
      existing.add(dedupeKey);
      nextToAdd.push({ provider: provider.id, model });
      if (nextToAdd.length >= 8) break;
    }

    if (nextToAdd.length === 0) {
      setAutoAddHint(copy.autoAddNoModels);
      return;
    }

    setLlmState((prev) => ({
      ...prev,
      selectedModels: [...prev.selectedModels, ...nextToAdd],
    }));
    setAutoAddHint(copy.autoAddAdded.replace('{count}', String(nextToAdd.length)));
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
      <LlmArenaMethodPanel
        copy={copy}
        systemPrompt={llmState.systemPrompt}
        userPrompt={llmState.userPrompt}
        onSystemPromptChange={(next) => setLlmState((s) => ({ ...s, systemPrompt: next }))}
        onUserPromptChange={(next) => setLlmState((s) => ({ ...s, userPrompt: next }))}
        onAutoAddTopModels={() => void handleAutoAddTopModels()}
        autoAddHint={autoAddHint}
      />

      <LlmArenaMatrixTable
        copy={copy}
        commonCopy={t.keysArena.common}
        selectedModels={llmState.selectedModels}
        providers={allProviders}
        results={results}
        isRunning={isRunning}
        userPrompt={llmState.userPrompt}
        enabledByIndex={enabledByIndex}
        evaluationByIndex={evaluationByIndex}
        noteByIndex={noteByIndex}
        historyByResultKey={historyByResultKey}
        onClearAll={handleClearAll}
        onAddModel={addModel}
        onRunSelectedRows={() => void runSelectedRows()}
        onRunSingleRow={(index) => void runSingleRow(index)}
        onRemoveModel={removeModel}
        onUpdateModel={updateModel}
        onToggleEnabled={(index, enabled) => setEnabledByIndex((prev) => ({ ...prev, [index]: enabled }))}
        onEvaluationChange={(index, level) => setEvaluationByIndex((prev) => ({ ...prev, [index]: level }))}
        onNoteChange={(index, note) => setNoteByIndex((prev) => ({ ...prev, [index]: note }))}
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
