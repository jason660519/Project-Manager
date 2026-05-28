'use client';

import type { LlmProviderId } from '../../../../lib/keys/llmProviders';
import { loadProviderKey } from '../../../../lib/keys/loadProviderKey';
import type { ProviderLike, RunHistoryEntry } from './VlmArenaTypes';

export type VlmImageToImageStyle = 'modern' | 'nordic' | 'japanese' | 'luxury' | 'rental' | 'minimal';
export type VlmImageToImageOutputMode = '2d' | '3d' | 'both';
export type VlmImageOutputKind = '2d' | '3d';
export type VlmImageRunStatus = 'idle' | 'running' | 'done' | 'failed';

export interface VlmImageToImageRow {
  id: string;
  no: number;
  shouldTest: boolean;
  provider: LlmProviderId;
  model: string;
  style: VlmImageToImageStyle;
  outputMode: VlmImageToImageOutputMode;
  prompt: string;
  runStatus: VlmImageRunStatus;
  resultText: string;
  resultImageUrl: string;
  resultImage2dUrl: string;
  resultImage3dUrl: string;
  message: string;
  runStartedAtMs: number | null;
  e2eMs: number | null;
  httpStatus: number | null;
  lastRunAt: string | null;
}

export interface VlmImageToImageTestResult {
  success: boolean;
  message?: string;
  output?: string;
  outputImageUrl?: string;
  httpStatus?: number;
}

export type VlmImageToImageTestFn = (
  provider: LlmProviderId,
  modelId: string,
  prompt: string,
  imageDataUrl: string,
) => Promise<VlmImageToImageTestResult>;

export interface VlmImageToImageState {
  version: 1;
  rows: VlmImageToImageRow[];
  historyByResultKey: Record<string, RunHistoryEntry[]>;
}

export type VlmImageToImageStateListener = (state: VlmImageToImageState) => void;

export const VLM_IMAGE_TO_IMAGE_STYLE_OPTIONS: Array<{
  id: VlmImageToImageStyle;
  label: string;
  prompt: string;
}> = [
  { id: 'modern', label: '現代清爽', prompt: '現代清爽住宅風格，明亮中性色、俐落線條、低彩度家具、清楚的空間分區。' },
  { id: 'nordic', label: '北歐溫潤', prompt: '北歐溫潤風格，淺木色、白牆、柔和採光、簡潔家具配置，呈現舒適可居住感。' },
  { id: 'japanese', label: '日式無印', prompt: '日式無印風格，木質地板、收納感、低飽和配色、簡潔生活動線。' },
  { id: 'luxury', label: '高質感豪宅', prompt: '高質感住宅提案，石材、金屬細節、深淺對比、精緻燈光與高端室內設計感。' },
  { id: 'rental', label: '租屋廣告', prompt: '租屋廣告友善風格，空間清楚、色彩容易辨識、家具配置實用，讓承租人快速理解格局。' },
  { id: 'minimal', label: '簡約彩繪', prompt: '簡約彩繪格局圖風格，使用清楚色塊標示每個空間，保留牆線、門窗與房間名稱。' },
];

export const VLM_IMAGE_TO_IMAGE_OUTPUT_OPTIONS: Array<{
  id: VlmImageToImageOutputMode;
  label: string;
  prompt: string;
}> = [
  { id: '2d', label: '2D 彩繪平面圖', prompt: '輸出 2D 彩繪平面圖，正俯視（top-down / 90 度垂直俯視）視角，保留原始牆線比例，清楚標註客廳、臥室、廚房、衛浴、陽台與走道。' },
  { id: '3d', label: '3D 立體彩繪圖', prompt: '輸出 3D 立體彩繪圖，採用 45 度斜角俯瞰視角（isometric / 三點透視，從房屋右前上方俯瞰），清楚呈現牆面厚度、家具高度、地板與屋頂層次，營造可看見家具立面與空間深度的立體感；不得改變原始格局邊界與房間配置。' },
  { id: 'both', label: '2D + 3D 同時評估', prompt: '同時產出兩張圖：(1) 2D 彩繪平面圖，正俯視 90 度垂直俯視視角；(2) 3D 立體彩繪圖，45 度斜角俯瞰視角（isometric / 從右前上方俯瞰），需展現家具立面、牆面厚度與空間深度立體感。若模型只能回一張圖，優先產出 3D 立體彩繪圖（45 度斜角），並用文字說明 2D 平面配置。' },
];

