/**
 * Tests for the expanded LLM provider registry that covers every API-compatible
 * provider PM knows how to talk to. We assert *structural* invariants rather
 * than enumerate exact metadata so the registry can grow without churning
 * dozens of tests.
 */

import { describe, expect, it } from 'vitest';
import {
  getLlmProvider,
  getLlmProviderIds,
  listLlmProviders,
  type LlmProviderId,
} from '../lib/keys/llmProviders';

describe('LLM provider registry', () => {
  const ids = getLlmProviderIds();

  it('includes the three native-API providers', () => {
    expect(ids).toContain('anthropic');
    expect(ids).toContain('openai');
    expect(ids).toContain('gemini');
  });

  it('includes the OpenAI-compatible providers seen in real .env files', () => {
    const required: LlmProviderId[] = [
      'deepseek',
      'grok',
      'kimi',
      'openrouter',
      'perplexity',
      'together',
      'zhipu',
      'qwen',
    ];
    for (const id of required) {
      expect(ids, `${id} should be registered`).toContain(id);
    }
  });

  it('exposes apiKind / keychainKey / lsKey / envVarNames / official URLs on every provider', () => {
    for (const spec of listLlmProviders()) {
      expect(spec.id, `provider ${spec.id} has id`).toBeTruthy();
      expect(spec.label).toBeTruthy();
      expect(spec.placeholder).toBeTruthy();
      expect(spec.keychainKey).toMatch(/-api-key|-token$/);
      expect(spec.lsKey.startsWith('projectManager-key:')).toBe(true);
      expect(spec.envVarNames.length).toBeGreaterThan(0);
      expect(spec.docUrl.startsWith('https://')).toBe(true);
      expect(spec.apiKeyUrl).toMatch(/^https?:\/\//);
      expect(spec.usageUrl).toMatch(/^https?:\/\//);
      expect(spec.developerDocsUrl).toMatch(/^https?:\/\//);
      expect(['anthropic', 'gemini', 'openai-compatible']).toContain(spec.apiKind);
      expect(spec.defaultModel).toBeTruthy();
    }
  });

  it('attaches a base URL to every openai-compatible provider', () => {
    for (const spec of listLlmProviders()) {
      if (spec.apiKind !== 'openai-compatible') continue;
      expect(spec.baseUrl, `${spec.id} needs baseUrl`).toBeTruthy();
      // Public providers must be HTTPS; local-loopback (Ollama Local etc.)
      // legitimately runs over plain HTTP on 127.0.0.1 / localhost.
      const url = spec.baseUrl!;
      const isHttps = url.startsWith('https://');
      const isLoopback =
        url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1');
      expect(
        isHttps || isLoopback,
        `${spec.id} baseUrl must be https or loopback (got ${url})`,
      ).toBe(true);
    }
  });

  it('keeps keychainKey + lsKey unique across providers', () => {
    const keychainKeys = new Set<string>();
    const lsKeys = new Set<string>();
    for (const spec of listLlmProviders()) {
      expect(keychainKeys.has(spec.keychainKey)).toBe(false);
      expect(lsKeys.has(spec.lsKey)).toBe(false);
      keychainKeys.add(spec.keychainKey);
      lsKeys.add(spec.lsKey);
    }
  });

  it('keeps env var names disjoint so .env import never assigns one value to two providers', () => {
    const seen = new Map<string, LlmProviderId>();
    for (const spec of listLlmProviders()) {
      for (const env of spec.envVarNames) {
        const owner = seen.get(env);
        expect(owner, `env var ${env} is claimed by both ${owner} and ${spec.id}`).toBeUndefined();
        seen.set(env, spec.id);
      }
    }
  });

  it('returns undefined for unknown ids via getLlmProvider', () => {
    expect(getLlmProvider('nonexistent-provider' as LlmProviderId)).toBeUndefined();
  });

  it('returns a spec by id', () => {
    const spec = getLlmProvider('anthropic');
    expect(spec).toBeDefined();
    expect(spec?.apiKind).toBe('anthropic');
  });

  it('exposes availableModels[] for every provider with the defaultModel inside it', () => {
    for (const spec of listLlmProviders()) {
      expect(spec.availableModels, `${spec.id} needs availableModels`).toBeDefined();
      expect(spec.availableModels.length).toBeGreaterThan(0);
      expect(
        spec.availableModels,
        `${spec.id}.defaultModel "${spec.defaultModel}" should appear in availableModels`,
      ).toContain(spec.defaultModel);
    }
  });
});
