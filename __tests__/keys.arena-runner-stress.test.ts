import { describe, expect, it, vi } from 'vitest';
import { runArenaComparison, type ArenaTransport } from '../app/ui/views/Keys/arenaRunner';

/**
 * F50 Phase 4 (P2 壓測, scenario F50-S05/S12): the runner under load — 50
 * models × 10 trials — against a mock transport. No real API is ever touched.
 */

vi.mock('../lib/keys/loadProviderKey', () => ({
  loadProviderKey: vi.fn(async () => 'sk-test'),
  hasProviderKey: vi.fn(async () => true),
}));
vi.mock('../lib/scanner/runProjectScan', () => ({
  callSingleProvider: vi.fn(async () => {
    throw new Error('real bridge must not be reached in stress tests');
  }),
}));

describe('arenaRunner stress (P2)', () => {
  it('completes 500 trials with bounded concurrency and trial-level integrity', async () => {
    let active = 0;
    let maxActive = 0;
    let calls = 0;
    const transport: ArenaTransport = {
      capabilities: { text: true, image: true },
      call: async () => {
        active += 1;
        calls += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active -= 1;
        return { content: 'ok', model: 'm', httpStatus: 200, inputTokens: 1, outputTokens: 1 };
      },
    };

    const requests = Array.from({ length: 50 }, (_, index) => ({
      provider: 'openai' as const,
      model: `gpt-stress-${index}`,
      systemPrompt: 'sys',
      userPrompt: 'hello',
      trials: 10,
    }));

    const started = performance.now();
    const outcomes = await runArenaComparison(requests, {
      transport,
      loadKey: async () => 'sk-test',
      maxParallel: 4,
    });
    const elapsedMs = performance.now() - started;

    expect(outcomes).toHaveLength(500);
    expect(calls).toBe(500);
    expect(maxActive).toBeLessThanOrEqual(4);
    expect(outcomes.every((o) => o.errorType === 'none')).toBe(true);
    // Trial-level integrity: 10 distinct trial indexes per model, 500 unique runIds.
    expect(new Set(outcomes.map((o) => o.runId)).size).toBe(500);
    const perModel = outcomes.filter((o) => o.model === 'gpt-stress-0').map((o) => o.trialIndex);
    expect([...perModel].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    // Sanity ceiling — 500 × ~1ms at concurrency 4 must not blow up (UI freeze guard).
    expect(elapsedMs).toBeLessThan(10_000);
  });

  it('a slow minority does not starve the rest of the queue', async () => {
    const transport: ArenaTransport = {
      capabilities: { text: true, image: true },
      call: async ({ request }) => {
        const slow = request.model.endsWith('-slow');
        await new Promise((resolve) => setTimeout(resolve, slow ? 40 : 1));
        return { content: 'ok', model: request.model, httpStatus: 200 };
      },
    };

    const requests = [
      { provider: 'openai' as const, model: 'a-slow', systemPrompt: '', userPrompt: 'x' },
      ...Array.from({ length: 20 }, (_, index) => ({
        provider: 'openai' as const,
        model: `fast-${index}`,
        systemPrompt: '',
        userPrompt: 'x',
      })),
    ];

    const outcomes = await runArenaComparison(requests, {
      transport,
      loadKey: async () => 'sk-test',
      maxParallel: 4,
    });

    expect(outcomes).toHaveLength(21);
    expect(outcomes.every((o) => o.errorType === 'none')).toBe(true);
  });
});