export const VLM_IMAGE_TO_IMAGE_CAPABLE_MODELS: Array<{
  provider: LlmProviderId;
  model: string;
  label: string;
}> = [
  { provider: 'gemini', model: 'gemini-3.1-flash-image-preview', label: 'Nano Banana 2 (3.1 Flash Image)' },
  { provider: 'gemini', model: 'gemini-3-pro-image-preview', label: 'Banana Pro (3 Pro Image)' },
  { provider: 'gemini', model: 'gemini-2.5-flash-image', label: 'Banana (2.5 Flash Image)' },
  { provider: 'openai', model: 'gpt-image-1.5', label: 'GPT Image 1.5' },
  { provider: 'openai', model: 'gpt-image-2', label: 'GPT Images 2.0' },
  { provider: 'openai', model: 'gpt-image-1', label: 'GPT Image 1' },
  { provider: 'qwen', model: 'qwen-image-2.0-pro', label: 'Qwen Image 2.0 Pro' },
];

const IMAGE_MIME_PATTERN = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/i;
const VLM_IMAGE_TO_IMAGE_STORAGE_KEY = 'projectManager:keys-vlm-image-to-image:v1';
const MAX_HISTORY_PER_MODEL = 10;

let currentState: VlmImageToImageState | null = null;
const listeners = new Set<VlmImageToImageStateListener>();
const activeImageTasks = new Map<string, Promise<void>>();

