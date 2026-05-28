'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useKeysContext } from './KeysContext';
import { listLlmProviders, type LlmProviderId } from '../../../../lib/keys/llmProviders';
import { useI18n } from '../../../../lib/i18n';
import { VlmArenaMethodPanel } from './VlmArenaMethodPanel';
import { VlmArenaMatrixTable } from './VlmArenaMatrixTable';
import { VlmArenaDetailSheet } from './VlmArenaDetailSheet';
import type { RunHistoryEntry } from './VlmArenaTypes';
import {
  buildImageToImagePrompt,
  coerceImageToImageSelections,
  imageToImageProvidersFrom,
  runImageOutputs,
  syncRowsWithSelectedModels,
  testImageToImageModel,
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
  const [historyByResultKey, setHistoryByResultKey] = useState<Record<string, RunHistoryEntry[]>>({});
  const [selectedDetailIndex, setSelectedDetailIndex] = useState<number | null>(null);
  const [rows, setRows] = useState<VlmImageToImageRow[]>([]);

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
    setRows((prev) => syncRowsWithSelectedModels(prev, vlmState.selectedModels));
  }, [vlmState.selectedModels]);

  const runSingleRow = async (index: number) => {
    const row = rows[index];
    if (!row || !vlmState.imageDataUrl) return;
    const startedAtMs = Date.now();
    setRows((prev) => prev.map((item, itemIndex) => itemIndex === index
      ? {
          ...item,
          runStatus: 'running',
          message: '模型評估中...',
          resultText: '',
          resultImageUrl: '',
          resultImage2dUrl: '',
          resultImage3dUrl: '',
          runStartedAtMs: startedAtMs,
          e2eMs: null,
          httpStatus: null,
        }
      : item));
    const startMs = performance.now();
    try {
      const resultPatch = await runImageOutputs(row, vlmState.imageDataUrl, testImageToImageModel);
      const next = {
        ...resultPatch,
        runStartedAtMs: null,
        e2eMs: performance.now() - startMs,
        lastRunAt: new Date().toISOString(),
      };
      setRows((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, ...next } : item));
      appendHistory(row, next);
    } catch (error) {
      const next = {
        runStatus: 'failed' as const,
        message: error instanceof Error ? error.message : '測試失敗。',
        runStartedAtMs: null,
        e2eMs: performance.now() - startMs,
        httpStatus: null,
        lastRunAt: new Date().toISOString(),
      };
      setRows((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, ...next } : item));
      appendHistory(row, next);
    }
  };

  const runSelectedRows = async () => {
    if (!vlmState.imageDataUrl) return;
    const enabledIndexes = rows
      .map((row, index) => (row.shouldTest && row.runStatus !== 'running' ? index : -1))
      .filter((index) => index >= 0);
    await Promise.allSettled(enabledIndexes.map(runSingleRow));
  };

  const appendHistory = (row: VlmImageToImageRow, patch: Partial<VlmImageToImageRow>) => {
    const result = { ...row, ...patch };
    const key = `${row.provider}-${row.model}`;
    setHistoryByResultKey((prev) => {
      const history = prev[key] ? [...prev[key]] : [];
      history.unshift({
        timestamp: Date.now(),
        scenario: 'render_2d_3d',
        prompt: row.prompt,
        result: {
          provider: row.provider,
          model: row.model,
          content: result.resultText,
          error: result.runStatus === 'failed' ? result.message : undefined,
          latencyMs: Math.round(result.e2eMs ?? 0),
          timestamp: Date.now(),
        },
        resultImage2dUrl: result.resultImage2dUrl,
        resultImage3dUrl: result.resultImage3dUrl,
        message: result.message,
        httpStatus: result.httpStatus,
      });
      return { ...prev, [key]: history.slice(0, 10) };
    });
  };

  const clearAll = () => {
    setRows((prev) => prev.map((row) => ({
      ...row,
      runStatus: 'idle',
      resultText: '',
      resultImageUrl: '',
      resultImage2dUrl: '',
      resultImage3dUrl: '',
      message: '',
      runStartedAtMs: null,
      e2eMs: null,
      httpStatus: null,
      lastRunAt: null,
    })));
    setHistoryByResultKey({});
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
    setRows((prev) => prev.map((row, rowIndex) => {
      if (rowIndex !== index) return row;
      const next = { ...row, ...patch };
      if (patch.style || patch.outputMode) {
        next.prompt = buildImageToImagePrompt(next.style, next.outputMode);
      }
      return next;
    }));
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
