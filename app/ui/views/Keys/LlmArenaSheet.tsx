'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useKeysContext } from './KeysContext';
import { useArenaChat } from './useArenaChat';
import { hasProviderKey } from '../../../../lib/keys/loadProviderKey';
import { useI18n } from '../../../../lib/i18n';
import { LlmArenaMatrixTable } from './LlmArenaMatrixTable';
import { LlmArenaDetailSheet } from './LlmArenaDetailSheet';
import { formatResultSummary, type EvaluationLevel, type RunHistoryEntry } from './LlmArenaTypes';
import { LlmArenaMethodPanel } from './LlmArenaMethodPanel';
import {
  LLM_ARENA_EVALUATION_CONFIG,
  buildLlmArenaResultRow,
  sanitizeLlmArenaNumber,
} from './LlmArenaEvaluation';

export function LlmArenaSheet() {
  const { t } = useI18n();
  const copy = t.keysArena.llm;
  const { llmState, setLlmState, validatedLlmProviders } = useKeysContext();
  const { runComparison, results, clearResults } = useArenaChat('pm.arena.llm.results');
  const allProviders = validatedLlmProviders;
  const seenResultTimestampRef = useRef<Record<string, number>>({});
  const [enabledByIndex, setEnabledByIndex] = useState<Record<number, boolean>>({});
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
    const enabledIndexes = llmState.selectedModels
      .map((_, index) => index)
      .filter((index) => enabledByIndex[index] !== false);
    await Promise.allSettled(enabledIndexes.map(runSingleRow));
  };

  const handleClearAll = () => {
    clearResults();
    setHistoryByResultKey({});
    seenResultTimestampRef.current = {};
    setEvaluationByIndex({});
    setNoteByIndex({});
  };

  const updateLlmNumber = (
    key: 'temperature' | 'maxTokens' | 'timeoutMs' | 'sampleCount',
    value: number,
  ) => {
    setLlmState((prev) => {
      if (key === 'temperature') {
        return { ...prev, temperature: sanitizeLlmArenaNumber(value, prev.temperature, 0, 2) };
      }
      if (key === 'maxTokens') {
        return {
          ...prev,
          maxTokens: sanitizeLlmArenaNumber(
            value,
            prev.maxTokens,
            LLM_ARENA_EVALUATION_CONFIG.minMaxTokens,
            LLM_ARENA_EVALUATION_CONFIG.maxMaxTokens,
          ),
        };
      }
      if (key === 'timeoutMs') {
        return {
          ...prev,
          timeoutMs: sanitizeLlmArenaNumber(
            value,
            prev.timeoutMs,
            LLM_ARENA_EVALUATION_CONFIG.minTimeoutMs,
            LLM_ARENA_EVALUATION_CONFIG.maxTimeoutMs,
          ),
        };
      }
      return {
        ...prev,
        sampleCount: Math.round(
          sanitizeLlmArenaNumber(
            value,
            prev.sampleCount,
            LLM_ARENA_EVALUATION_CONFIG.minSampleCount,
            LLM_ARENA_EVALUATION_CONFIG.maxSampleCount,
          ),
        ),
      };
    });
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

    const providersById = new Map(allProviders.map((p) => [p.id, p]));
    const candidateModels: { provider: (typeof llmState.selectedModels)[number]['provider']; model: string }[] = [];

    for (const providerId of rank) {
      const provider = providersById.get(providerId as any);
      if (!provider) continue;
      const hasKey = await hasProviderKey(provider.id);
      if (!hasKey) continue;
      const preferred = topModelByProvider[provider.id];
      const model =
        (preferred && provider.availableModels.includes(preferred) && preferred) ||
        provider.defaultModel ||
        provider.availableModels[0] ||
        '';
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
      <LlmArenaMethodPanel
        copy={copy}
        systemPrompt={llmState.systemPrompt}
        userPrompt={llmState.userPrompt}
        temperature={llmState.temperature}
        maxTokens={llmState.maxTokens}
        timeoutMs={llmState.timeoutMs}
        sampleCount={llmState.sampleCount}
        scoringProfile={llmState.scoringProfile}
        onSystemPromptChange={(systemPrompt) => setLlmState((prev) => ({ ...prev, systemPrompt }))}
        onUserPromptChange={(userPrompt) => setLlmState((prev) => ({ ...prev, userPrompt }))}
        onTemperatureChange={(value) => updateLlmNumber('temperature', value)}
        onMaxTokensChange={(value) => updateLlmNumber('maxTokens', value)}
        onTimeoutMsChange={(value) => updateLlmNumber('timeoutMs', value)}
        onSampleCountChange={(value) => updateLlmNumber('sampleCount', value)}
        onScoringProfileChange={(scoringProfile) => setLlmState((prev) => ({ ...prev, scoringProfile }))}
        onAutoAddTopModels={() => void handleAutoAddTopModels()}
      />
      <LlmArenaMatrixTable
        copy={copy}
        commonCopy={t.keysArena.common}
        selectedModels={llmState.selectedModels}
        providers={allProviders}
        results={results}
        isRunning={runningIndexes.size > 0}
        runningIndexes={runningIndexes}
        userPrompt={llmState.userPrompt}
        enabledByIndex={enabledByIndex}
        evaluationByIndex={evaluationByIndex}
        noteByIndex={noteByIndex}
        promptOverrideByIndex={promptOverrideByIndex}
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
