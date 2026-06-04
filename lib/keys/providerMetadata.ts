/**
 * Per-provider validation metadata: when did we last ping the provider's
 * list-models endpoint, did it succeed, and what models did it report.
 *
 * Stored in `localStorage` under a single JSON map — not in the OS keychain
 * (this is not secret) and not in `.project-manager.json` (no need to bump
 * schemaVersion for cache-y derived data). Lost localStorage just means the
 * Keys table falls back to "Configured (not validated)" until the user
 * re-runs validation, which is acceptable.
 *
 * `dynamicModels` supplements the static `availableModels` list in
 * `llmProviders.ts`. The curated static catalogue stays first so UI defaults
 * remain stable even when a provider's live `/models` endpoint returns noisy
 * entries or changes ordering.
 */

const STORAGE_KEY = 'pm:keys-metadata';
const MODEL_SUPPORT_STORAGE_KEY = 'pm:keys-validated-model-support';
const METADATA_CHANGED_EVENT = 'pm:keys-metadata-changed';
export const MODEL_LIST_STALE_MS = 24 * 60 * 60 * 1000;

export interface ProviderMetadata {
  /** ISO 8601 timestamp of the last validation attempt. */
  lastValidatedAt: string;
  status: 'ok' | 'fail';
  /** Present when `status === 'fail'`. Short human-readable reason. */
  errorReason?: string;
  /** Present when `status === 'ok'`. Models returned by list-models endpoint. */
  dynamicModels?: string[];
}

export type ProviderMetadataMap = Record<string, ProviderMetadata>;

export interface ValidatedModelSupportSummary {
  generatedAt: string;
  providers: Array<{ providerId: string; models: string[] }>;
  totalModelCount: number;
  uniqueModels: string[];
  uniqueModelCount: number;
}

export type ValidationFailureCategory =
  | 'auth'
  | 'unreachable'
  | 'endpoint'
  | 'rate_limit'
  | 'quota'
  | 'empty'
  | 'permission'
  | 'service_unavailable'
  | 'invalid_request'
  | 'parse'
  | 'keychain'
  | 'unknown';

export interface ValidationFailureSummary {
  category: ValidationFailureCategory;
  label: string;
  detail: string;
  hint: string;
}

export type ModelListState =
  | { kind: 'catalogue'; label: 'Catalogue'; detail: string }
  | { kind: 'refreshed'; label: string; detail: string }
  | { kind: 'stale'; label: string; detail: string }
  | { kind: 'failed'; label: string; detail: string };

/** Safe wrapper — returns `null` outside the browser or on parse failures. */
function readMap(): ProviderMetadataMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as ProviderMetadataMap;
    }
    return {};
  } catch {
    // Corrupted JSON — start over rather than crash the Keys page.
    return {};
  }
}

function writeMap(map: ProviderMetadataMap): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    const summary = computeValidatedModelSupportSummary(map);
    window.localStorage.setItem(MODEL_SUPPORT_STORAGE_KEY, JSON.stringify(summary));
    window.dispatchEvent(new CustomEvent(METADATA_CHANGED_EVENT));
  } catch {
    // Quota exceeded or storage disabled — silent no-op is fine, the next
    // validation just won't be cached.
  }
}

export function loadAllProviderMetadata(): ProviderMetadataMap {
  return readMap();
}

export function loadProviderMetadata(providerId: string): ProviderMetadata | null {
  return readMap()[providerId] ?? null;
}

export function loadValidatedModelSupportSummary(): ValidatedModelSupportSummary | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(MODEL_SUPPORT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as ValidatedModelSupportSummary;
  } catch {
    return null;
  }
}

export function saveProviderMetadata(
  providerId: string,
  meta: ProviderMetadata,
): void {
  const map = readMap();
  map[providerId] = meta;
  writeMap(map);
}

export function clearProviderMetadata(providerId: string): void {
  const map = readMap();
  if (providerId in map) {
    delete map[providerId];
    writeMap(map);
  }
}

export function computeValidatedModelSupportSummary(
  map: ProviderMetadataMap,
): ValidatedModelSupportSummary {
  const providers: Array<{ providerId: string; models: string[] }> = [];
  const unique = new Set<string>();
  let totalModelCount = 0;

  Object.entries(map).forEach(([providerId, meta]) => {
    if (meta?.status !== 'ok') return;
    const models = meta.dynamicModels?.filter(Boolean) ?? [];
    if (models.length === 0) return;
    const deduped = Array.from(new Set(models));
    providers.push({ providerId, models: deduped });
    totalModelCount += deduped.length;
    deduped.forEach((m) => unique.add(m));
  });

  providers.sort((a, b) => a.providerId.localeCompare(b.providerId));
  const uniqueModels = Array.from(unique).sort((a, b) => a.localeCompare(b));

  return {
    generatedAt: new Date().toISOString(),
    providers,
    totalModelCount,
    uniqueModels,
    uniqueModelCount: uniqueModels.length,
  };
}

