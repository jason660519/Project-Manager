import { describe, expect, it, vi } from 'vitest';

import { PROVIDERS } from '../../../../lib/keys/registry';
import {
  mergeValidationMetadata,
  runInferenceProbeAfterValidation,
  shouldRunInferenceProbe,
} from '../../../../lib/keys/validationProbe';

vi.mock('../../../../lib/bridge', () => ({
  probeProviderInference: vi.fn(async () => ({
    ok: true,
    model: 'gpt-4o-mini',
    latencyMs: 420,
    ttftMs: 180,
    errorReason: null,
  })),
}));

describe('F56 validation probe orchestration', () => {
  const openai = PROVIDERS.find((p) => p.id === 'openai');
  const github = PROVIDERS.find((p) => p.id === 'github');

  it('skips probe for GitHub integration provider', () => {
    expect(github).toBeTruthy();
    expect(shouldRunInferenceProbe(github!, true)).toBe(false);
  });

  it('runs probe for AI provider after list-models ok', () => {
    expect(openai).toBeTruthy();
    expect(shouldRunInferenceProbe(openai!, true)).toBe(true);
  });

  it('merges probe metadata into validation metadata', async () => {
    expect(openai).toBeTruthy();
    const outcome = await runInferenceProbeAfterValidation({
      provider: openai!,
      apiKey: 'sk-test',
      dynamicModels: ['gpt-4o-mini'],
    });
    const merged = mergeValidationMetadata({
      base: {
        lastValidatedAt: '2026-06-21T00:00:00.000Z',
        status: 'ok',
        dynamicModels: ['gpt-4o-mini'],
      },
      probePatch: outcome.metadataPatch,
    });
    expect(merged.probeResult?.status).toBe('ok');
    expect(merged.probeResult?.ttftMs).toBe(180);
  });
});
