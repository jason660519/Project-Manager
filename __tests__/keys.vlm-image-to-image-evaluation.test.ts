import { describe, expect, it, vi } from 'vitest';
import {
  buildImageToImagePrompt,
  coerceImageToImageSelections,
  imageToImageProvidersFrom,
  isImageToImageCapableModel,
  promptForImageMode,
  requestedImageModes,
  runImageOutputs,
  type VlmImageToImageRow,
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

describe('Keys / VLM Arena image-to-image evaluation logic', () => {
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

    expect(providerIds).toEqual(expect.arrayContaining(['gemini', 'openai', 'qwen']));
    expect(providerIds).not.toEqual(expect.arrayContaining(['anthropic', 'zhipu']));
    expect(allModels).toEqual(expect.arrayContaining(['gemini-3.1-flash-image-preview', 'gpt-image-1', 'qwen-image-2.0-pro']));
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
});