function providerLabel(providers: readonly ProviderLike[], providerId: LlmProviderId): string {
  return providers.find((provider) => provider.id === providerId)?.label ?? providerId;
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

export function isImageToImageCapableModel(provider: string, model: string): boolean {
  const lower = model.toLowerCase();
  if (provider === 'gemini') return lower.includes('image');
  if (provider === 'openai') return lower.startsWith('gpt-image') || lower === 'chatgpt-image-latest';
  if (provider === 'qwen') return lower.startsWith('qwen-image');
  return false;
}

export function imageToImageModelDisplayName(provider: string, model: string): string {
  return VLM_IMAGE_TO_IMAGE_CAPABLE_MODELS.find((item) => item.provider === provider && item.model === model)?.label ?? model;
}

export function imageToImageProvidersFrom(providers: readonly ProviderLike[]): ProviderLike[] {
  const activeProviderIds = new Set(providers.map((provider) => provider.id));
  const providerIds = unique([
    ...providers.map((provider) => provider.id),
    ...VLM_IMAGE_TO_IMAGE_CAPABLE_MODELS
      .filter((item) => item.provider === 'gemini' || activeProviderIds.has(item.provider))
      .map((item) => item.provider),
  ]);

  return providerIds
    .map((providerId) => {
      const source = providers.find((provider) => provider.id === providerId);
      const curated = VLM_IMAGE_TO_IMAGE_CAPABLE_MODELS
        .filter((item) => item.provider === providerId)
        .map((item) => item.model);
      const dynamic = source?.availableModels.filter((model) => isImageToImageCapableModel(providerId, model)) ?? [];
      const availableModels = unique([...curated, ...dynamic]);
      if (availableModels.length === 0) return null;
      return {
        id: providerId,
        label: source?.label ?? providerLabel(providers, providerId),
        availableModels,
      };
    })
    .filter((provider): provider is ProviderLike => provider !== null);
}

export function coerceImageToImageSelections(
  selectedModels: Array<{ provider: LlmProviderId; model: string }>,
  providers: readonly ProviderLike[],
): Array<{ provider: LlmProviderId; model: string }> {
  const fallbackProvider = providers.find((provider) => provider.id === 'gemini') ?? providers[0];
  const fallback = fallbackProvider
    ? { provider: fallbackProvider.id, model: fallbackProvider.availableModels[0] ?? '' }
    : null;
  return selectedModels
    .map((spec) => {
      const provider = providers.find((item) => item.id === spec.provider);
      if (provider?.availableModels.includes(spec.model)) return spec;
      if (provider?.availableModels[0]) return { provider: provider.id, model: provider.availableModels[0] };
      return fallback;
    })
    .filter((spec): spec is { provider: LlmProviderId; model: string } => Boolean(spec?.model));
}

export function buildImageToImagePrompt(
  style: VlmImageToImageStyle,
  outputMode: VlmImageToImageOutputMode,
): string {
  const styleText = VLM_IMAGE_TO_IMAGE_STYLE_OPTIONS.find((item) => item.id === style)?.prompt
    ?? VLM_IMAGE_TO_IMAGE_STYLE_OPTIONS[0].prompt;
  const outputText = VLM_IMAGE_TO_IMAGE_OUTPUT_OPTIONS.find((item) => item.id === outputMode)?.prompt
    ?? VLM_IMAGE_TO_IMAGE_OUTPUT_OPTIONS[0].prompt;
  return [
    '你是房地產格局圖轉換與室內設計視覺化助理。',
    '請根據使用者上傳的普通格局圖、掃描格局圖或手繪格局圖，理解牆線、門窗、房間用途與主要動線，再生成可供房產展示或室內設計討論的參考圖。',
    `風格要求：${styleText}`,
    `輸出要求：${outputText}`,
    '硬性限制：不要憑空新增不存在的房間；若原圖資訊不足，請明確列出不確定處；保留入口、濕區、主要隔間與大致比例；輸出是參考圖，不是施工圖。',
  ].join('\n\n');
}

export function requestedImageModes(outputMode: VlmImageToImageOutputMode): VlmImageOutputKind[] {
  if (outputMode === '2d') return ['2d'];
  if (outputMode === '3d') return ['3d'];
  return ['2d', '3d'];
}

export function promptForImageMode(row: Pick<VlmImageToImageRow, 'prompt' | 'style' | 'outputMode'>, mode: VlmImageOutputKind): string {
  const modeLabel = mode === '2d' ? '2D 彩繪平面圖（正俯視）' : '3D 鳥瞰彩繪圖（45 度斜角俯瞰）';
  const basePrompt = row.prompt.trim() || buildImageToImagePrompt(row.style, row.outputMode);
  return [
    basePrompt,
    `本次請只產生：${modeLabel}。`,
    buildImageToImagePrompt(row.style, mode),
  ].join('\n\n');
}

export function createImageToImageRow(no: number, provider: LlmProviderId, model: string): VlmImageToImageRow {
  return {
    id: `vlm-image-${no}-${provider}-${model}`.replace(/[^a-z0-9_-]+/gi, '-'),
    no,
    shouldTest: true,
    provider,
    model,
    style: 'modern',
    outputMode: 'both',
    prompt: buildImageToImagePrompt('modern', 'both'),
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
  };
}

function emptyVlmImageToImageState(): VlmImageToImageState {
  return { version: 1, rows: [], historyByResultKey: {} };
}

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function cloneState(state: VlmImageToImageState): VlmImageToImageState {
  return {
    version: 1,
    rows: state.rows.map((row) => ({ ...row })),
    historyByResultKey: Object.fromEntries(
      Object.entries(state.historyByResultKey).map(([key, history]) => [key, history.map((entry) => ({ ...entry }))]),
    ),
  };
}

function sanitizeRunStatus(value: unknown): VlmImageRunStatus {
  return value === 'running' || value === 'done' || value === 'failed' ? value : 'idle';
}

function isVlmImageStyle(value: unknown): value is VlmImageToImageStyle {
  return VLM_IMAGE_TO_IMAGE_STYLE_OPTIONS.some((option) => option.id === value);
}

function isVlmImageOutputMode(value: unknown): value is VlmImageToImageOutputMode {
  return VLM_IMAGE_TO_IMAGE_OUTPUT_OPTIONS.some((option) => option.id === value);
}

function sanitizeRow(value: unknown, index: number): VlmImageToImageRow | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Partial<VlmImageToImageRow>;
  if (!source.provider || !source.model) return null;
  const fallback = createImageToImageRow(index + 1, source.provider, source.model);
  const style = isVlmImageStyle(source.style) ? source.style : fallback.style;
  const outputMode = isVlmImageOutputMode(source.outputMode) ? source.outputMode : fallback.outputMode;
  return {
    ...fallback,
    ...source,
    id: typeof source.id === 'string' && source.id.trim().length > 0 ? source.id : fallback.id,
    no: typeof source.no === 'number' ? source.no : index + 1,
    shouldTest: source.shouldTest !== false,
    style,
    outputMode,
    prompt: typeof source.prompt === 'string' && source.prompt.trim().length > 0
      ? source.prompt
      : buildImageToImagePrompt(style, outputMode),
    runStatus: sanitizeRunStatus(source.runStatus),
    resultText: typeof source.resultText === 'string' ? source.resultText : '',
    resultImageUrl: typeof source.resultImageUrl === 'string' ? source.resultImageUrl : '',
    resultImage2dUrl: typeof source.resultImage2dUrl === 'string' ? source.resultImage2dUrl : '',
    resultImage3dUrl: typeof source.resultImage3dUrl === 'string' ? source.resultImage3dUrl : '',
    message: typeof source.message === 'string' ? source.message : '',
    runStartedAtMs: typeof source.runStartedAtMs === 'number' ? source.runStartedAtMs : null,
    e2eMs: typeof source.e2eMs === 'number' ? source.e2eMs : null,
    httpStatus: typeof source.httpStatus === 'number' ? source.httpStatus : null,
    lastRunAt: typeof source.lastRunAt === 'string' ? source.lastRunAt : null,
  };
}