export function mergeCuratedAndDynamicModels(
  curatedModels: readonly string[],
  dynamicModels: readonly string[] | null | undefined,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  [...curatedModels, ...(dynamicModels ?? [])].forEach((model) => {
    const normalized = model.trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  });

  return out;
}

export function subscribeProviderMetadataChanges(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleStorage = (event: StorageEvent) => {
    if (!event.key) return;
    if (event.key === STORAGE_KEY || event.key === MODEL_SUPPORT_STORAGE_KEY) {
      listener();
    }
  };

  window.addEventListener(METADATA_CHANGED_EVENT, listener);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(METADATA_CHANGED_EVENT, listener);
    window.removeEventListener('storage', handleStorage);
  };
}

/**
 * Returns the model list the Keys page should display for `providerId`:
 * dynamic (from validation) when available, falling back to the static list.
 */
export function resolveModelList(
  providerId: string,
  staticModels: readonly string[],
): { models: string[]; isDynamic: boolean } {
  const meta = loadProviderMetadata(providerId);
  if (meta?.status === 'ok' && meta.dynamicModels && meta.dynamicModels.length > 0) {
    return {
      models: mergeCuratedAndDynamicModels(staticModels, meta.dynamicModels),
      isDynamic: true,
    };
  }
  return { models: [...staticModels], isDynamic: false };
}

export function getModelListState(
  meta: ProviderMetadata | null | undefined,
  options: { now?: number; staleMs?: number } = {},
): ModelListState {
  const now = options.now ?? Date.now();
  const staleMs = options.staleMs ?? MODEL_LIST_STALE_MS;

  if (meta?.status === 'fail') {
    const failure = classifyValidationFailure(meta.errorReason);
    return {
      kind: 'failed',
      label: failure.label,
      detail: `${failure.detail} — ${failure.hint}`,
    };
  }

  if (meta?.status !== 'ok' || !meta.dynamicModels || meta.dynamicModels.length === 0) {
    return {
      kind: 'catalogue',
      label: 'Catalogue',
      detail: 'Using curated model catalogue',
    };
  }

  const ts = Date.parse(meta.lastValidatedAt);
  if (!Number.isFinite(ts)) {
    return {
      kind: 'stale',
      label: 'Stale',
      detail: 'Model list timestamp is unavailable',
    };
  }

  const ageMs = Math.max(0, now - ts);
  const relative = formatDurationAgo(ageMs, meta.lastValidatedAt);
  if (ageMs > staleMs) {
    return {
      kind: 'stale',
      label: `Stale ${relative}`,
      detail: `Last refreshed ${relative}`,
    };
  }

  return {
    kind: 'refreshed',
    label: `Refreshed ${relative}`,
    detail: `Latest model refresh completed ${relative}`,
  };
}

function formatDurationAgo(ageMs: number, iso: string): string {
  const seconds = Math.floor(ageMs / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return iso.slice(0, 10);
}

/**
 * Render an ISO timestamp as a short relative string for the table's
 * "Last validated" column. Caller is responsible for re-rendering — this
 * function does not subscribe to ticks.
 */
export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return '—';
  const diffMs = Date.now() - ts;
  if (diffMs < 0) return 'just now';
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  // Older than a week — show ISO date only (drop time + tz noise).
  return iso.slice(0, 10);
}

/**
 * Mask a secret for table preview — first 3 chars + `***` + last 3 chars.
 * Returns `null` for empty input so callers can render `—` instead.
 */
export function maskKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length <= 8) {
    return `${trimmed.slice(0, 1)}***`;
  }
  return `${trimmed.slice(0, 3)}***${trimmed.slice(-3)}`;
}

