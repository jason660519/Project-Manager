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

  it('supports caller-provided provider lists for import profiles', () => {
    const entries = parseEnvText(`MY_OPENAI_KEY=sk-${'b'.repeat(40)}\nOPENAI_API_KEY=sk-${'c'.repeat(40)}`);
    const openai = detectProviders(parseEnvText(`OPENAI_API_KEY=sk-${'c'.repeat(40)}`))
      .find((d) => d.provider.id === 'openai')?.provider;
    expect(openai).toBeDefined();

    const detected = detectProviders(entries, [
      { ...openai!, envVarNames: ['MY_OPENAI_KEY'] },
    ]);

    expect(detected).toHaveLength(1);
    expect(detected[0].provider.id).toBe('openai');
    expect(detected[0].envKey).toBe('MY_OPENAI_KEY');
  });

  it('detects new provider keys from generated provider aliases', () => {
    const entries = parseEnvText([
      `MISTRAL_AI_API_KEY=sk-mistral-${'m'.repeat(30)}`,
      `COHERE_TRIAL_KEY=cohere-trial-${'c'.repeat(30)}`,
      `AZURE_OPENAI_API_KEY=${'a'.repeat(32)}`,
      `GROQ_API_KEY=gsk_${'g'.repeat(32)}`,
    ].join('\n'));

    const detected = detectProviders(entries);
    const byProvider = new Map(detected.map((item) => [item.provider.id, item]));

    expect(byProvider.get('mistral')?.envKey).toBe('MISTRAL_AI_API_KEY');
    expect(byProvider.get('mistral')?.matchSource).toBe('generated');
    expect(byProvider.get('cohere')?.envKey).toBe('COHERE_TRIAL_KEY');
    expect(byProvider.get('cohere')?.matchSource).toBe('generated');
    expect(byProvider.get('azure-openai')?.envKey).toBe('AZURE_OPENAI_API_KEY');
    expect(byProvider.get('azure-openai')?.matchSource).toBe('explicit');
    expect(byProvider.get('groq')?.envKey).toBe('GROQ_API_KEY');
    expect(byProvider.get('groq')?.matchSource).toBe('explicit');
  });

  it('reports credential-like env vars that no enabled provider matched', async () => {
    const { findUndetectedProviderEnvKeys } = await import('../lib/keys/detectProviders');
    const entries = parseEnvText([
      `OPENAI_API_KEY=sk-${'b'.repeat(40)}`,
      'FUTURE_PROVIDER_API_KEY=future-test-key',
    ].join('\n'));
    const detected = detectProviders(entries);

    expect(findUndetectedProviderEnvKeys(entries, detected)).toEqual([
      {
        key: 'FUTURE_PROVIDER_API_KEY',
        line: 2,
        reason: 'No enabled provider alias matched this credential-like env var.',
      },
    ]);
  });
});
