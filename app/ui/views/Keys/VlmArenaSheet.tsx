'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useKeysContext } from './KeysContext';
import { useArenaChat, type ArenaResult } from './useArenaChat';
import { listLlmProviders, type LlmProviderId } from '../../../../lib/keys/llmProviders';
import { VlmArenaMethodPanel } from './VlmArenaMethodPanel';
import { VlmArenaMatrixTable } from './VlmArenaMatrixTable';
import { VlmArenaDetailSheet } from './VlmArenaDetailSheet';
import { VLM_SCENARIOS, type RowScore, type RunHistoryEntry, type ScenarioId } from './VlmArenaTypes';

const ENV_TOP_MODEL_PRESETS: Array<{ provider: LlmProviderId; model: string }> = [
  { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  { provider: 'openai', model: 'gpt-4o' },
  { provider: 'gemini', model: 'gemini-2.5-pro' },
  { provider: 'grok', model: 'grok-2-latest' },
  { provider: 'openrouter', model: 'openai/gpt-4o' },
  { provider: 'qwen', model: 'qwen-max' },
];

export function VlmArenaSheet() {
  const { vlmState, setVlmState } = useKeysContext();
  const { runComparison, results, clearResults, isRunning } = useArenaChat();
  const allProviders = listLlmProviders();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const seenResultTimestampRef = useRef<Record<string, number>>({});
  const [scenarioByIndex, setScenarioByIndex] = useState<Record<number, ScenarioId>>({});
  const [enabledByIndex, setEnabledByIndex] = useState<Record<number, boolean>>({});
  const [rowSystemPromptByIndex, setRowSystemPromptByIndex] = useState<Record<number, string>>({});
  const [rowUserPromptByIndex, setRowUserPromptByIndex] = useState<Record<number, string>>({});
  const [scoreByIndex, setScoreByIndex] = useState<Record<number, RowScore>>({});
  const [noteByIndex, setNoteByIndex] = useState<Record<number, string>>({});
  const [historyByResultKey, setHistoryByResultKey] = useState<Record<string, RunHistoryEntry[]>>({});
  const [selectedDetailIndex, setSelectedDetailIndex] = useState<number | null>(null);

  useEffect(() => {
    setScenarioByIndex((prev) => {
      const next = { ...prev };
      vlmState.selectedModels.forEach((_, index) => {
        if (!next[index]) next[index] = 'space_read';
      });
      Object.keys(next).forEach((key) => {
        const index = Number(key);
        if (Number.isFinite(index) && index >= vlmState.selectedModels.length) delete next[index];
      });
      return next;
    });
    setEnabledByIndex((prev) => {
      const next = { ...prev };
      vlmState.selectedModels.forEach((_, index) => {
        if (typeof next[index] !== 'boolean') next[index] = true;
      });
      Object.keys(next).forEach((key) => {
        const index = Number(key);
        if (Number.isFinite(index) && index >= vlmState.selectedModels.length) delete next[index];
      });
      return next;
    });
    setScoreByIndex((prev) => {
      const next = { ...prev };
      vlmState.selectedModels.forEach((_, index) => {
        if (!next[index]) next[index] = 'unrated';
      });
      Object.keys(next).forEach((key) => {
        const index = Number(key);
        if (Number.isFinite(index) && index >= vlmState.selectedModels.length) delete next[index];
      });
      return next;
    });
    setRowSystemPromptByIndex((prev) => {
      const next = { ...prev };
      vlmState.selectedModels.forEach((_, index) => {
        if (typeof next[index] !== 'string') next[index] = vlmState.systemPrompt;
      });
      Object.keys(next).forEach((key) => {
        const index = Number(key);
        if (Number.isFinite(index) && index >= vlmState.selectedModels.length) delete next[index];
      });
      return next;
    });
    setRowUserPromptByIndex((prev) => {
      const next = { ...prev };
      vlmState.selectedModels.forEach((_, index) => {
        if (typeof next[index] !== 'string') next[index] = vlmState.userPrompt;
      });
      Object.keys(next).forEach((key) => {
        const index = Number(key);
        if (Number.isFinite(index) && index >= vlmState.selectedModels.length) delete next[index];
      });
      return next;
    });
    setNoteByIndex((prev) => {
      const next = { ...prev };
      vlmState.selectedModels.forEach((_, index) => {
        if (typeof next[index] !== 'string') next[index] = '';
      });
      Object.keys(next).forEach((key) => {
        const index = Number(key);
        if (Number.isFinite(index) && index >= vlmState.selectedModels.length) delete next[index];
      });
      return next;
    });
  }, [vlmState.selectedModels, vlmState.systemPrompt, vlmState.userPrompt]);

  const scenarioMap = useMemo(
    () => Object.fromEntries(VLM_SCENARIOS.map((item) => [item.id, item])),
    []
  );

  const buildRowPrompt = (index: number) => {
    const scenario = scenarioMap[scenarioByIndex[index] ?? 'space_read'];
    return [
      (rowUserPromptByIndex[index] ?? '').trim(),
      `評測任務：${scenario?.label ?? '空間辨識'}`,
      scenario?.instruction ?? '',
      '輸出格式：先摘要，再列出重點，最後給風險或不確定項目。',
    ]
      .filter(Boolean)
      .join('\n\n');
  };

  useEffect(() => {
    const indexByResultKey: Record<string, number> = {};
    vlmState.selectedModels.forEach((spec, index) => {
      indexByResultKey[`${spec.provider}-${spec.model}`] = index;
    });
    const nextEntries: Array<{ key: string; entry: RunHistoryEntry }> = [];
    Object.entries(results).forEach(([resultKey, result]) => {
      const lastSeen = seenResultTimestampRef.current[resultKey] ?? 0;
      if (!result.timestamp || result.timestamp <= lastSeen) return;
      const rowIndex = indexByResultKey[resultKey];
      if (rowIndex === undefined) return;
      seenResultTimestampRef.current[resultKey] = result.timestamp;
      nextEntries.push({
        key: resultKey,
        entry: {
          timestamp: result.timestamp,
          scenario: scenarioByIndex[rowIndex] ?? 'space_read',
          prompt: buildRowPrompt(rowIndex),
          result,
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
  }, [results, scenarioByIndex, vlmState.selectedModels]);

  const runSingleRow = async (index: number) => {
    const spec = vlmState.selectedModels[index];
    if (!spec || !vlmState.imageDataUrl || !rowUserPromptByIndex[index]?.trim()) return;

    await runComparison({
      models: [spec],
      systemPrompt: rowSystemPromptByIndex[index] ?? '',
      userPrompt: buildRowPrompt(index),
      imageDataUrl: vlmState.imageDataUrl,
      imageDetail: vlmState.imageDetail,
    });
  };

  const runSelectedRows = async () => {
    if (!vlmState.imageDataUrl) return;
    const enabledIndexes = vlmState.selectedModels
      .map((_, index) => index)
      .filter((index) => enabledByIndex[index] !== false && !!rowUserPromptByIndex[index]?.trim());
    for (const index of enabledIndexes) {
      await runSingleRow(index);
    }
  };

  const clearAll = () => {
    clearResults();
    setHistoryByResultKey({});
    seenResultTimestampRef.current = {};
    setScoreByIndex({});
    setNoteByIndex({});
  };

  const addModel = () => {
    const defaultProvider = allProviders[0];
    setVlmState((prev) => ({
      ...prev,
      selectedModels: [
        ...prev.selectedModels,
        { provider: defaultProvider.id, model: defaultProvider.availableModels[0] || '' }
      ]
    }));
  };

  const addTopModelsFromEnv = () => {
    const providerMap = new Map(allProviders.map((provider) => [provider.id, provider]));
    const validPresets = ENV_TOP_MODEL_PRESETS.filter((preset) => {
      const provider = providerMap.get(preset.provider);
      if (!provider) return false;
      return provider.availableModels.includes(preset.model);
    });

    setVlmState((prev) => {
      const existing = new Set(prev.selectedModels.map((spec) => `${spec.provider}::${spec.model}`));
      const additions = validPresets
        .filter((preset) => !existing.has(`${preset.provider}::${preset.model}`))
        .map((preset) => ({ provider: preset.provider, model: preset.model }));
      return additions.length > 0
        ? { ...prev, selectedModels: [...prev.selectedModels, ...additions] }
        : prev;
    });
  };

  useEffect(() => {
    if (vlmState.selectedModels.length > 0) return;
    addTopModelsFromEnv();
    // Only bootstrap once when empty.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removeModel = (index: number) => {
    setVlmState((prev) => ({
      ...prev,
      selectedModels: prev.selectedModels.filter((_, i) => i !== index)
    }));
  };

  const updateModel = (index: number, providerId: string, modelStr: string) => {
    setVlmState((prev) => {
      const next = [...prev.selectedModels];
      next[index] = { provider: providerId as any, model: modelStr };
      return { ...prev, selectedModels: next };
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setVlmState((prev) => ({ ...prev, imageDataUrl: event.target?.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setVlmState((prev) => ({ ...prev, imageDataUrl: null }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex h-[calc(100vh-12rem)] flex-col gap-4">
      <VlmArenaMethodPanel
        imageDataUrl={vlmState.imageDataUrl}
        imageDetail={vlmState.imageDetail}
        fileInputRef={fileInputRef}
        onFileChange={handleFileChange}
        onRemoveImage={removeImage}
        onImageDetailChange={(next) => setVlmState((s) => ({ ...s, imageDetail: next }))}
      />

      <VlmArenaMatrixTable
        selectedModels={vlmState.selectedModels}
        providers={allProviders}
        results={results}
        isRunning={isRunning}
        imageDataUrl={vlmState.imageDataUrl}
        canRunAll={Object.values(rowUserPromptByIndex).some((prompt) => !!prompt?.trim())}
        enabledByIndex={enabledByIndex}
        scenarioByIndex={scenarioByIndex}
        rowSystemPromptByIndex={rowSystemPromptByIndex}
        rowUserPromptByIndex={rowUserPromptByIndex}
        scoreByIndex={scoreByIndex}
        noteByIndex={noteByIndex}
        historyByResultKey={historyByResultKey}
        onClearAll={clearAll}
        onAddModel={addModel}
        onAddTopModels={addTopModelsFromEnv}
        onRunSelectedRows={() => void runSelectedRows()}
        onRunSingleRow={(index) => void runSingleRow(index)}
        onRemoveModel={removeModel}
        onUpdateModel={updateModel}
        onToggleEnabled={(index, enabled) => setEnabledByIndex((prev) => ({ ...prev, [index]: enabled }))}
        onScenarioChange={(index, scenario) => setScenarioByIndex((prev) => ({ ...prev, [index]: scenario }))}
        onRowSystemPromptChange={(index, prompt) => setRowSystemPromptByIndex((prev) => ({ ...prev, [index]: prompt }))}
        onRowUserPromptChange={(index, prompt) => setRowUserPromptByIndex((prev) => ({ ...prev, [index]: prompt }))}
        onScoreChange={(index, score) => setScoreByIndex((prev) => ({ ...prev, [index]: score }))}
        onNoteChange={(index, note) => setNoteByIndex((prev) => ({ ...prev, [index]: note }))}
        onOpenDetail={setSelectedDetailIndex}
      />

      <VlmArenaDetailSheet
        selectedDetailIndex={selectedDetailIndex}
        selectedModel={selectedDetailIndex !== null ? vlmState.selectedModels[selectedDetailIndex] : undefined}
        result={selectedDetailIndex !== null ? results[`${vlmState.selectedModels[selectedDetailIndex]?.provider}-${vlmState.selectedModels[selectedDetailIndex]?.model}`] : undefined}
        history={selectedDetailIndex !== null ? historyByResultKey[`${vlmState.selectedModels[selectedDetailIndex]?.provider}-${vlmState.selectedModels[selectedDetailIndex]?.model}`] ?? [] : []}
        scenarioByIndex={scenarioByIndex}
        scenarioMap={scenarioMap}
        buildRowPrompt={buildRowPrompt}
        onClose={() => setSelectedDetailIndex(null)}
      />
    </div>
  );
}