export function classifyValidationFailure(reason: string | null | undefined): ValidationFailureSummary {
  const raw = reason?.trim() || 'Validation failed';
  const lower = raw.toLowerCase();

  if (
    lower.includes('unknown provider') ||
    lower.includes('no validation contract')
  ) {
    return {
      category: 'unknown',
      label: 'Provider not supported for rescan',
      detail: raw,
      hint: 'This provider has no list-models validation path; check Keys configuration or update the app.',
    };
  }

  if (lower.includes('no key configured') || lower.includes('api key is empty')) {
    return {
      category: 'empty',
      label: 'No key configured',
      detail: raw,
      hint: 'Import a key from .env or paste one on the Keys page for this provider, then rescan.',
    };
  }

  if (
    lower.includes('keychain') ||
    lower.includes('keyring') ||
    lower.includes('secret service') ||
    lower.includes('osstatus')
  ) {
    return {
      category: 'keychain',
      label: 'Key storage unavailable',
      detail: raw,
      hint: 'Unlock the OS keychain, approve the access prompt, or restart the desktop app and retry.',
    };
  }

  if (
    lower.includes('parse error') ||
    lower.includes('json parse') ||
    lower.includes('malformed json') ||
    lower.includes('unexpected token') ||
    lower.includes('invalid json')
  ) {
    return {
      category: 'parse',
      label: 'Provider returned invalid data',
      detail: raw,
      hint: 'The provider API responded but the payload was not valid JSON; retry later or check provider status.',
    };
  }

  if (
    lower.includes('credit balance is too low') ||
    lower.includes('insufficient credits') ||
    lower.includes('payment required') ||
    lower.includes('billing') ||
    lower.includes('quota') ||
    lower.includes('insufficient') ||
    lower.includes('exceeded') ||
    /\b402\b/.test(lower)
  ) {
    return {
      category: 'quota',
      label: 'Quota or billing blocked',
      detail: raw,
      hint: 'Add credits, fix billing, or raise project quota in the provider console, then rescan.',
    };
  }

  if (
    lower.includes('429') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests')
  ) {
    return {
      category: 'rate_limit',
      label: 'Rate limited',
      detail: raw,
      hint: 'Wait a few minutes and rescan, or reduce parallel API usage on this provider.',
    };
  }

  if (
    lower.includes('suspended') ||
    lower.includes('disabled') ||
    lower.includes('unavailable') ||
    lower.includes('overloaded') ||
    lower.includes('service unavailable') ||
    /\b503\b/.test(lower)
  ) {
    return {
      category: 'service_unavailable',
      label: 'Model service unavailable',
      detail: raw,
      hint: 'The provider may be down or your account is paused; check the provider status page and retry later.',
    };
  }

  if (
    lower.includes('forbidden') ||
    lower.includes('permission denied') ||
    lower.includes('access denied') ||
    (lower.includes('403') && !lower.includes('invalid_api_key'))
  ) {
    return {
      category: 'permission',
      label: 'Insufficient API permissions',
      detail: raw,
      hint: 'Enable list-models (or equivalent) scope for this key in the provider console.',
    };
  }

  if (
    lower.includes('invalid_api_key') ||
    lower.includes('incorrect api key') ||
    lower.includes('invalid api key') ||
    lower.includes('unauthorized') ||
    /\b401\b/.test(lower)
  ) {
    return {
      category: 'auth',
      label: 'API key rejected',
      detail: raw,
      hint: 'Check that this key belongs to the selected provider, is active, and has API access enabled.',
    };
  }

  if (
    lower.includes('fetch failed') ||
    lower.includes('network error') ||
    lower.includes('failed to connect') ||
    lower.includes('econnrefused') ||
    lower.includes('enotfound') ||
    lower.includes('dns') ||
    lower.includes('connection reset') ||
    lower.includes('timed out') ||
    lower.includes('timeout')
  ) {
    return {
      category: 'unreachable',
      label: 'Provider endpoint unreachable',
      detail: raw,
      hint: 'Check network access, VPN/proxy settings, or whether the local service is running.',
    };
  }

  if (
    lower.includes('invalid request') ||
    lower.includes('bad request') ||
    /\b400\b/.test(lower)
  ) {
    return {
      category: 'invalid_request',
      label: 'Invalid request to provider',
      detail: raw,
      hint: 'The validation request format may not match this provider; verify base URL and key type on Keys.',
    };
  }

  if (lower.includes('404') || lower.includes('not found')) {
    return {
      category: 'endpoint',
      label: 'Provider endpoint returned 404',
      detail: raw,
      hint: 'The validation endpoint or base URL may be wrong for this provider.',
    };
  }

  return {
    category: 'unknown',
    label: 'Validation failed',
    detail: raw,
    hint: 'Open the provider console and retry validation after checking the key and endpoint.',
  };
}

export function formatValidationFailure(reason: string | null | undefined): string {
  const summary = classifyValidationFailure(reason);
  return `${summary.label}: ${summary.hint}`;
}
