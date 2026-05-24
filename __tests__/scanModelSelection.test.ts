import { beforeEach, describe, expect, it } from 'vitest';
import { getLlmProvider } from '../lib/keys/llmProviders';
import { saveProviderMetadata } from '../lib/keys/providerMetadata';
import { resolveScanModelForProvider } from '../lib/scanner/modelSelection';

describe('scan model selection', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('uses live validated model metadata ahead of stale static defaults', () => {
    const spec = getLlmProvider('deepseek');
    expect(spec).toBeTruthy();
    saveProviderMetadata('deepseek', {
      status: 'ok',
      lastValidatedAt: '2026-05-24T00:00:00.000Z',
      dynamicModels: ['deepseek-v4-pro', 'deepseek-v4-flash'],
    });

    const resolved = resolveScanModelForProvider('deepseek', spec!, 'deepseek-v4');

    expect(resolved).toMatchObject({
      model: 'deepseek-v4-pro',
      source: 'dynamic-preferred',
    });
  });

  it('keeps the stored model when it is present in the live validated list', () => {
    const spec = getLlmProvider('gemini');
    expect(spec).toBeTruthy();
    saveProviderMetadata('gemini', {
      status: 'ok',
      lastValidatedAt: '2026-05-24T00:00:00.000Z',
      dynamicModels: ['gemini-2.5-flash', 'gemini-2.5-pro'],
    });

    const resolved = resolveScanModelForProvider('gemini', spec!, 'gemini-2.5-pro');

    expect(resolved).toMatchObject({
      model: 'gemini-2.5-pro',
      source: 'stored',
    });
  });

  it('uses scan-safe static preferences when validation metadata is absent', () => {
    const spec = getLlmProvider('openai');
    expect(spec).toBeTruthy();

    const resolved = resolveScanModelForProvider('openai', spec!, 'gpt-5.5');

    expect(resolved).toMatchObject({
      model: 'gpt-4o',
      source: 'static-preferred',
    });
  });
});

