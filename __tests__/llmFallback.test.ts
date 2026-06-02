/**
 * Unit tests for LLM fallback chain logic.
 *
 * isModelNotFoundError — pure string classifier, no I/O.
 * callLlmWithFallback  — Tauri-only; tests mock @tauri-apps/api/core invoke
 *                        and the __TAURI_INTERNALS__ window flag.
 *
 * Provider fixture used throughout: openai (gpt-5.5 → tier gpt-4o) and
 * anthropic (claude-sonnet-4-6 → tier also claude-sonnet-4-6, so no tier
 * attempt is triggered unless we pass a different modelId like claude-opus-4-7).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callLlmRouted, callLlmWithFallback, isModelNotFoundError } from '../lib/bridge';

// ── @tauri-apps/api/core mock ─────────────────────────────────────────────────
// The bridge imports `invoke` lazily inside every async function via
// `const { invoke: tauriInvoke } = await import('@tauri-apps/api/core')`.
// vi.mock intercepts both static and dynamic imports, so this covers all paths.
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// ── helpers ───────────────────────────────────────────────────────────────────
const TAURI_FLAG = Symbol('__tauri_internals__');
const MESSAGES = [{ role: 'user' as const, content: 'ping' }];

/** Minimal successful AnthropicResponse shape returned by call_anthropic etc. */
const makeOkResponse = (content = 'ok') => ({
  content,
  inputTokens: 10,
  outputTokens: 5,
});

function enableTauri(): void {
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = TAURI_FLAG;
}
function disableTauri(): void {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
}

// ═══════════════════════════════════════════════════════════════════════════════
// isModelNotFoundError
// ═══════════════════════════════════════════════════════════════════════════════

