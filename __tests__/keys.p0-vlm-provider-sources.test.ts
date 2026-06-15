import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  canRunVlmImageToImage,
  imageToImageProvidersFrom,
  isImageToImageCapableModel,
  loadVlmCuratedModels,
  saveVlmCuratedModels,
  VLM_IMAGE_TO_IMAGE_CAPABLE_MODELS,
} from '../app/ui/views/Keys/VlmImageToImageEvaluation';
import { resetKeysStoreForTests } from '../lib/keys/store';
import type { ProviderLike } from '../app/ui/views/Keys/VlmArenaTypes';

/**
 * F50 VLM model-list derivation. Originally a Phase 0 pin of the
 * gemini-always bug (B9); flipped to the Phase 3 contract (tdd-spec E1–E3):
 * dual-source list (curated seed in the keys store + dynamic discovery)
 * scoped to validated providers only, and a desktop-only run gate.
 */

const GEMINI_CURATED = VLM_IMAGE_TO_IMAGE_CAPABLE_MODELS.filter((m) => m.provider === 'gemini');

describe('VLM image-to-image provider sources (Phase 3)', () => {
  beforeEach(() => {
    resetKeysStoreForTests();
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  });

  it('E1: providers without a validated key never appear (gemini bug fixed)', () => {
    expect(imageToImageProvidersFrom([])).toEqual([]);

    const onlyOpenai = imageToImageProvidersFrom([
      { id: 'openai', label: 'OpenAI', availableModels: ['gpt-image-1'] },
    ]);
    expect(onlyOpenai.find((provider) => provider.id === 'gemini')).toBeUndefined();
  });

  it('E1: a validated gemini gets its curated models offered', () => {
    const providers = imageToImageProvidersFrom([
      { id: 'gemini', label: 'Gemini', availableModels: ['gemini-2.5-flash'] },
    ]);
    const gemini = providers.find((provider) => provider.id === 'gemini');
    expect(gemini).toBeDefined();
    expect(gemini!.availableModels).toEqual(GEMINI_CURATED.map((m) => m.model));
  });

  it('E2: curated + dynamic merge with curated leading and text models filtered', () => {
    const validated: ProviderLike[] = [
      { id: 'openai', label: 'OpenAI', availableModels: ['gpt-4o', 'gpt-image-1'] },
    ];
    const providers = imageToImageProvidersFrom(validated);
    const openai = providers.find((provider) => provider.id === 'openai');
    expect(openai).toBeDefined();
    expect(openai!.availableModels).toContain('gpt-image-1.5');
    expect(openai!.availableModels).toContain('gpt-image-1');
    expect(openai!.availableModels).not.toContain('gpt-4o');
    // No duplicate when the dynamic list repeats a curated model.
    expect(openai!.availableModels.filter((m) => m === 'gpt-image-1')).toHaveLength(1);
  });

  it('E2: the curated list is store-editable — no code change to add a model', () => {
    saveVlmCuratedModels([
      { provider: 'openai', model: 'gpt-image-9000', label: 'Future Image Model' },
    ]);
    expect(loadVlmCuratedModels()).toEqual([
      { provider: 'openai', model: 'gpt-image-9000', label: 'Future Image Model' },
    ]);

    const providers = imageToImageProvidersFrom([
      { id: 'openai', label: 'OpenAI', availableModels: [] },
    ]);
    expect(providers[0]?.availableModels).toContain('gpt-image-9000');
  });

  it('E2: a corrupt curated slice falls back to the built-in seed', () => {
    saveVlmCuratedModels([] as never);
    expect(loadVlmCuratedModels()).toEqual(VLM_IMAGE_TO_IMAGE_CAPABLE_MODELS);
  });

  it('E3: the image run gate is desktop-only', () => {
    expect(canRunVlmImageToImage()).toBe(false);
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    expect(canRunVlmImageToImage()).toBe(true);
  });

  it('capability heuristic remains the dynamic-discovery fallback', () => {
    expect(isImageToImageCapableModel('gemini', 'gemini-2.5-flash-image')).toBe(true);
    expect(isImageToImageCapableModel('gemini', 'gemini-2.5-flash')).toBe(false);
    expect(isImageToImageCapableModel('openai', 'gpt-image-1')).toBe(true);
    expect(isImageToImageCapableModel('openai', 'gpt-4o')).toBe(false);
    expect(isImageToImageCapableModel('qwen', 'qwen-image-2.0-pro')).toBe(true);
    expect(isImageToImageCapableModel('anthropic', 'claude-image-anything')).toBe(false);
  });
});
