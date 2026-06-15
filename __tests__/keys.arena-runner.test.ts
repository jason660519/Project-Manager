import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ArenaTransportError,
  preflightArenaRequests,
  runArenaComparison,
  type ArenaRunRequest,
  type ArenaTransport,
} from '../app/ui/views/Keys/arenaRunner';
import { buildLlmArenaResultRow } from '../app/ui/views/Keys/LlmArenaEvaluation';

/**
 * F50 Phase 2 (tdd-spec Suite D): the arena execution engine. Everything runs
 * against an injected mock transport — no real API, no Tauri bridge.
 */

vi.mock('../lib/keys/loadProviderKey', () => ({
  loadProviderKey: vi.fn(async () => 'sk-test'),
  hasProviderKey: vi.fn(async () => true),
}));
vi.mock('../lib/scanner/runProjectScan', () => ({
  callSingleProvider: vi.fn(async () => {
    throw new Error('real bridge must not be reached in runner tests');
  }),
}));

function request(overrides: Partial<ArenaRunRequest> = {}): ArenaRunRequest {
  return {
    provider: 'openai',
    model: 'gpt-x',
    systemPrompt: 'sys',
    userPrompt: 'hello',
    ...overrides,
  };
}

function okTransport(
  reply: Partial<{ content: string; model: string; inputTokens: number; outputTokens: number }> = {},
): ArenaTransport {
  return {
    capabilities: { text: true, image: true },
    call: vi.fn(async () => ({
      content: reply.content ?? 'answer',
      model: reply.model ?? 'effective-model',
      httpStatus: 200,
      inputTokens: reply.inputTokens,
      outputTokens: reply.outputTokens,
    })),
  };
}

const FRESH = () => new Date().toISOString();