function sanitizeHistory(value: unknown): Record<string, RunHistoryEntry[]> {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, history]) => Array.isArray(history))
      .map(([key, history]) => [key, (history as RunHistoryEntry[]).slice(0, MAX_HISTORY_PER_MODEL)]),
  );
}

function loadStoredVlmImageToImageState(): VlmImageToImageState {
  if (!canUseLocalStorage()) return emptyVlmImageToImageState();
  try {
    const raw = window.localStorage.getItem(VLM_IMAGE_TO_IMAGE_STORAGE_KEY);
    if (!raw) return emptyVlmImageToImageState();
    const parsed = JSON.parse(raw) as Partial<VlmImageToImageState>;
    return {
      version: 1,
      rows: Array.isArray(parsed.rows)
        ? parsed.rows.map((item, index) => sanitizeRow(item, index)).filter((row): row is VlmImageToImageRow => row !== null)
        : [],
      historyByResultKey: sanitizeHistory(parsed.historyByResultKey),
    };
  } catch {
    return emptyVlmImageToImageState();
  }
}

function persistVlmImageToImageState(state: VlmImageToImageState): void {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.setItem(VLM_IMAGE_TO_IMAGE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Keep the in-memory store usable if localStorage is full or disabled.
  }
}

export function getVlmImageToImageState(): VlmImageToImageState {
  if (!currentState) currentState = loadStoredVlmImageToImageState();
  return cloneState(currentState);
}

function commitVlmImageToImageState(nextState: VlmImageToImageState): VlmImageToImageState {
  currentState = cloneState(nextState);
  persistVlmImageToImageState(currentState);
  const snapshot = cloneState(currentState);
  listeners.forEach((listener) => listener(snapshot));
  return snapshot;
}

function updateVlmImageToImageState(updater: (state: VlmImageToImageState) => VlmImageToImageState): VlmImageToImageState {
  return commitVlmImageToImageState(updater(getVlmImageToImageState()));
}

export function subscribeVlmImageToImageState(listener: VlmImageToImageStateListener): () => void {
  listeners.add(listener);
  listener(getVlmImageToImageState());
  return () => {
    listeners.delete(listener);
  };
}

export function patchVlmImageToImageRow(rowId: string, patch: Partial<VlmImageToImageRow>): void {
  updateVlmImageToImageState((state) => ({
    ...state,
    rows: state.rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
  }));
}

function appendVlmImageToImageHistory(row: VlmImageToImageRow, patch: Partial<VlmImageToImageRow>): void {
  const result = { ...row, ...patch };
  const key = `${row.provider}-${row.model}`;
  updateVlmImageToImageState((state) => {
    const history = state.historyByResultKey[key] ? [...state.historyByResultKey[key]] : [];
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
    return {
      ...state,
      historyByResultKey: { ...state.historyByResultKey, [key]: history.slice(0, MAX_HISTORY_PER_MODEL) },
    };
  });
}

export function clearVlmImageToImageRuns(): void {
  updateVlmImageToImageState((state) => ({
    ...state,
    rows: state.rows.map((row) => ({
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
    })),
    historyByResultKey: {},
  }));
}

export function resetVlmImageToImageStoreForTests(state: VlmImageToImageState = emptyVlmImageToImageState()): void {
  currentState = cloneState(state);
  activeImageTasks.clear();
  if (canUseLocalStorage()) {
    try {
      window.localStorage.removeItem(VLM_IMAGE_TO_IMAGE_STORAGE_KEY);
      window.localStorage.setItem(VLM_IMAGE_TO_IMAGE_STORAGE_KEY, JSON.stringify(currentState));
    } catch {
      // Test-only reset should not fail when localStorage is mocked read-only.
    }
  }
  const snapshot = cloneState(currentState);
  listeners.forEach((listener) => listener(snapshot));
}

