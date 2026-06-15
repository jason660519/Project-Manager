import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildImageToImagePrompt,
  coerceImageToImageSelections,
  getVlmImageToImageState,
  imageToImageProvidersFrom,
  isVlmImageTaskActive,
  isImageToImageCapableModel,
  promptForImageMode,
  requestedImageModes,
  resetVlmImageToImageStoreForTests,
  resumePersistedVlmImageTasks,
  runImageOutputs,
  runVlmImageRows,
  syncRowsWithSelectedModels,
  type VlmImageToImageRow,
  type VlmImageToImageTestResult,
} from '../app/ui/views/Keys/VlmImageToImageEvaluation';
import type { ProviderLike } from '../app/ui/views/Keys/VlmArenaTypes';

function row(overrides: Partial<VlmImageToImageRow> = {}): VlmImageToImageRow {
  return {
    id: 'row-1',
    no: 1,
    shouldTest: true,
    provider: 'gemini',
    model: 'gemini-3.1-flash-image-preview',
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
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

async function waitForAssertion(assertion: () => void) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await flushPromises();
    }
  }
  if (lastError) throw lastError;
}

describe('Keys / VLM Arena image-to-image evaluation logic', () => {
  beforeEach(() => {
    resetVlmImageToImageStoreForTests();
    vi.restoreAllMocks();
    // Image runs are desktop-only since F50 Phase 3; these logic tests run
    // the engine, so emulate the Tauri runtime.
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  });

  it('matches the reference prompt contract for style, output mode, and hard constraints', () => {
    const prompt = buildImageToImagePrompt('modern', 'both');

    expect(prompt).toContain('你是房地產格局圖轉換與室內設計視覺化助理。');
    expect(prompt).toContain('風格要求：現代清爽住宅風格');
    expect(prompt).toContain('輸出要求：同時產出兩張圖');
    expect(prompt).toContain('硬性限制：不要憑空新增不存在的房間');
    expect(prompt).toContain('輸出是參考圖，不是施工圖');
  });

  it('filters VLM Arena choices to image-output models only', () => {
    const providers: ProviderLike[] = [
      { id: 'anthropic', label: 'Anthropic', availableModels: ['claude-opus-4-7'] },
      { id: 'openai', label: 'OpenAI', availableModels: ['gpt-5.5', 'gpt-image-1'] },
      { id: 'qwen', label: 'Qwen', availableModels: ['qwen-max', 'qwen-image-2.0-pro'] },
      { id: 'zhipu', label: 'Zhipu', availableModels: ['glm-image'] },
    ];

    const imageProviders = imageToImageProvidersFrom(providers);
    const providerIds = imageProviders.map((provider) => provider.id);
    const allModels = imageProviders.flatMap((provider) => provider.availableModels);

    expect(providerIds).toEqual(expect.arrayContaining(['openai', 'qwen']));
    // gemini is NOT in the validated input, so its curated models must not be
    // offered (pre-F50 it always appeared and runs failed at execution).
    expect(providerIds).not.toEqual(expect.arrayContaining(['gemini', 'anthropic', 'zhipu']));
    expect(allModels).toEqual(expect.arrayContaining(['gpt-image-1', 'qwen-image-2.0-pro']));
    expect(allModels).not.toEqual(expect.arrayContaining(['gpt-5.5', 'qwen-max', 'glm-image']));
    expect(isImageToImageCapableModel('openai', 'gpt-image-1')).toBe(true);
    expect(isImageToImageCapableModel('anthropic', 'claude-opus-4-7')).toBe(false);
  });

  it('coerces legacy vision/text selections to supported image-output models', () => {
    const providers = imageToImageProvidersFrom([
      { id: 'anthropic', label: 'Anthropic', availableModels: ['claude-opus-4-7'] },
      { id: 'openai', label: 'OpenAI', availableModels: ['gpt-4o', 'gpt-image-1'] },
      { id: 'gemini', label: 'Gemini', availableModels: ['gemini-2.5-pro', 'gemini-2.5-flash-image'] },
    ]);

    expect(coerceImageToImageSelections([
      { provider: 'anthropic', model: 'claude-opus-4-7' },
      { provider: 'openai', model: 'gpt-4o' },
      { provider: 'gemini', model: 'gemini-2.5-pro' },
    ], providers)).toEqual([
      { provider: 'gemini', model: 'gemini-3.1-flash-image-preview' },
      { provider: 'openai', model: 'gpt-image-1.5' },
      { provider: 'gemini', model: 'gemini-3.1-flash-image-preview' },
    ]);
  });

  it('keeps duplicate model rows as independent persisted run targets', () => {
    const syncedRows = syncRowsWithSelectedModels([], [
      { provider: 'openai', model: 'gpt-image-1.5' },
      { provider: 'openai', model: 'gpt-image-1.5' },
    ]);

    expect(syncedRows).toHaveLength(2);
    expect(syncedRows[0].id).not.toBe(syncedRows[1].id);
    expect(new Set(syncedRows.map((item) => item.id)).size).toBe(2);
  });

  it('runs 2D and 3D image outputs with separate prompts and succeeds only when both images exist', async () => {
    const testModel = vi.fn()
      .mockResolvedValueOnce({
        success: true,
        message: '2d ok',
        output: '2d generated',
        outputImageUrl: 'data:image/png;base64,2d',
        httpStatus: 200,
      })
      .mockResolvedValueOnce({
        success: true,
        message: '3d ok',
        output: '3d generated',
        outputImageUrl: 'data:image/png;base64,3d',
        httpStatus: 200,
      });

    const result = await runImageOutputs(row(), 'data:image/png;base64,input', testModel);

    expect(requestedImageModes('both')).toEqual(['2d', '3d']);
    expect(promptForImageMode(row(), '2d')).toContain('本次請只產生：2D 彩繪平面圖');
    expect(promptForImageMode(row(), '3d')).toContain('本次請只產生：3D 鳥瞰彩繪圖');
    expect(testModel).toHaveBeenCalledTimes(2);
    expect(testModel).toHaveBeenNthCalledWith(1, 'gemini', 'gemini-3.1-flash-image-preview', expect.stringContaining('2D 彩繪平面圖'), 'data:image/png;base64,input');
    expect(testModel).toHaveBeenNthCalledWith(2, 'gemini', 'gemini-3.1-flash-image-preview', expect.stringContaining('3D 鳥瞰彩繪圖'), 'data:image/png;base64,input');
    expect(result).toMatchObject({
      runStatus: 'done',
      resultImage2dUrl: 'data:image/png;base64,2d',
      resultImage3dUrl: 'data:image/png;base64,3d',
      resultImageUrl: 'data:image/png;base64,2d',
      message: '測試完成。',
      httpStatus: 200,
    });
  });

  it('fails when a successful provider response has no image URL', async () => {
    const testModel = vi.fn()
      .mockResolvedValueOnce({ success: true, message: 'text only', output: '2d text', httpStatus: 200 })
      .mockResolvedValueOnce({
        success: true,
        message: '3d ok',
        output: '3d generated',
        outputImageUrl: 'data:image/png;base64,3d',
        httpStatus: 200,
      });

    const result = await runImageOutputs(row(), 'data:image/png;base64,input', testModel);

    expect(result.runStatus).toBe('failed');
    expect(result.message).toBe('未產圖：模型回傳文字但沒有圖片。');
    expect(result.resultImage2dUrl).toBe('');
    expect(result.resultImage3dUrl).toBe('data:image/png;base64,3d');
  });

  it('fails with the provider error message when any requested mode fails', async () => {
    const testModel = vi.fn()
      .mockResolvedValueOnce({
        success: true,
        message: '2d ok',
        output: '2d generated',
        outputImageUrl: 'data:image/png;base64,2d',
        httpStatus: 200,
      })
      .mockResolvedValueOnce({ success: false, message: 'rate limit', output: '', httpStatus: 429 });

    const result = await runImageOutputs(row(), 'data:image/png;base64,input', testModel);

    expect(result.runStatus).toBe('failed');
    expect(result.message).toBe('rate limit');
    expect(result.httpStatus).toBe(200);
  });

  it('persists completed images and still-running row state while Run All continues after the sheet unmounts', async () => {
    const first = deferred<VlmImageToImageTestResult>();
    const second = deferred<VlmImageToImageTestResult>();
    const firstRow = row({ id: 'row-a', no: 1, model: 'gemini-3.1-flash-image-preview', outputMode: '2d' });
    const secondRow = row({ id: 'row-b', no: 2, model: 'gemini-3-pro-image-preview', outputMode: '2d' });
    const testModel = vi.fn((_provider, model) => (model === firstRow.model ? first.promise : second.promise));

    resetVlmImageToImageStoreForTests({
      version: 1,
      rows: [firstRow, secondRow],
      historyByResultKey: {},
    });

    const runAll = runVlmImageRows(['row-a', 'row-b'], 'data:image/png;base64,input', testModel);
    await flushPromises();

    expect(getVlmImageToImageState().rows.map((item) => item.runStatus)).toEqual(['running', 'running']);
    expect(isVlmImageTaskActive('row-a')).toBe(true);
    expect(isVlmImageTaskActive('row-b')).toBe(true);

    first.resolve({
      success: true,
      output: '2d first generated',
      outputImageUrl: 'data:image/png;base64,first-image',
      httpStatus: 200,
    });
    await waitForAssertion(() => {
      expect(getVlmImageToImageState().rows[0].runStatus).toBe('done');
    });

    const remountedSnapshot = getVlmImageToImageState();
    expect(remountedSnapshot.rows[0]).toMatchObject({
      runStatus: 'done',
      resultImage2dUrl: 'data:image/png;base64,first-image',
      resultImageUrl: 'data:image/png;base64,first-image',
    });
    expect(remountedSnapshot.rows[1].runStatus).toBe('running');
    expect(remountedSnapshot.rows[1].runStartedAtMs).toEqual(expect.any(Number));

    second.resolve({
      success: true,
      output: '2d second generated',
      outputImageUrl: 'data:image/png;base64,second-image',
      httpStatus: 200,
    });
    await runAll;

    const completedSnapshot = getVlmImageToImageState();
    expect(completedSnapshot.rows.map((item) => item.runStatus)).toEqual(['done', 'done']);
    expect(completedSnapshot.rows[1].resultImage2dUrl).toBe('data:image/png;base64,second-image');
    expect(completedSnapshot.historyByResultKey['gemini-gemini-3.1-flash-image-preview']).toHaveLength(1);
    expect(completedSnapshot.historyByResultKey['gemini-gemini-3-pro-image-preview']).toHaveLength(1);
  });

  it('resumes persisted running rows after a fresh mount by dispatching unfinished image jobs again', async () => {
    const pending = deferred<VlmImageToImageTestResult>();
    const runningRow = row({
      id: 'row-resume',
      outputMode: '2d',
      runStatus: 'running',
      runStartedAtMs: Date.now() - 15_000,
      message: '模型評估中...',
    });
    const testModel = vi.fn(() => pending.promise);

    resetVlmImageToImageStoreForTests({
      version: 1,
      rows: [runningRow],
      historyByResultKey: {},
    });

    resumePersistedVlmImageTasks('data:image/png;base64,input', testModel);
    await flushPromises();

    expect(testModel).toHaveBeenCalledTimes(1);
    expect(isVlmImageTaskActive('row-resume')).toBe(true);
    expect(getVlmImageToImageState().rows[0].runStartedAtMs).toBe(runningRow.runStartedAtMs);

    pending.resolve({
      success: true,
      output: 'resumed output',
      outputImageUrl: 'data:image/png;base64,resumed-image',
      httpStatus: 200,
    });
    await waitForAssertion(() => {
      expect(getVlmImageToImageState().rows[0].runStatus).toBe('done');
    });

    expect(getVlmImageToImageState().rows[0]).toMatchObject({
      runStatus: 'done',
      resultImage2dUrl: 'data:image/png;base64,resumed-image',
      message: '測試完成。',
    });
  });

  it('blocks image runs in browser mode without calling the model (F50 E3)', async () => {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
    resetVlmImageToImageStoreForTests({ version: 1, rows: [row()], historyByResultKey: {} });
    const testModel = vi.fn();

    await Promise.allSettled([runVlmImageRows(['row-1'], 'data:image/png;base64,input', testModel)]);

    expect(testModel).not.toHaveBeenCalled();
    const blockedRow = getVlmImageToImageState().rows[0];
    expect(blockedRow.runStatus).toBe('failed');
    expect(blockedRow.message).toContain('桌面 App');
  });

  it('does not resume persisted running rows in browser mode (F50 E3)', async () => {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
    const runningRow = row({ id: 'row-resume', runStatus: 'running', runStartedAtMs: Date.now() });
    resetVlmImageToImageStoreForTests({ version: 1, rows: [runningRow], historyByResultKey: {} });
    const testModel = vi.fn();

    resumePersistedVlmImageTasks('data:image/png;base64,input', testModel);
    await flushPromises();

    expect(testModel).not.toHaveBeenCalled();
    // The row stays 'running' so the desktop app can resume it later.
    expect(getVlmImageToImageState().rows[0].runStatus).toBe('running');
  });
});
