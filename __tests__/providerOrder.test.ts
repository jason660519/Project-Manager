/**
 * Tests for the AI provider fallback-order preference (Settings → AI providers).
 *
 * Two orthogonal concerns:
 *   1. Storage — load returns the saved value, with sensible default + repair
 *      when localStorage is missing / malformed.
 *   2. Iteration — given an order + a "has-key" probe, return the sequence of
 *      providers we'd actually try (skips disabled, skips ones without keys).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_PROVIDER_ORDER,
  iterateProvidersForFallback,
  loadProviderOrder,
  saveProviderOrder,
  type ProviderOrderEntry,
} from '../lib/keys/providerOrder';

const STORAGE_KEY = 'projectManager-llm-provider-order';

describe('providerOrder — storage', () => {
  beforeEach(() => {
    window.localStorage.removeItem(STORAGE_KEY);
  });
  afterEach(() => {
    window.localStorage.removeItem(STORAGE_KEY);
  });

  it('returns the canonical default when localStorage is empty', async () => {
    const order = await loadProviderOrder();
    expect(order).toEqual(DEFAULT_PROVIDER_ORDER);
  });

  it('round-trips a custom model selection through save → load', async () => {
    // The Settings playground writes back the user-picked model. Repair
    // logic must preserve it, otherwise switching tabs would erase the pick.
    await saveProviderOrder([
      { provider: 'anthropic', enabled: true, model: 'claude-opus-4-1' },
      { provider: 'openai', enabled: true, model: 'gpt-4o-mini' },
    ]);
    const loaded = await loadProviderOrder();
    const anthropic = loaded.find((e) => e.provider === 'anthropic');
    const openai = loaded.find((e) => e.provider === 'openai');
    expect(anthropic?.model).toBe('claude-opus-4-1');
    expect(openai?.model).toBe('gpt-4o-mini');
  });

  it('drops a stored model that is not in the provider\'s availableModels list', async () => {
    // Forward-compat: if a future version writes a model the current build
    // doesn't know about, we'd rather fall back to defaultModel than
    // bricking the row with a value its dropdown can't represent.
    await saveProviderOrder([
      { provider: 'anthropic', enabled: true, model: 'claude-9000-imaginary' },
    ]);
    const loaded = await loadProviderOrder();
    expect(loaded.find((e) => e.provider === 'anthropic')?.model).toBeUndefined();
  });

  it('round-trips through save → load (user-set part) and tops up the rest disabled', async () => {
    // Saving only three entries simulates an older version of PM that knew
    // about fewer providers. On reload we keep the user's chosen order +
    // enabled flags for those three, then append every newer provider in
    // the default order, all disabled (the "no silent opt-in" rule).
    const custom: ProviderOrderEntry[] = [
      { provider: 'openai', enabled: true },
      { provider: 'anthropic', enabled: false },
      { provider: 'gemini', enabled: true },
    ];
    await saveProviderOrder(custom);
    const loaded = await loadProviderOrder();
    expect(loaded.slice(0, 3)).toEqual(custom);
    for (const entry of loaded.slice(3)) {
      expect(entry.enabled, `${entry.provider} should default to disabled`).toBe(false);
    }
  });

  it('falls back to the default when storage holds invalid JSON', async () => {
    window.localStorage.setItem(STORAGE_KEY, '{not-json');
    const order = await loadProviderOrder();
    expect(order).toEqual(DEFAULT_PROVIDER_ORDER);
  });

  it('repairs a stored list that is missing providers', async () => {
    // User had only Anthropic enabled before Gemini was added — load must
    // top up the missing providers (default-disabled) so the new ones can
    // be opted in from Settings instead of being silently dropped.
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ provider: 'anthropic', enabled: true }]),
    );
    const order = await loadProviderOrder();
    const ids = order.map((e) => e.provider);
    expect(ids).toContain('anthropic');
    expect(ids).toContain('openai');
    expect(ids).toContain('gemini');
    // The user's existing entry must keep its enabled flag.
    expect(order.find((e) => e.provider === 'anthropic')?.enabled).toBe(true);
    // Newly added ones default to disabled (don't silently grant a credit-card path).
    expect(order.find((e) => e.provider === 'openai')?.enabled).toBe(false);
    expect(order.find((e) => e.provider === 'gemini')?.enabled).toBe(false);
  });

  it('drops unknown providers stored from a future version', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { provider: 'anthropic', enabled: true },
        { provider: 'nonexistent-provider', enabled: true },
      ]),
    );
    const order = await loadProviderOrder();
    const ids = order.map((e) => e.provider);
    expect(ids).not.toContain('nonexistent-provider');
    expect(ids).toContain('anthropic');
  });
});

describe('iterateProvidersForFallback', () => {
  it('returns providers in stored order, skipping disabled ones', () => {
    const order: ProviderOrderEntry[] = [
      { provider: 'anthropic', enabled: false },
      { provider: 'openai', enabled: true },
      { provider: 'gemini', enabled: true },
    ];
    const result = iterateProvidersForFallback(order, () => true);
    expect(result).toEqual(['openai', 'gemini']);
  });

  it('skips providers whose key is not configured', () => {
    const order: ProviderOrderEntry[] = [
      { provider: 'anthropic', enabled: true },
      { provider: 'openai', enabled: true },
      { provider: 'gemini', enabled: true },
    ];
    // Only openai has a key
    const hasKey = (p: ProviderOrderEntry['provider']) => p === 'openai';
    const result = iterateProvidersForFallback(order, hasKey);
    expect(result).toEqual(['openai']);
  });

  it('returns an empty array when nothing is usable', () => {
    const order = DEFAULT_PROVIDER_ORDER.map((e) => ({ ...e, enabled: false }));
    const result = iterateProvidersForFallback(order, () => true);
    expect(result).toEqual([]);
  });
});
