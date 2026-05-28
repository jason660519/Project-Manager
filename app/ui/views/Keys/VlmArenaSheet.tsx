'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useKeysContext } from './KeysContext';
import { listLlmProviders, type LlmProviderId } from '../../../../lib/keys/llmProviders';
import { useI18n } from '../../../../lib/i18n';
import { VlmArenaMethodPanel } from './VlmArenaMethodPanel';
import { VlmArenaMatrixTable } from './VlmArenaMatrixTable';
import { VlmArenaDetailSheet } from './VlmArenaDetailSheet';
import {
  buildImageToImagePrompt,
  clearVlmImageToImageRuns,
  coerceImageToImageSelections,
  getVlmImageToImageState,
  imageToImageProvidersFrom,
  patchVlmImageToImageRow,
  resumePersistedVlmImageTasks,
  runVlmImageRow,
  runVlmImageRows,
  subscribeVlmImageToImageState,
  syncVlmImageRowsToSelections,
  type VlmImageToImageOutputMode,
  type VlmImageToImageRow,
  type VlmImageToImageStyle,
} from './VlmImageToImageEvaluation';

const IMAGE_OUTPUT_MODEL_PRESETS: Array<{ provider: LlmProviderId; model: string }> = [
  { provider: 'gemini', model: 'gemini-3.1-flash-image-preview' },
  { provider: 'openai', model: 'gpt-image-1' },
  { provider: 'qwen', model: 'qwen-image-2.0-pro' },
];

export function VlmArenaSheet() {
  const { t } = useI18n();
  const copy = t.keysArena.vlm;
  const { vlmState, setVlmState } = useKeysContext();
  const allProviders = useMemo(() => imageToImageProvidersFrom(listLlmProviders()), []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedDetailIndex, setSelectedDetailIndex] = useState<number | null>(null);
  const [arenaState, setArenaState] = useState(getVlmImageToImageState);
  const rows = arenaState.rows;
  const historyByResultKey = arenaState.historyByResultKey;

  useEffect(() => subscribeVlmImageToImageState(setArenaState), []);

  useEffect(() => {
    setVlmState((prev) => {
      const coerced = coerceImageToImageSelections(prev.selectedModels, allProviders);
      const changed = coerced.length !== prev.selectedModels.length
        || coerced.some((spec, index) => (
          spec.provider !== prev.selectedModels[index]?.provider || spec.model !== prev.selectedModels[index]?.model
        ));
      return changed ? { ...prev, selectedModels: coerced } : prev;
    });
  }, [allProviders, setVlmState]);

  useEffect(() => {
    syncVlmImageRowsToSelections(vlmState.selectedModels);
  }, [vlmState.selectedModels]);

  useEffect(() => {
    resumePersistedVlmImageTasks(vlmState.imageDataUrl);
  }, [vlmState.imageDataUrl, rows]);

  const runSingleRow = (index: number) => {
    const row = rows[index];
    if (!row || !vlmState.imageDataUrl) return;
    void runVlmImageRow(row.id, vlmState.imageDataUrl);
  };

  const runSelectedRows = () => {
    if (!vlmState.imageDataUrl) return;
    const enabledRowIds = rows
      .filter((row) => row.shouldTest && row.runStatus !== 'running')
      .map((row) => row.id);
    void runVlmImageRows(enabledRowIds, vlmState.imageDataUrl);
  };

  const clearAll = () => {
    clearVlmImageToImageRuns();
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
    const validPresets = IMAGE_OUTPUT_MODEL_PRESETS.filter((preset) => {
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

  const patchRow = (index: number, patch: Partial<VlmImageToImageRow>) => {
    const row = rows[index];
    if (!row) return;
    const next = { ...patch };
    if (patch.style || patch.outputMode) {
      next.prompt = buildImageToImagePrompt(patch.style ?? row.style, patch.outputMode ?? row.outputMode);
    }
    patchVlmImageToImageRow(row.id, next);
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
    <div className="flex h-full min-h-0 flex-col gap-4">
      <VlmArenaMethodPanel
        copy={copy}
        imageDataUrl={vlmState.imageDataUrl}
        fileInputRef={fileInputRef}
        onFileChange={handleFileChange}
        onRemoveImage={removeImage}
      />

      <VlmArenaMatrixTable
        copy={copy}
        providers={allProviders}
        rows={rows}
        isRunning={rows.some((row) => row.runStatus === 'running')}
        imageDataUrl={vlmState.imageDataUrl}
        canRunAll={rows.some((row) => row.shouldTest)}
        historyByResultKey={historyByResultKey}
        onClearAll={clearAll}
        onAddModel={addModel}
        onAddTopModels={addTopModelsFromEnv}
        onRunSelectedRows={() => void runSelectedRows()}
        onRunSingleRow={(index) => void runSingleRow(index)}
        onRemoveModel={removeModel}
        onUpdateModel={updateModel}
        onToggleEnabled={(index, enabled) => patchRow(index, { shouldTest: enabled })}
        onStyleChange={(index, style: VlmImageToImageStyle) => patchRow(index, { style })}
        onOutputModeChange={(index, outputMode: VlmImageToImageOutputMode) => patchRow(index, { outputMode })}
        onPromptChange={(index, prompt) => patchRow(index, { prompt })}
        onOpenDetail={setSelectedDetailIndex}
      />

      <VlmArenaDetailSheet
        copy={copy}
        selectedDetailIndex={selectedDetailIndex}
        row={selectedDetailIndex !== null ? rows[selectedDetailIndex] : undefined}
        history={selectedDetailIndex !== null ? historyByResultKey[`${rows[selectedDetailIndex]?.provider}-${rows[selectedDetailIndex]?.model}`] ?? [] : []}
        onClose={() => setSelectedDetailIndex(null)}
      />
    </div>
  );
}
