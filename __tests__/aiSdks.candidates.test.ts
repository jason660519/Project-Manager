import { describe, expect, it } from 'vitest';
import { listCandidateModels } from '../lib/aiSdks/candidates';
import { emptyAiSdksConfig } from '../lib/aiSdks/store';
import { buildModelCatalog } from '../lib/aiSdks/catalog';
import { modelRowId } from '../lib/aiSdks/uuid';

describe('listCandidateModels', () => {
  it('returns nothing when no model is flagged', () => {
    expect(listCandidateModels(emptyAiSdksConfig())).toEqual([]);
  });

  it('returns only catalog models flagged candidate, with resolved labels', () => {
    const row = buildModelCatalog().find((r) => r.providerId === 'anthropic')!;
    const store = { ...emptyAiSdksConfig(), models: { [row.id]: { candidate: true } } };
    const out = listCandidateModels(store);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: row.id, providerId: row.providerId, model: row.model });
    expect(out[0].providerLabel).toBeTruthy();
  });

  it('includes flagged custom models and ignores non-candidates', () => {
    const customId = modelRowId('openai', 'my-ft');
    const store = {
      ...emptyAiSdksConfig(),
      models: { [customId]: { candidate: true }, [modelRowId('openai', 'gpt-4o')]: { candidate: false } },
      customModels: [{ id: customId, providerId: 'openai' as const, model: 'my-ft' }],
    };
    const out = listCandidateModels(store);
    expect(out.some((c) => c.id === customId && c.model === 'my-ft')).toBe(true);
    expect(out.every((c) => c.id !== modelRowId('openai', 'gpt-4o'))).toBe(true);
  });
});
