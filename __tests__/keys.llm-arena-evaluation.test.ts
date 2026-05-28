import { describe, expect, it } from 'vitest';
import {
  buildLlmArenaResultRow,
  compareSelfReportToRequested,
  evaluateLlmArenaRun,
  parseSelfReportedModel,
} from '../app/ui/views/Keys/LlmArenaEvaluation';

describe('Keys / LLM Arena evaluation core', () => {
  it('passes a meaningful output when requested and effective model identities match', () => {
    const result = evaluateLlmArenaRun({
      requestedModel: 'claude-opus-4-7',
      effectiveModel: 'claude-opus-4-7',
      renderedOutput: 'I am Claude Opus 4.7 from Anthropic, suited for deep reasoning.',
      outputLines: ['I am Claude Opus 4.7 from Anthropic, suited for deep reasoning.'],
      errorType: 'none',
      httpStatus: 200,
      latencyMs: 1200,
      inputTokens: 100,
      outputTokens: 80,
      timeoutMs: 120000,
      maxTokens: 2048,
    });

    expect(result.level).toBe('pass');
    expect(result.message).toContain('及格');
    expect(result.score.overall_score).toBeGreaterThan(90);
  });

  it('fails explicit empty-output and fallback error outcomes even when text is long', () => {
    const result = evaluateLlmArenaRun({
      requestedModel: 'gpt-5.4',
      effectiveModel: 'gpt-5.4',
      renderedOutput: 'HTTP 失敗：成功，但無輸出',
      outputLines: ['HTTP 失敗：成功，但無輸出'],
      errorType: 'none',
      httpStatus: 200,
    });

    expect(result.level).toBe('fail');
    expect(result.message).toContain('無可讀模型輸出');
    expect(result.score.quality_score).toBe(0);
  });

  it('warns when the effective model is a fallback model', () => {
    const result = evaluateLlmArenaRun({
      requestedModel: 'claude-opus-4-7',
      effectiveModel: 'claude-sonnet-4-6',
      renderedOutput: 'I am Claude Sonnet 4.6 from Anthropic.',
      outputLines: ['I am Claude Sonnet 4.6 from Anthropic.'],
      errorType: 'none',
      httpStatus: 200,
    });

    expect(result.level).toBe('warning');
    expect(result.message).toContain('回退');
    expect(result.score.compliance_score).toBe(90);
  });

  it('fails when self-reported version contradicts the requested model', () => {
    const self = parseSelfReportedModel('I am MiniMax-M2.1, a compact reasoning model.');
    expect(compareSelfReportToRequested(self, 'minimax-m2.7')).toBe('version-mismatch');

    const result = evaluateLlmArenaRun({
      requestedModel: 'minimax-m2.7',
      effectiveModel: 'minimax-m2.7',
      renderedOutput: 'I am MiniMax-M2.1, a compact reasoning model.',
      outputLines: ['I am MiniMax-M2.1, a compact reasoning model.'],
      errorType: 'none',
      httpStatus: 200,
    });

    expect(result.level).toBe('fail');
    expect(result.message).toContain('模型自報');
  });

  it('emits the aligned result row contract used by history export', () => {
    const row = buildLlmArenaResultRow({
      runId: 'run-1',
      provider: 'anthropic',
      model: 'claude-opus-4-7',
      systemPrompt: 'You are concise.',
      userPrompt: '你是哪一家公司的哪一個模型？',
      result: {
        provider: 'anthropic',
        model: 'claude-opus-4-7',
        requestedModel: 'claude-opus-4-7',
        effectiveModel: 'claude-opus-4-7',
        content: 'I am Claude Opus 4.7 from Anthropic.',
        outputLines: ['I am Claude Opus 4.7 from Anthropic.'],
        httpStatus: 200,
        retryCount: 0,
        errorType: 'none',
        latencyMs: 1000,
        inputTokens: 10,
        outputTokens: 20,
        timestamp: Date.UTC(2026, 4, 29),
      },
      temperature: 0.2,
      maxTokens: 2048,
      timeoutMs: 120000,
      profile: 'balanced_default',
    });

    expect(row.arena).toBe('llm');
    expect(row.interface).toBe('raw_api');
    expect(row.task_bucket).toBe('llm_reasoning');
    expect(row.evaluation_level).toBe('pass');
    expect(row.total_tokens).toBe(30);
    expect(row.output_hash).toMatch(/^[0-9a-f]{8}$/);
  });
});
