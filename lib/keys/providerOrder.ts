/**
 * AI provider fallback-order preference (Settings → AI providers).
 *
 * Source of truth for the provider list itself is `llmProviders.ts`; this
 * module owns the user's *preference* (order + per-provider enabled flag)
 * and the storage round-trip.
 *
 * Two design rules baked in:
 *
 *   1. **Never silently enable a provider.** When a newer release adds a
 *      provider, the missing entries are appended *disabled*. The user opts
 *      in from Settings — we don't grant a credit-card path on their behalf.
 *
 *   2. **Storage is forward-compatible.** Stored entries with an unknown
 *      provider id (e.g. written by a future version) are dropped instead
 *      of crashing.
 */

import { getLlmProvider, getLlmProviderIds, type LlmProviderId } from './llmProviders';

export type { LlmProviderId };

export const ALL_LLM_PROVIDERS: readonly LlmProviderId[] = getLlmProviderIds();

export interface ProviderOrderEntry {
  provider: LlmProviderId;
  enabled: boolean;
  /**
   * User-picked model. Undefined ⇒ scanner uses `spec.defaultModel`.
   * Repair drops values that no longer appear in `spec.availableModels` so
   * a future version that removes a model doesn't strand the row.
   */
  model?: string;
}

/**
 * Out-of-the-box order: the three flagship native APIs first, then the
 * OpenAI-compatible ecosystem in registration order. Every entry defaults
 * to enabled — a brand-new install opts the user *into* fallback by default;
 * only existing-user repair adds new providers disabled.
 */
export const DEFAULT_PROVIDER_ORDER: ProviderOrderEntry[] = ALL_LLM_PROVIDERS.map(
  (provider) => ({ provider, enabled: true }),
);

const STORAGE_KEY = 'projectManager-llm-provider-order';
const PROVIDER_ORDER_CHANGED_EVENT = 'pm:provider-order-changed';

function isValidProvider(id: unknown): id is LlmProviderId {
  return typeof id === 'string' && (ALL_LLM_PROVIDERS as readonly string[]).includes(id);
}

function defaultClone(): ProviderOrderEntry[] {
  return DEFAULT_PROVIDER_ORDER.map((e) => ({ ...e }));
}

function repairOrder(raw: unknown): ProviderOrderEntry[] {
  if (!Array.isArray(raw)) return defaultClone();
  const seen = new Set<LlmProviderId>();
  const out: ProviderOrderEntry[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const r = item as { provider?: unknown; enabled?: unknown; model?: unknown };
    if (!isValidProvider(r.provider) || seen.has(r.provider)) continue;
    seen.add(r.provider);
    const entry: ProviderOrderEntry = {
      provider: r.provider,
      enabled: r.enabled === true,
    };
    // Only keep the stored model when the provider's current spec still
    // lists it as available — otherwise the dropdown can't represent it.
    if (typeof r.model === 'string' && r.model.length > 0) {
      const spec = getLlmProvider(r.provider);
      if (spec?.availableModels.includes(r.model)) entry.model = r.model;
    }
    out.push(entry);
  }
  // Top up any providers the user hasn't seen yet — default DISABLED so we
  // never auto-grant a new billable path without explicit opt-in.
  for (const p of ALL_LLM_PROVIDERS) {
    if (!seen.has(p)) out.push({ provider: p, enabled: false });
  }
  return out;
}

export async function loadProviderOrder(): Promise<ProviderOrderEntry[]> {
  if (typeof window === 'undefined') return defaultClone();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultClone();
    return repairOrder(JSON.parse(raw));
  } catch {
    return defaultClone();
  }
}

export async function saveProviderOrder(order: ProviderOrderEntry[]): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
    window.dispatchEvent(new CustomEvent(PROVIDER_ORDER_CHANGED_EVENT));
  } catch {
    /* ignore quota / private-mode failures */
  }
}

export function subscribeProviderOrderChanges(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };

  window.addEventListener(PROVIDER_ORDER_CHANGED_EVENT, listener);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(PROVIDER_ORDER_CHANGED_EVENT, listener);
    window.removeEventListener('storage', handleStorage);
  };
}

export async function setProviderActiveInOrder(
  provider: LlmProviderId,
  active: boolean,
): Promise<void> {
  const order = await loadProviderOrder();
  const idx = order.findIndex((entry) => entry.provider === provider);
  if (idx === -1) return;
  if (order[idx].enabled === active) return;
  const next = order.map((entry, i) => (
    i === idx ? { ...entry, enabled: active } : entry
  ));
  await saveProviderOrder(next);
}

/**
 * Given the stored order and a probe that reports whether a provider has a
 * usable API key, return the list of provider ids we'd actually try, in
 * preference order. Empty list ⇒ Settings tells the user to enable one or
 * add a key — the scanner short-circuits with `NO_PROVIDER_CONFIGURED`.
 */
export function iterateProvidersForFallback(
  order: ProviderOrderEntry[],
  hasKey: (provider: LlmProviderId) => boolean,
): LlmProviderId[] {
  return order
    .filter((entry) => entry.enabled && hasKey(entry.provider))
    .map((entry) => entry.provider);
}

/**
 * Mark a provider as enabled in the stored order. Used as the side effect of
 * "user saved an API key" — typing in a key is itself the explicit opt-in,
 * so we don't make the user also tick a Settings checkbox afterwards. No-op
 * when the entry is already enabled.
 */
export async function enableProviderInOrder(provider: LlmProviderId): Promise<void> {
  const order = await loadProviderOrder();
  const idx = order.findIndex((e) => e.provider === provider);
  if (idx === -1) return;
  if (order[idx].enabled) return;
  const next = order.map((entry, i) =>
    i === idx ? { ...entry, enabled: true } : entry,
  );
  await saveProviderOrder(next);
}

/**
 * Flip every disabled-but-configured entry to enabled in one shot. Used by
 * the "Enable all configured providers" CTA in Settings to recover from the
 * pre-auto-enable era where a freshly imported key still showed up
 * struck-through.
 */
export async function bulkEnableConfiguredProviders(
  configured: readonly LlmProviderId[],
): Promise<void> {
  const order = await loadProviderOrder();
  const configuredSet = new Set(configured);
  let changed = false;
  const next = order.map((entry) => {
    if (!entry.enabled && configuredSet.has(entry.provider)) {
      changed = true;
      return { ...entry, enabled: true };
    }
    return entry;
  });
  if (changed) await saveProviderOrder(next);
}