describe('isModelNotFoundError', () => {
  describe('returns true for model-not-found patterns', () => {
    it.each([
      'model_not_found',
      'model not found',
      'no such model',
      'does not exist',
      'unknown model',
      'invalid model',
      'not_found',
      // Gemini HTTP 404 patterns
      'HTTP 404: model gpt-xyz is unavailable',
      '404 not found in model registry',
      // Case-insensitive
      'MODEL NOT FOUND',
      'Invalid Model gpt-x-preview',
      'Unknown Model: claude-opus-99',
    ])('%s', (err) => {
      expect(isModelNotFoundError(err)).toBe(true);
    });
  });

  describe('returns false for transient / unrelated errors', () => {
    it.each([
      'rate limit exceeded',
      'rate_limit_exceeded',
      'too many requests',
      'network error: connection refused',
      'authentication failed',
      'invalid api key',
      '401 unauthorized',
      '403 forbidden',
      '500 internal server error',
      'context length exceeded',
      'content policy violation',
      'timeout after 30s',
      '',
      'oops something went wrong',
    ])('%s', (err) => {
      expect(isModelNotFoundError(err)).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// callLlmWithFallback
// ═══════════════════════════════════════════════════════════════════════════════

describe('callLlmWithFallback', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    enableTauri();
  });

  afterEach(() => {
    disableTauri();
  });

  // ── guard ──────────────────────────────────────────────────────────────────

  it('throws when not in Tauri runtime', async () => {
    disableTauri();
    await expect(
      callLlmWithFallback({
        primary: { providerId: 'anthropic', modelId: 'claude-sonnet-4-6' },
        messages: MESSAGES,
      }),
    ).rejects.toThrow(/Tauri/);
  });

  // ── happy path ─────────────────────────────────────────────────────────────

  it('returns result from primary on first success', async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_secret') return 'sk-ant-test';
      if (cmd === 'call_anthropic') return makeOkResponse('hello from claude');
    });

    const result = await callLlmWithFallback({
      primary: { providerId: 'anthropic', modelId: 'claude-sonnet-4-6' },
      messages: MESSAGES,
    });

    expect(result.content).toBe('hello from claude');
    expect(result.usedProviderId).toBe('anthropic');
    expect(result.usedModelId).toBe('claude-sonnet-4-6');
    expect(result.inputTokens).toBe(10);
    expect(result.outputTokens).toBe(5);
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0]).toMatchObject({
      providerId: 'anthropic',
      modelId: 'claude-sonnet-4-6',
      outcome: 'success',
    });
  });

  // ── tier model (model-not-found) ───────────────────────────────────────────

  it('primary model-not-found → tries tierModel, succeeds', async () => {
    // openai: primaryModel gpt-5.5 → tierModel gpt-4o
    mockInvoke.mockImplementation(async (cmd: string, args: Record<string, unknown>) => {
      if (cmd === 'get_secret') return 'sk-openai-test';
      if (cmd === 'call_openai_compatible') {
        if (args['model'] === 'gpt-5.5') throw new Error('model_not_found: gpt-5.5');
        if (args['model'] === 'gpt-4o') return makeOkResponse('gpt-4o response');
      }
    });

    const result = await callLlmWithFallback({
      primary: { providerId: 'openai', modelId: 'gpt-5.5' },
      messages: MESSAGES,
    });

    expect(result.content).toBe('gpt-4o response');
    expect(result.usedProviderId).toBe('openai');
    expect(result.usedModelId).toBe('gpt-4o');
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[0]).toMatchObject({
      providerId: 'openai',
      modelId: 'gpt-5.5',
      outcome: 'failed',
    });
    expect(result.attempts[1]).toMatchObject({
      providerId: 'openai',
      modelId: 'gpt-4o',
      outcome: 'success',
    });
  });

  it('primary model-not-found + tier also fails → tries next chain entry', async () => {
    // openai primary + tier both fail with model-not-found → anthropic succeeds
    mockInvoke.mockImplementation(async (cmd: string, args: Record<string, unknown>) => {
      if (cmd === 'get_secret') {
        if (String(args['key']).startsWith('openai')) return 'sk-openai-test';
        if (String(args['key']).startsWith('anthropic')) return 'sk-ant-test';
        return null;
      }
      if (cmd === 'call_openai_compatible') {
        throw new Error(`model not found: ${String(args['model'])} does not exist`);
      }
      if (cmd === 'call_anthropic') {
        return makeOkResponse('anthropic-fallback');
      }
    });

    const result = await callLlmWithFallback({
      primary: { providerId: 'openai', modelId: 'gpt-5.5' },
      fallbacks: [{ providerId: 'anthropic', modelId: 'claude-sonnet-4-6' }],
      messages: MESSAGES,
    });

    expect(result.usedProviderId).toBe('anthropic');
    expect(result.content).toBe('anthropic-fallback');
    // attempts: openai/gpt-5.5 failed, openai/gpt-4o failed, anthropic/claude-sonnet-4-6 success
    expect(result.attempts).toHaveLength(3);
    expect(result.attempts[0]).toMatchObject({ providerId: 'openai', modelId: 'gpt-5.5', outcome: 'failed' });
    expect(result.attempts[1]).toMatchObject({ providerId: 'openai', modelId: 'gpt-4o', outcome: 'failed' });
    expect(result.attempts[2]).toMatchObject({ providerId: 'anthropic', outcome: 'success' });
  });

  // ── transient error (skip tier) ────────────────────────────────────────────

  it('primary transient error → skips tier, jumps to next chain entry', async () => {
    const openaiCallModels: string[] = [];

    mockInvoke.mockImplementation(async (cmd: string, args: Record<string, unknown>) => {
      if (cmd === 'get_secret') {
        if (String(args['key']).startsWith('openai')) return 'sk-openai-test';
        if (String(args['key']).startsWith('anthropic')) return 'sk-ant-test';
        return null;
      }
      if (cmd === 'call_openai_compatible') {
        openaiCallModels.push(String(args['model']));
        throw new Error('rate limit exceeded — please retry after 60s');
      }
      if (cmd === 'call_anthropic') {
        return makeOkResponse('anthropic-result');
      }
    });

    const result = await callLlmWithFallback({
      primary: { providerId: 'openai', modelId: 'gpt-5.5' },
      fallbacks: [{ providerId: 'anthropic', modelId: 'claude-sonnet-4-6' }],
      messages: MESSAGES,
    });

    expect(result.usedProviderId).toBe('anthropic');
    // gpt-4o (tierModel) should NOT have been tried — only gpt-5.5
    expect(openaiCallModels).toEqual(['gpt-5.5']);
    // attempts: openai/gpt-5.5 failed (no tier), anthropic success
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[0]).toMatchObject({ providerId: 'openai', modelId: 'gpt-5.5', outcome: 'failed' });
    expect(result.attempts[1]).toMatchObject({ providerId: 'anthropic', outcome: 'success' });
  });

  // ── exhausted chain ────────────────────────────────────────────────────────

  it('all entries fail → throws with summary message', async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_secret') return 'sk-test';
      // Transient errors — no tier attempts
      throw new Error('service unavailable');
    });

    await expect(
      callLlmWithFallback({
        primary: { providerId: 'anthropic', modelId: 'claude-sonnet-4-6' },
        fallbacks: [{ providerId: 'openai', modelId: 'gpt-5.5' }],
        messages: MESSAGES,
      }),
    ).rejects.toThrow(/All models in fallback chain failed/);
  });

  // ── missing API key ────────────────────────────────────────────────────────

  it('entry with no API key → marks failed, continues to next', async () => {
    mockInvoke.mockImplementation(async (cmd: string, args: Record<string, unknown>) => {
      if (cmd === 'get_secret') {
        // openai has no key stored (null); anthropic has one
        if (String(args['key']).startsWith('openai')) return null;
        if (String(args['key']).startsWith('anthropic')) return 'sk-ant-test';
        return null;
      }
      if (cmd === 'call_anthropic') return makeOkResponse('ok-from-anthropic');
    });

    const result = await callLlmWithFallback({
      primary: { providerId: 'openai', modelId: 'gpt-5.5' },
      fallbacks: [{ providerId: 'anthropic', modelId: 'claude-sonnet-4-6' }],
      messages: MESSAGES,
    });

    expect(result.usedProviderId).toBe('anthropic');
    expect(result.content).toBe('ok-from-anthropic');
    expect(result.attempts[0]).toMatchObject({
      providerId: 'openai',
      outcome: 'failed',
      error: 'No API key stored',
    });
  });

  // ── attempt log completeness ───────────────────────────────────────────────

  it('attempt log includes both primary and tier attempt when model-not-found', async () => {
    // Both gpt-5.5 and tier gpt-4o fail with model-not-found → chain exhausted
    mockInvoke.mockImplementation(async (cmd: string, args: Record<string, unknown>) => {
      if (cmd === 'get_secret') return 'sk-openai-test';
      if (cmd === 'call_openai_compatible') {
        throw new Error(`model not found: ${String(args['model'])} is unknown`);
      }
    });

    await expect(
      callLlmWithFallback({
        primary: { providerId: 'openai', modelId: 'gpt-5.5' },
        messages: MESSAGES,
      }),
    ).rejects.toThrow();

    // Verify both primary and tier models were called
    const openaiCalls = (mockInvoke.mock.calls as Array<[string, Record<string, unknown>]>).filter(
      (call) => call[0] === 'call_openai_compatible',
    );
    expect(openaiCalls).toHaveLength(2);
    expect(openaiCalls[0][1]['model']).toBe('gpt-5.5');
    expect(openaiCalls[1][1]['model']).toBe('gpt-4o');
  });

  // ── unknown provider ───────────────────────────────────────────────────────

  it('unknown providerId → marks entry as failed, continues', async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_secret') return 'sk-ant-test';
      if (cmd === 'call_anthropic') return makeOkResponse('claude-ok');
    });

    const result = await callLlmWithFallback({
      primary: { providerId: 'nonexistent-provider' as Parameters<typeof callLlmWithFallback>[0]['primary']['providerId'], modelId: 'whatever' },
      fallbacks: [{ providerId: 'anthropic', modelId: 'claude-sonnet-4-6' }],
      messages: MESSAGES,
    });

    expect(result.usedProviderId).toBe('anthropic');
    expect(result.attempts[0]).toMatchObject({
      providerId: 'nonexistent-provider',
      outcome: 'failed',
      error: 'Unknown provider',
    });
  });
});

