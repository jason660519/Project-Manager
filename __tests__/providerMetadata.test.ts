/**
 * Unit tests for the localStorage-backed provider validation metadata layer.
 * These guards exist so a future refactor (e.g. swapping the storage key
 * format or relocating to disk) can't silently break the Keys page contract.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearProviderMetadata,
  classifyValidationFailure,
  computeValidatedModelSupportSummary,
  formatRelativeTime,
  formatValidationFailure,
  loadAllProviderMetadata,
  loadValidatedModelSupportSummary,
  loadProviderMetadata,
  maskKey,
  resolveModelList,
  saveProviderMetadata,
} from '../lib/keys/providerMetadata';

// Minimal localStorage shim — Vitest's jsdom env is on by default but we
// reset it between tests to keep cases isolated.
function resetStorage() {
  if (typeof window !== 'undefined') {
    window.localStorage.clear();
  }
}

describe('providerMetadata storage', () => {
  beforeEach(() => {
    resetStorage();
  });

  it('returns empty map and null when nothing has been saved', () => {
    expect(loadAllProviderMetadata()).toEqual({});
    expect(loadProviderMetadata('anthropic')).toBeNull();
  });

  it('round-trips a successful validation entry', () => {
    const now = new Date('2026-05-01T00:00:00Z').toISOString();
    saveProviderMetadata('anthropic', {
      lastValidatedAt: now,
      status: 'ok',
      dynamicModels: ['claude-sonnet-4-6', 'claude-haiku-4-5'],
    });
    const meta = loadProviderMetadata('anthropic');
    expect(meta).not.toBeNull();
    expect(meta?.status).toBe('ok');
    expect(meta?.dynamicModels).toEqual(['claude-sonnet-4-6', 'claude-haiku-4-5']);
    expect(meta?.lastValidatedAt).toBe(now);

    const support = loadValidatedModelSupportSummary();
    expect(support?.providers).toEqual([
      { providerId: 'anthropic', models: ['claude-sonnet-4-6', 'claude-haiku-4-5'] },
    ]);
    expect(support?.totalModelCount).toBe(2);
    expect(support?.uniqueModelCount).toBe(2);
  });

  it('round-trips a failure entry with reason', () => {
    saveProviderMetadata('openai', {
      lastValidatedAt: '2026-05-01T00:00:00Z',
      status: 'fail',
      errorReason: '401: Invalid API key',
    });
    const meta = loadProviderMetadata('openai');
    expect(meta?.status).toBe('fail');
    expect(meta?.errorReason).toBe('401: Invalid API key');
    expect(meta?.dynamicModels).toBeUndefined();
  });

  it('clears an entry by id without disturbing siblings', () => {
    saveProviderMetadata('anthropic', { lastValidatedAt: 't1', status: 'ok' });
    saveProviderMetadata('openai', { lastValidatedAt: 't2', status: 'ok' });
    clearProviderMetadata('anthropic');
    expect(loadProviderMetadata('anthropic')).toBeNull();
    expect(loadProviderMetadata('openai')).not.toBeNull();

    const support = loadValidatedModelSupportSummary();
    expect(support?.providers).toEqual([]);
    expect(support?.totalModelCount).toBe(0);
  });

  it('survives corrupted JSON by returning an empty map', () => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('pm:keys-metadata', '{not json');
    expect(loadAllProviderMetadata()).toEqual({});
  });
});

describe('computeValidatedModelSupportSummary', () => {
  it('counts ok providers with non-empty model lists only', () => {
    const summary = computeValidatedModelSupportSummary({
      anthropic: { lastValidatedAt: 't', status: 'ok', dynamicModels: ['a', 'a', 'b'] },
      openai: { lastValidatedAt: 't', status: 'fail', errorReason: '401' },
      gemini: { lastValidatedAt: 't', status: 'ok', dynamicModels: [] },
    });
    expect(summary.totalModelCount).toBe(2);
    expect(summary.uniqueModelCount).toBe(2);
    expect(summary.providers).toEqual([{ providerId: 'anthropic', models: ['a', 'b'] }]);
    expect(summary.uniqueModels).toEqual(['a', 'b']);
  });
});

describe('resolveModelList', () => {
  beforeEach(() => {
    resetStorage();
  });

  it('uses static list when no metadata exists', () => {
    const result = resolveModelList('anthropic', ['claude-static-1']);
    expect(result.isDynamic).toBe(false);
    expect(result.models).toEqual(['claude-static-1']);
  });

  it('uses dynamic list when metadata.ok has models', () => {
    saveProviderMetadata('anthropic', {
      lastValidatedAt: 't',
      status: 'ok',
      dynamicModels: ['claude-live-1', 'claude-live-2'],
    });
    const result = resolveModelList('anthropic', ['claude-static-1']);
    expect(result.isDynamic).toBe(true);
    expect(result.models).toEqual(['claude-live-1', 'claude-live-2']);
  });

  it('falls back to static when metadata is failure', () => {
    saveProviderMetadata('anthropic', {
      lastValidatedAt: 't',
      status: 'fail',
      errorReason: '401',
    });
    const result = resolveModelList('anthropic', ['claude-static-1']);
    expect(result.isDynamic).toBe(false);
    expect(result.models).toEqual(['claude-static-1']);
  });
});

describe('formatRelativeTime', () => {
  it('returns em-dash for null / undefined / unparseable input', () => {
    expect(formatRelativeTime(null)).toBe('—');
    expect(formatRelativeTime(undefined)).toBe('—');
    expect(formatRelativeTime('not a date')).toBe('—');
  });

  it('returns "just now" for recent times', () => {
    const now = new Date().toISOString();
    expect(formatRelativeTime(now)).toBe('just now');
  });

  it('returns Nm ago / Nh ago / Nd ago at boundaries', () => {
    const make = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();
    expect(formatRelativeTime(make(5 * 60_000))).toBe('5m ago');
    expect(formatRelativeTime(make(3 * 60 * 60_000))).toBe('3h ago');
    expect(formatRelativeTime(make(2 * 24 * 60 * 60_000))).toBe('2d ago');
  });

  it('falls back to ISO date for entries older than a week', () => {
    // 30 days ago
    const old = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();
    expect(formatRelativeTime(old)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('maskKey', () => {
  it('returns null for empty / null input', () => {
    expect(maskKey(null)).toBeNull();
    expect(maskKey(undefined)).toBeNull();
    expect(maskKey('')).toBeNull();
  });

  it('uses first-3 ... last-3 form for long keys', () => {
    expect(maskKey('sk-ant-abcdefghijklmnop')).toBe('sk-***nop');
  });

  it('collapses short keys to first-char + ***', () => {
    expect(maskKey('short')).toBe('s***');
  });
});

describe('validation failure classification', () => {
  it('classifies invalid keys as auth failures', () => {
    const failure = classifyValidationFailure('Provider 401: invalid_api_key');
    expect(failure.category).toBe('auth');
    expect(failure.label).toBe('API key rejected');
    expect(formatValidationFailure('Provider 401: invalid_api_key')).toMatch(/API key rejected/);
  });

  it('classifies fetch failures as unreachable endpoints', () => {
    const failure = classifyValidationFailure('fetch failed');
    expect(failure.category).toBe('unreachable');
    expect(failure.label).toBe('Provider endpoint unreachable');
  });

  it('classifies 404 errors as endpoint problems', () => {
    const failure = classifyValidationFailure('Provider 404: Not Found');
    expect(failure.category).toBe('endpoint');
    expect(failure.label).toBe('Provider endpoint returned 404');
  });
});