export function syncRowsWithSelectedModels(
  rows: VlmImageToImageRow[],
  selectedModels: Array<{ provider: LlmProviderId; model: string }>,
): VlmImageToImageRow[] {
  const usedRowIds = new Set<string>();
  return selectedModels.map((spec, index) => {
    const exact = rows.find((row) => row.provider === spec.provider && row.model === spec.model && !usedRowIds.has(row.id));
    const indexed = rows[index];
    const existing = exact ?? (indexed && indexed.runStatus === 'idle' && !usedRowIds.has(indexed.id) ? indexed : undefined);
    const style = existing?.style ?? 'modern';
    const outputMode = existing?.outputMode ?? 'both';
    const base = createImageToImageRow(index + 1, spec.provider, spec.model);
    const id = exact?.id ?? base.id;
    usedRowIds.add(id);
    const next = {
      ...base,
      ...existing,
      id,
      no: index + 1,
      provider: spec.provider,
      model: spec.model,
      style,
      outputMode,
      prompt: existing?.prompt ?? buildImageToImagePrompt(style, outputMode),
      runStatus: existing?.runStatus ?? 'idle',
      runStartedAtMs: existing?.runStartedAtMs ?? null,
    };
    return next;
  });
}

export function syncVlmImageRowsToSelections(selectedModels: Array<{ provider: LlmProviderId; model: string }>): void {
  updateVlmImageToImageState((state) => ({
    ...state,
    rows: syncRowsWithSelectedModels(state.rows, selectedModels),
  }));
}

export async function runImageOutputs(
  row: VlmImageToImageRow,
  imageDataUrl: string,
  testModel: VlmImageToImageTestFn,
): Promise<Partial<VlmImageToImageRow>> {
  const modes = requestedImageModes(row.outputMode);
  const results = await Promise.all(modes.map(async (mode) => ({
    mode,
    result: await testModel(row.provider, row.model, promptForImageMode(row, mode), imageDataUrl),
  })));

  const result2d = results.find((item) => item.mode === '2d')?.result;
  const result3d = results.find((item) => item.mode === '3d')?.result;
  const resultImage2dUrl = result2d?.outputImageUrl ?? '';
  const resultImage3dUrl = result3d?.outputImageUrl ?? '';
  const resultText = results
    .map(({ mode, result }) => `${mode.toUpperCase()}: ${result.output ?? result.message ?? ''}`)
    .filter((text) => text.trim().length > 0)
    .join('\n\n');
  const failedMessage = results.find(({ result }) => result.success !== true)?.result.message;
  const missingImage = results.some(({ result }) => result.success === true && !result.outputImageUrl);
  const hasAllRequestedImages = modes.every((mode) => (mode === '2d' ? resultImage2dUrl : resultImage3dUrl));
  const success = hasAllRequestedImages && !failedMessage;
  const firstHttpStatus = results.find(({ result }) => typeof result.httpStatus === 'number')?.result.httpStatus;

  return {
    runStatus: success ? 'done' : 'failed',
    resultText,
    resultImageUrl: resultImage2dUrl || resultImage3dUrl,
    resultImage2dUrl,
    resultImage3dUrl,
    message: success ? '測試完成。' : failedMessage ?? (missingImage ? '未產圖：模型回傳文字但沒有圖片。' : '測試失敗。'),
    httpStatus: firstHttpStatus ?? (success ? 200 : null),
  };
}

export function isVlmImageTaskActive(rowId: string): boolean {
  return activeImageTasks.has(rowId);
}

