import { describe, expect, it } from 'vitest';
import {
  effectiveParamValue,
  emptyAiSdksConfig,
  normalizeStore,
  validateParam,
} from '../lib/aiSdks/store';
import { getParamSpecs } from '../lib/aiSdks/catalog';
import {
  AI_SDKS_SHEET_SLUGS,
  DEFAULT_AI_SDKS_SHEET_SLUG,
  isAiSdksSheetSlug,
} from '../lib/aiSdks/sheetSlugs';
import { normalizeSheetOrder } from '../components/sheets/sheetOrder';

describe('normalizeStore', () => {
  it('returns an empty config for non-object input', () => {
    expect(normalizeStore(null)).toEqual(emptyAiSdksConfig());
    expect(normalizeStore('nope')).toEqual(emptyAiSdksConfig());
    expect(normalizeStore(42)).toEqual(emptyAiSdksConfig());
  });

  it('drops invalid param values and empty override maps', () => {
    const out = normalizeStore({
      models: {
        'openai:gpt-4o': { params: { temperature: 0.5, bogus: { nested: true }, top_p: 'x' }, enabled: true },
        'openai:o1': { params: {} },
      },
    });
    // Non-primitive values (objects) are dropped; primitives are kept for
    // validateParam to flag semantically later (no silent value loss).
    expect(out.models['openai:gpt-4o'].params).toEqual({ temperature: 0.5, top_p: 'x' });
    expect(out.models['openai:gpt-4o'].enabled).toBe(true);
    // override with no valid params keeps the entry but without a params key
    expect(out.models['openai:o1'].params).toBeUndefined();
  });

  it('dedupes custom models and categories', () => {
    const out = normalizeStore({
      customModels: [
        { providerId: 'openai', model: 'foo' },
        { id: 'openai:foo', providerId: 'openai', model: 'foo' },
        { providerId: 'openai', model: '' },
      ],
      customCategories: ['Embeddings', 'Embeddings', '  ', 'TTS'],
    });
    expect(out.customModels).toHaveLength(1);
    expect(out.customModels[0].id).toBe('openai:foo');
    expect(out.customCategories).toEqual(['Embeddings', 'TTS']);
  });
});

describe('validateParam', () => {
  const temp = getParamSpecs('openai').find((s) => s.key === 'temperature')!;
  const maxTokens = getParamSpecs('openai').find((s) => s.key === 'max_tokens')!;

  it('clamps out-of-range numbers', () => {
    expect(validateParam(temp, 5)).toMatchObject({ ok: false, clamped: 2 });
    expect(validateParam(temp, -1)).toMatchObject({ ok: false, clamped: 0 });
    expect(validateParam(temp, 0.7)).toEqual({ ok: true });
  });

  it('rounds non-integers for integer specs', () => {
    expect(validateParam(maxTokens, 10.4)).toMatchObject({ ok: false, clamped: 10 });
    expect(validateParam(maxTokens, 100)).toEqual({ ok: true });
  });

  it('treats empty value as unset', () => {
    expect(validateParam(maxTokens, null)).toMatchObject({ ok: true, clamped: null });
    expect(validateParam(temp, '')).toMatchObject({ ok: true, clamped: null });
  });
});

describe('effectiveParamValue', () => {
  const temp = getParamSpecs('anthropic').find((s) => s.key === 'temperature')!;

  it('falls back to the spec default when no override exists', () => {
    expect(effectiveParamValue(temp, undefined)).toBe(temp.default);
    expect(effectiveParamValue(temp, { params: {} })).toBe(temp.default);
  });

  it('returns the override when present', () => {
    expect(effectiveParamValue(temp, { params: { temperature: 0.3 } })).toBe(0.3);
  });
});

describe('aiSdks sheet slugs', () => {
  it('exposes one slug per registry provider with a valid default', () => {
    expect(AI_SDKS_SHEET_SLUGS.length).toBeGreaterThanOrEqual(14);
    expect(isAiSdksSheetSlug(DEFAULT_AI_SDKS_SHEET_SLUG)).toBe(true);
    expect(isAiSdksSheetSlug('not-a-provider')).toBe(false);
  });

  it('falls back to default order when stored order is invalid', () => {
    const def = [...AI_SDKS_SHEET_SLUGS];
    expect(normalizeSheetOrder('garbage', def)).toEqual(def);
    // unknown + duplicate ids are dropped, missing ones appended in default order
    const partial = normalizeSheetOrder(['openai', 'openai', 'ghost', 'anthropic'], def);
    expect(partial[0]).toBe('openai');
    expect(partial[1]).toBe('anthropic');
    expect(new Set(partial).size).toBe(def.length);
  });
});
