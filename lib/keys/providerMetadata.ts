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
 * `dynamicModels` takes precedence over the static `availableModels` list in
 * `llmProviders.ts` — once we've seen what the provider actually exposes for
 * this key, the static list becomes the fallback.
 */

const STORAGE_KEY = 'pm:keys-metadata';

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

export interface ValidationFailureSummary {
  category:
    | 'auth'
    | 'unreachable'
    | 'endpoint'
    | 'rate_limit'
    | 'quota'
    | 'empty'
    | 'unknown';
  label: string;
  detail: string;
  hint: string;
}

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
    return { models: meta.dynamicModels, isDynamic: true };
  }
  return { models: [...staticModels], isDynamic: false };
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

  if (lower.includes('no key configured') || lower.includes('api key is empty')) {
    return {
      category: 'empty',
      label: 'No key configured',
      detail: raw,
      hint: 'Import a key from .env or paste one in this provider sheet.',
    };
  }

  if (
    lower.includes('invalid_api_key') ||
    lower.includes('incorrect api key') ||
    lower.includes('invalid api key') ||
    lower.includes('unauthorized') ||
    lower.includes('401') ||
    lower.includes('403')
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

  if (lower.includes('404') || lower.includes('not found')) {
    return {
      category: 'endpoint',
      label: 'Provider endpoint returned 404',
      detail: raw,
      hint: 'The validation endpoint or base URL may be wrong for this provider.',
    };
  }

  if (lower.includes('429') || lower.includes('rate limit')) {
    return {
      category: 'rate_limit',
      label: 'Rate limited',
      detail: raw,
      hint: 'Wait and retry, or check the provider quota and rate-limit policy.',
    };
  }

  if (lower.includes('quota') || lower.includes('billing') || lower.includes('insufficient')) {
    return {
      category: 'quota',
      label: 'Quota or billing blocked',
      detail: raw,
      hint: 'Check billing, credits, quota, and project-level API permissions in the provider console.',
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