export function runVlmImageRow(
  rowId: string,
  imageDataUrl: string,
  testModel: VlmImageToImageTestFn = testImageToImageModel,
): Promise<void> {
  const active = activeImageTasks.get(rowId);
  if (active) return active;

  const row = getVlmImageToImageState().rows.find((item) => item.id === rowId);
  if (!row || !imageDataUrl) return Promise.resolve();

  const nowEpochMs = Date.now();
  const startedAtMs = row.runStatus === 'running' && row.runStartedAtMs ? row.runStartedAtMs : nowEpochMs;
  const elapsedBeforeDispatchMs = Math.max(0, nowEpochMs - startedAtMs);
  const startMs = (typeof performance !== 'undefined' ? performance.now() : nowEpochMs) - elapsedBeforeDispatchMs;
  patchVlmImageToImageRow(row.id, {
    runStatus: 'running',
    message: '模型評估中...',
    resultText: '',
    resultImageUrl: '',
    resultImage2dUrl: '',
    resultImage3dUrl: '',
    runStartedAtMs: startedAtMs,
    e2eMs: null,
    httpStatus: null,
  });

  const task = (async () => {
    try {
      const latestRow = getVlmImageToImageState().rows.find((item) => item.id === row.id) ?? row;
      const resultPatch = await runImageOutputs(latestRow, imageDataUrl, testModel);
      const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const next = {
        ...resultPatch,
        runStartedAtMs: null,
        e2eMs: nowMs - startMs,
        lastRunAt: new Date().toISOString(),
      };
      patchVlmImageToImageRow(row.id, next);
      appendVlmImageToImageHistory(latestRow, next);
    } catch (error) {
      const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const next = {
        runStatus: 'failed' as const,
        message: error instanceof Error ? error.message : '測試失敗。',
        runStartedAtMs: null,
        e2eMs: nowMs - startMs,
        httpStatus: null,
        lastRunAt: new Date().toISOString(),
      };
      const latestRow = getVlmImageToImageState().rows.find((item) => item.id === row.id) ?? row;
      patchVlmImageToImageRow(row.id, next);
      appendVlmImageToImageHistory(latestRow, next);
    } finally {
      activeImageTasks.delete(row.id);
    }
  })();

  activeImageTasks.set(row.id, task);
  return task;
}

export function runVlmImageRows(
  rowIds: string[],
  imageDataUrl: string,
  testModel: VlmImageToImageTestFn = testImageToImageModel,
): Promise<PromiseSettledResult<void>[]> {
  return Promise.allSettled(rowIds.map((rowId) => runVlmImageRow(rowId, imageDataUrl, testModel)));
}

export function resumePersistedVlmImageTasks(
  imageDataUrl: string | null,
  testModel: VlmImageToImageTestFn = testImageToImageModel,
): void {
  if (!imageDataUrl) return;
  getVlmImageToImageState().rows
    .filter((row) => row.runStatus === 'running' && !isVlmImageTaskActive(row.id))
    .forEach((row) => {
      void runVlmImageRow(row.id, imageDataUrl, testModel);
    });
}

function imageProviderSignal(): AbortSignal | undefined {
  return typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(120_000)
    : undefined;
}

function parseImageDataUrl(imageDataUrl: string): { mimeType: string; base64: string } {
  const match = imageDataUrl.match(IMAGE_MIME_PATTERN);
  if (!match) throw new Error('請上傳 JPG / PNG / WebP 圖片。');
  return { mimeType: match[1], base64: match[2] };
}

function imageBlob(imageDataUrl: string): Blob {
  const parsed = parseImageDataUrl(imageDataUrl);
  const bytes = Uint8Array.from(atob(parsed.base64), (char) => char.charCodeAt(0));
  return new Blob([bytes], { type: parsed.mimeType });
}

function extractOpenAIImageUrl(data: unknown): string {
  const image = (data as { data?: Array<{ b64_json?: string; url?: string }> })?.data?.[0];
  if (typeof image?.b64_json === 'string' && image.b64_json.length > 0) return `data:image/png;base64,${image.b64_json}`;
  return typeof image?.url === 'string' ? image.url : '';
}

type GeminiInlineData = { mimeType?: string; mime_type?: string; data?: string };
type GeminiPart = { text?: string; inlineData?: GeminiInlineData; inline_data?: GeminiInlineData };

function extractGeminiResult(data: unknown): { output: string; imageDataUrl?: string } {
  const parts = (data as { candidates?: { content?: { parts?: GeminiPart[] } }[] })?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return { output: '' };
  let output = '';
  let imageDataUrl: string | undefined;
  for (const part of parts) {
    if (typeof part.text === 'string') output += part.text;
    const inline = part.inlineData ?? part.inline_data;
    const mime = inline?.mimeType ?? inline?.mime_type;
    if (typeof mime === 'string' && typeof inline?.data === 'string' && !imageDataUrl) {
      imageDataUrl = `data:${mime};base64,${inline.data}`;
    }
  }
  return { output: output.trim(), imageDataUrl };
}