describe('arenaRunner (Suite D)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('D1: outcomes compose into a complete LlmArenaResultRow contract row', async () => {
    const [outcome] = await runArenaComparison([request()], {
      transport: okTransport({ inputTokens: 11, outputTokens: 22 }),
      loadKey: async () => 'sk-test',
    });

    expect(outcome.runId).toMatch(/^pm-arena-/);
    expect(outcome.trialIndex).toBe(0);
    expect(outcome.httpStatus).toBe(200);
    expect(outcome.retryCount).toBe(0);
    expect(outcome.tokenSource).toBe('measured');

    const row = buildLlmArenaResultRow({
      runId: outcome.runId,
      provider: outcome.provider,
      model: outcome.model,
      systemPrompt: 'sys',
      userPrompt: 'hello',
      result: outcome,
      trialIndex: outcome.trialIndex,
      temperature: 0.2,
      maxTokens: 2048,
      timeoutMs: 120_000,
      profile: 'balanced_default',
    });

    const stringFields = [
      'run_id', 'arena', 'task_id', 'task_bucket', 'model_id', 'provider', 'interface',
      'timestamp_utc', 'prompt_template_version', 'input_hash', 'requested_model',
      'effective_model', 'evaluation_level', 'evaluation_message', 'raw_output', 'rendered_output',
    ] as const;
    const numberFields = [
      'trial_index', 'temperature', 'max_tokens', 'retry_count', 'timeout_ms', 'latency_ms',
      'prompt_tokens', 'completion_tokens', 'total_tokens', 'cost_usd', 'quality_score',
      'stability_score', 'latency_score', 'cost_score', 'compliance_score', 'overall_score',
    ] as const;
    for (const field of stringFields) expect(typeof row[field], field).toBe('string');
    for (const field of numberFields) expect(typeof row[field], field).toBe('number');
    expect(row.trial_index).toBe(0);
    expect(row.retry_count).toBe(0);
    expect(row.http_status).toBe(200);
    expect(typeof row.human_review_required).toBe('boolean');
  });

  it('D2: a timeout aborts the in-flight transport call for real', async () => {
    let abortObserved = false;
    const transport: ArenaTransport = {
      capabilities: { text: true, image: true },
      call: ({ signal }) =>
        new Promise((_, reject) => {
          signal.addEventListener('abort', () => {
            abortObserved = true;
            reject(new ArenaTransportError('aborted'));
          });
        }),
    };

    const [outcome] = await runArenaComparison([request({ timeoutMs: 30 })], {
      transport,
      loadKey: async () => 'sk-test',
    });

    expect(abortObserved).toBe(true);
    expect(outcome.errorType).toBe('timeout');
    expect(outcome.error).toMatch(/timed out after 30ms/);
  });

  it('D3: in-flight trials never exceed maxParallel', async () => {
    let active = 0;
    let maxActive = 0;
    const transport: ArenaTransport = {
      capabilities: { text: true, image: true },
      call: async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 15));
        active -= 1;
        return { content: 'ok', model: 'm', httpStatus: 200 };
      },
    };

    const outcomes = await runArenaComparison(
      Array.from({ length: 6 }, (_, i) => request({ model: `gpt-${i}` })),
      { transport, loadKey: async () => 'sk-test', maxParallel: 2 },
    );

    expect(outcomes).toHaveLength(6);
    expect(outcomes.every((o) => o.content === 'ok')).toBe(true);
    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it('D4: rate limits retry with backoff and report the real retryCount', async () => {
    let calls = 0;
    const transport: ArenaTransport = {
      capabilities: { text: true, image: true },
      call: async () => {
        calls += 1;
        if (calls <= 2) throw new ArenaTransportError('rate limited', 429);
        return { content: 'recovered', model: 'm', httpStatus: 200 };
      },
    };

    const [outcome] = await runArenaComparison([request()], {
      transport,
      loadKey: async () => 'sk-test',
      maxRetries: 2,
      retryBaseDelayMs: 1,
    });

    expect(calls).toBe(3);
    expect(outcome.content).toBe('recovered');
    expect(outcome.retryCount).toBe(2);
    expect(outcome.errorType).toBe('none');
  });

  it('D4b: exhausted retries surface as rate_limit with the real httpStatus', async () => {
    const transport: ArenaTransport = {
      capabilities: { text: true, image: true },
      call: async () => {
        throw new ArenaTransportError('rate limited', 429);
      },
    };

    const [outcome] = await runArenaComparison([request()], {
      transport,
      loadKey: async () => 'sk-test',
      maxRetries: 2,
      retryBaseDelayMs: 1,
    });

    expect(outcome.errorType).toBe('rate_limit');
    expect(outcome.retryCount).toBe(2);
    expect(outcome.httpStatus).toBe(429);
  });

  it('D5: token counts carry measured/estimated provenance', async () => {
    const [measured] = await runArenaComparison([request()], {
      transport: okTransport({ inputTokens: 5, outputTokens: 7 }),
      loadKey: async () => 'sk-test',
    });
    expect(measured.tokenSource).toBe('measured');
    expect(measured.inputTokens).toBe(5);

    const [estimated] = await runArenaComparison([request()], {
      transport: okTransport(),
      loadKey: async () => 'sk-test',
    });
    expect(estimated.tokenSource).toBe('estimated');
    expect(estimated.inputTokens).toBeGreaterThan(0);
    expect(estimated.outputTokens).toBeGreaterThan(0);
  });

  it('D6: trials produce distinct trial-level outcomes instead of overwriting', async () => {
    const seen: number[] = [];
    const outcomes = await runArenaComparison([request({ trials: 3 })], {
      transport: okTransport(),
      loadKey: async () => 'sk-test',
      onOutcome: (outcome) => seen.push(outcome.trialIndex),
    });

    expect(outcomes.map((o) => o.trialIndex)).toEqual([0, 1, 2]);
    expect(new Set(outcomes.map((o) => o.runId)).size).toBe(3);
    expect(seen.sort()).toEqual([0, 1, 2]);
  });

  it('D7: preflight blocks missing-key / stale-metadata / image-in-browser before any call', async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const requests = [
      request({ provider: 'openai', model: 'no-key' }),
      request({ provider: 'anthropic', model: 'stale' }),
      request({ provider: 'gemini', model: 'image', imageDataUrl: 'data:image/png;base64,AAA' }),
      request({ provider: 'gemini', model: 'runnable' }),
    ];

    const { runnable, blocked } = await preflightArenaRequests(requests, {
      hasKey: async (provider) => provider !== 'openai',
      lastValidatedAt: (provider) => (provider === 'anthropic' ? eightDaysAgo : FRESH()),
      canImage: false,
    });

    expect(runnable.map((r) => r.model)).toEqual(['runnable']);
    expect(blocked.map((b) => [b.request.model, b.reason])).toEqual([
      ['no-key', 'missing_key'],
      ['stale', 'metadata_stale'],
      ['image', 'image_unsupported_runtime'],
    ]);
    expect(blocked.every((b) => b.message.length > 0)).toBe(true);
  });

  it('D7b: an unknown provider is blocked, not thrown', async () => {
    const { runnable, blocked } = await preflightArenaRequests(
      [request({ provider: 'not-a-provider' as never })],
      { hasKey: async () => true, lastValidatedAt: () => FRESH(), canImage: true },
    );
    expect(runnable).toHaveLength(0);
    expect(blocked[0]?.reason).toBe('unknown_provider');
  });
});
