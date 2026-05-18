import { describe, it, expect } from 'vitest';
import { detectProviders } from '../lib/keys/detectProviders';
import { parseEnvText } from '../lib/keys/envParser';

describe('detectProviders', () => {
  it('maps recognised env vars to provider entries', () => {
    const entries = parseEnvText(
      `ANTHROPIC_API_KEY=sk-ant-${'a'.repeat(40)}\nOPENAI_API_KEY=sk-${'b'.repeat(40)}`,
    );
    const detected = detectProviders(entries);
    const ids = detected.map((d) => d.provider.id).sort();
    expect(ids).toEqual(['anthropic', 'openai']);
    expect(detected.every((d) => d.status === 'valid')).toBe(true);
  });

  it('honours envVarNames priority order', () => {
    // ANTHROPIC_API_KEY listed first in the registry — should win over the
    // legacy CLAUDE_API_KEY alias when both are present.
    const entries = parseEnvText(
      `CLAUDE_API_KEY=sk-ant-${'x'.repeat(40)}\nANTHROPIC_API_KEY=sk-ant-${'y'.repeat(40)}`,
    );
    const detected = detectProviders(entries);
    const anthropic = detected.find((d) => d.provider.id === 'anthropic');
    expect(anthropic?.envKey).toBe('ANTHROPIC_API_KEY');
  });

  it('flags pattern-mismatch but still surfaces the entry', () => {
    const entries = parseEnvText('ANTHROPIC_API_KEY=totally-not-a-real-key');
    const detected = detectProviders(entries);
    expect(detected).toHaveLength(1);
    expect(detected[0].status).toBe('pattern-mismatch');
  });

  it('returns nothing when no registered names appear', () => {
    const entries = parseEnvText('SOME_OTHER_VAR=value');
    expect(detectProviders(entries)).toEqual([]);
  });
});
