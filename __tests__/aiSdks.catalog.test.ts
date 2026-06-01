import { describe, expect, it } from 'vitest';
import {
  buildModelCatalog,
  buildProviderModelCatalog,
  getParamSpecs,
  inferModelType,
} from '../lib/aiSdks/catalog';
import { getLlmProviderIds } from '../lib/keys/llmProviders';

describe('aiSdks catalog', () => {
  it('builds a globally-unique id for every model row', () => {
    const rows = buildModelCatalog();
    const ids = rows.map((r) => r.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    // id format is `${providerId}:${model}`
    rows.forEach((r) => expect(r.id).toBe(`${r.providerId}:${r.model}`));
  });

  it('covers every registry provider with at least one parameter column', () => {
    for (const id of getLlmProviderIds()) {
      expect(getParamSpecs(id).length).toBeGreaterThan(0);
      expect(buildProviderModelCatalog(id).length).toBeGreaterThan(0);
    }
  });

  it('uses the protocol-appropriate parameter surface', () => {
    // Anthropic exposes top_k + stop_sequences; OpenAI-compatible exposes penalties.
    const anthropicKeys = getParamSpecs('anthropic').map((s) => s.key);
    expect(anthropicKeys).toContain('top_k');
    expect(anthropicKeys).toContain('stop_sequences');
    const openaiKeys = getParamSpecs('openai').map((s) => s.key);
    expect(openaiKeys).toContain('frequency_penalty');
    expect(openaiKeys).toContain('presence_penalty');
    const geminiKeys = getParamSpecs('gemini').map((s) => s.key);
    expect(geminiKeys).toContain('maxOutputTokens');
    expect(geminiKeys).toContain('topK');
  });

  it('infers a sensible default classification from the model id', () => {
    expect(inferModelType('gpt-image-2')).toBe('VLM');
    expect(inferModelType('qwen-coder-plus')).toBe('Coding Agent');
    expect(inferModelType('claude-sonnet-4-6')).toBe('LLM');
  });
});
