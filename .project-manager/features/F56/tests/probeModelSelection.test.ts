import { describe, expect, it } from 'vitest';

import { getLlmProvider } from '../../../../lib/keys/llmProviders';
import { resolveProbeModelForProvider } from '../../../../lib/keys/probeModelSelection';

describe('F56 probe model selection', () => {
  it('prefers dynamic preferred model for OpenAI', () => {
    const spec = getLlmProvider('openai');
    expect(
      resolveProbeModelForProvider('openai', ['gpt-4o-mini', 'gpt-4o'], spec),
    ).toBe('gpt-4o-mini');
  });

  it('falls back to static preferred model when dynamic list is empty', () => {
    const spec = getLlmProvider('anthropic');
    expect(resolveProbeModelForProvider('anthropic', [], spec)).toBe('claude-haiku-4-5-20251001');
  });

  it('returns null for unknown provider', () => {
    expect(resolveProbeModelForProvider('not-a-provider', ['x'], undefined)).toBeNull();
  });
});