function extractQwenImageUrl(data: unknown): string {
  const content = (data as {
    output?: { choices?: Array<{ message?: { content?: Array<{ image?: string }> } }> };
  })?.output?.choices?.[0]?.message?.content;
  const image = content?.find((item) => typeof item.image === 'string')?.image;
  return typeof image === 'string' ? image : '';
}

async function testOpenAIImage(apiKey: string, model: string, prompt: string, imageDataUrl: string): Promise<VlmImageToImageTestResult> {
  const form = new FormData();
  form.append('model', model);
  form.append('prompt', prompt);
  form.append('image', imageBlob(imageDataUrl), 'floor-plan.png');
  form.append('size', '1536x1024');
  form.append('quality', 'low');
  form.append('output_format', 'png');
  const response = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: imageProviderSignal(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      success: false,
      message: (data as { error?: { message?: string } }).error?.message ?? `HTTP ${response.status}`,
      httpStatus: response.status,
    };
  }
  const outputImageUrl = extractOpenAIImageUrl(data);
  return {
    success: outputImageUrl.length > 0,
    message: outputImageUrl ? '圖生圖成功' : '模型回應成功但未回傳圖片',
    output: (data as { data?: Array<{ revised_prompt?: string }> }).data?.[0]?.revised_prompt ?? 'OpenAI image edit completed',
    outputImageUrl,
    httpStatus: response.status,
  };
}

async function testGeminiImage(apiKey: string, model: string, prompt: string, imageDataUrl: string): Promise<VlmImageToImageTestResult> {
  const parsed = parseImageDataUrl(imageDataUrl);
  const name = model.startsWith('models/') ? model : `models/${model}`;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${name}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inlineData: { mimeType: parsed.mimeType, data: parsed.base64 } },
          { text: prompt },
        ],
      }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    }),
    signal: imageProviderSignal(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      success: false,
      message: (data as { error?: { message?: string } }).error?.message ?? `HTTP ${response.status}`,
      httpStatus: response.status,
    };
  }
  const { output, imageDataUrl: outputImageUrl } = extractGeminiResult(data);
  return {
    success: Boolean(outputImageUrl),
    message: outputImageUrl ? '圖生圖成功' : '未產圖：Gemini 回傳文字但無圖片，請確認模型支援圖片輸出。',
    output: output || '（無文字輸出）',
    outputImageUrl,
    httpStatus: response.status,
  };
}

async function testQwenImage(apiKey: string, model: string, prompt: string, imageDataUrl: string): Promise<VlmImageToImageTestResult> {
  const response = await fetch('https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      input: {
        messages: [{
          role: 'user',
          content: [{ image: imageDataUrl }, { text: prompt }],
        }],
      },
      parameters: {
        size: '1536*1024',
        watermark: false,
        prompt_extend: true,
      },
    }),
    signal: imageProviderSignal(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      success: false,
      message: (data as { message?: string; error?: { message?: string } }).message
        ?? (data as { error?: { message?: string } }).error?.message
        ?? `HTTP ${response.status}`,
      httpStatus: response.status,
    };
  }
  const outputImageUrl = extractQwenImageUrl(data);
  return {
    success: outputImageUrl.length > 0,
    message: outputImageUrl ? '圖生圖成功' : '模型回應成功但未回傳圖片',
    output: outputImageUrl ? 'Qwen image edit completed' : JSON.stringify(data),
    outputImageUrl,
    httpStatus: response.status,
  };
}

export async function testImageToImageModel(
  provider: LlmProviderId,
  model: string,
  prompt: string,
  imageDataUrl: string,
): Promise<VlmImageToImageTestResult> {
  if (!isImageToImageCapableModel(provider, model)) {
    return { success: false, message: '此模型未標記為支援圖生圖輸出。' };
  }
  const apiKey = await loadProviderKey(provider);
  if (!apiKey?.trim()) return { success: false, message: `No API key saved for ${provider}` };
  if (provider === 'openai') return testOpenAIImage(apiKey, model, prompt, imageDataUrl);
  if (provider === 'gemini') return testGeminiImage(apiKey, model, prompt, imageDataUrl);
  if (provider === 'qwen') return testQwenImage(apiKey, model, prompt, imageDataUrl);
  return { success: false, message: '此 provider 尚未支援圖生圖測試。' };
}
