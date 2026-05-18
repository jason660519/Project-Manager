/**
 * Saving a provider's API key should count as the explicit opt-in for that
 * provider in the fallback chain. The "default disabled when a new provider
 * is appended" rule is still in force for *unconfigured* providers — but
 * once the user has typed in a key, forcing them to also tick a Settings
 * checkbox is bureaucracy, not safety.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  bulkEnableConfiguredProviders,
  enableProviderInOrder,
  loadProviderOrder,
  saveProviderOrder,
  type ProviderOrderEntry,
} from '../lib/keys/providerOrder';

const STORAGE_KEY = 'projectManager-llm-provider-order';

beforeEach(() => {
  window.localStorage.removeItem(STORAGE_KEY);
});
afterEach(() => {
  window.localStorage.removeItem(STORAGE_KEY);
});

describe('enableProviderInOrder', () => {
  it('flips a previously-disabled provider to enabled', async () => {
    // Seed with deepseek disabled (the situation in the user's screenshot).
    const seeded: ProviderOrderEntry[] = [
      { provider: 'anthropic', enabled: true },
      { provider: 'deepseek', enabled: false },
    ];
    await saveProviderOrder(seeded);

    await enableProviderInOrder('deepseek');

    const loaded = await loadProviderOrder();
    const deepseek = loaded.find((e) => e.provider === 'deepseek');
    expect(deepseek?.enabled).toBe(true);
  });

  it('leaves an already-enabled entry alone (no churn)', async () => {
    const seeded: ProviderOrderEntry[] = [
      { provider: 'anthropic', enabled: true },
    ];
    await saveProviderOrder(seeded);

    await enableProviderInOrder('anthropic');

    const loaded = await loadProviderOrder();
    expect(loaded.find((e) => e.provider === 'anthropic')?.enabled).toBe(true);
  });

  it('preserves the position of the entry (only flips the flag, no reordering)', async () => {
    const seeded: ProviderOrderEntry[] = [
      { provider: 'gemini', enabled: true },
      { provider: 'anthropic', enabled: false },
      { provider: 'openai', enabled: true },
    ];
    await saveProviderOrder(seeded);

    await enableProviderInOrder('anthropic');

    const loaded = await loadProviderOrder();
    expect(loaded.slice(0, 3).map((e) => e.provider)).toEqual([
      'gemini',
      'anthropic',
      'openai',
    ]);
  });
});

describe('bulkEnableConfiguredProviders', () => {
  it('enables every provider whose key is configured, leaves the rest alone', async () => {
    // Seed: anthropic + openai enabled, deepseek/grok disabled.
    const seeded: ProviderOrderEntry[] = [
      { provider: 'anthropic', enabled: true },
      { provider: 'openai', enabled: true },
      { provider: 'deepseek', enabled: false },
      { provider: 'grok', enabled: false },
      { provider: 'gemini', enabled: false },
    ];
    await saveProviderOrder(seeded);

    // The "configured" probe: anthropic / openai / deepseek have keys; grok / gemini don't.
    await bulkEnableConfiguredProviders(['anthropic', 'openai', 'deepseek']);

    const loaded = await loadProviderOrder();
    const byId = Object.fromEntries(loaded.map((e) => [e.provider, e.enabled]));
    expect(byId.anthropic).toBe(true);
    expect(byId.openai).toBe(true);
    expect(byId.deepseek).toBe(true); // flipped
    expect(byId.grok).toBe(false); // no key ⇒ stays disabled
    expect(byId.gemini).toBe(false); // no key ⇒ stays disabled
  });

  it('is a no-op when no configured providers are disabled', async () => {
    const seeded: ProviderOrderEntry[] = [
      { provider: 'anthropic', enabled: true },
      { provider: 'openai', enabled: true },
    ];
    await saveProviderOrder(seeded);

    await bulkEnableConfiguredProviders(['anthropic', 'openai']);

    const loaded = await loadProviderOrder();
    expect(loaded.find((e) => e.provider === 'anthropic')?.enabled).toBe(true);
    expect(loaded.find((e) => e.provider === 'openai')?.enabled).toBe(true);
  });
});