describe('callLlmRouted', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    enableTauri();
  });

  afterEach(() => {
    disableTauri();
  });

  it('throws when not in Tauri runtime', async () => {
    disableTauri();
    await expect(
      callLlmRouted({
        modelAlias: 'pm-code',
        messages: MESSAGES,
      }),
    ).rejects.toThrow(/Tauri/);
  });

  it('passes alias, explicit first candidate, and custom candidates to Rust', async () => {
    mockInvoke.mockResolvedValue({
      content: 'routed',
      inputTokens: 3,
      outputTokens: 4,
      provider: 'openai',
      model: 'gpt-4o',
      routeDecision: {
        routeDecisionId: 'route-test',
        modelAlias: 'pm-code',
        strategy: 'deterministic-fallback-v1',
        selectedProvider: 'openai',
        selectedModel: 'gpt-4o',
        degraded: false,
        attempts: [{ provider: 'openai', model: 'gpt-4o', status: 'success' }],
      },
    });

    const result = await callLlmRouted({
      modelAlias: 'pm-code',
      taskClass: 'chat',
      provider: 'openai',
      model: 'gpt-4o',
      candidates: [{ provider: 'anthropic', model: 'claude-sonnet-4-6' }],
      messages: MESSAGES,
      maxTokens: 1234,
      systemPrompt: 'system',
      temperature: 0.2,
    });

    expect(result.provider).toBe('openai');
    expect(result.routeDecision.routeDecisionId).toBe('route-test');
    expect(mockInvoke).toHaveBeenCalledWith('call_llm_routed', {
      modelAlias: 'pm-code',
      taskClass: 'chat',
      provider: 'openai',
      model: 'gpt-4o',
      candidates: [{ provider: 'anthropic', model: 'claude-sonnet-4-6' }],
      maxTokens: 1234,
      messages: MESSAGES,
      systemPrompt: 'system',
      temperature: 0.2,
      attachments: null,
    });
  });
});
