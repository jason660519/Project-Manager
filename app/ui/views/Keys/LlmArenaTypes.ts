import type { ArenaResult } from './useArenaChat';
import type { Translations } from '../../../../lib/i18n';
import type { LlmArenaEvaluationLevel, LlmArenaResultRow } from './LlmArenaEvaluation';

export type EvaluationLevel = LlmArenaEvaluationLevel;
export type InvocationPath = 'cli' | 'http';
export type ExecutionPlane = 'vendor_saas' | 'on_prem' | 'unknown';
export type LlmArenaCopy = Translations['keysArena']['llm'];

export interface RunHistoryEntry {
  timestamp: number;
  summary: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  evaluationLevel?: EvaluationLevel;
  evaluationMessage?: string;
  overallScore?: number;
  resultRow?: LlmArenaResultRow;
  error?: string;
}

export const LLM_ARENA_HISTORY_WINDOW = 10;

/**
 * Sanitizer for the `llmArenaHistory` keys-store slice. Entry contents keep
 * the same trust level as the pre-v2 in-memory history (loose cast); only the
 * container shape and the window size are enforced.
 */
export function sanitizeLlmArenaHistory(value: unknown): Record<string, RunHistoryEntry[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, history]) => Array.isArray(history))
      .map(([key, history]) => [key, (history as RunHistoryEntry[]).slice(0, LLM_ARENA_HISTORY_WINDOW)]),
  );
}

export function invocationPathLabel(v: InvocationPath, copy: LlmArenaCopy): string {
  return v === 'cli' ? copy.invocationPath.cli : copy.invocationPath.http;
}

export function executionPlaneLabel(v: ExecutionPlane, copy: LlmArenaCopy): string {
  if (v === 'vendor_saas') return copy.executionPlane.vendorSaas;
  if (v === 'on_prem') return copy.executionPlane.onPrem;
  return copy.executionPlane.unknown;
}

export function inferExecutionPlane(providerId: string): ExecutionPlane {
  if (!providerId) return 'unknown';
  if (providerId === 'ollama_local') return 'on_prem';
  return 'vendor_saas';
}

export function evaluationMeta(level: EvaluationLevel, copy: LlmArenaCopy): { text: string; className: string } {
  if (level === 'pass') return { text: copy.evaluationOptions.pass, className: 'border-emerald-300 bg-emerald-100 text-emerald-800' };
  if (level === 'warning') return { text: copy.evaluationOptions.warning, className: 'border-amber-300 bg-amber-100 text-amber-800' };
  if (level === 'fail') return { text: copy.evaluationOptions.fail, className: 'border-rose-300 bg-rose-100 text-rose-800' };
  return { text: copy.evaluationOptions.pending, className: 'border-slate-300 bg-slate-100 text-slate-700' };
}

export function formatResultSummary(result: ArenaResult | undefined, copy: LlmArenaCopy): string {
  if (!result) return copy.resultSummary.notRun;
  if (result.error) return `${copy.resultSummary.failedPrefix}${result.error}`;
  const content = (result.content ?? '').trim();
  if (!content) return copy.resultSummary.completedEmpty;
  return content.length > 180 ? `${content.slice(0, 180)}…` : content;
}

export function statusMeta(result: ArenaResult | undefined, copy: LlmArenaCopy): { text: string; className: string } {
  if (!result) return { text: copy.statuses.queued, className: 'bg-stone-500/15 text-stone-400' };
  if (result.error) return { text: copy.statuses.failed, className: 'bg-red-500/15 text-red-400' };
  return { text: copy.statuses.completed, className: 'bg-emerald-500/15 text-emerald-400' };
}

export function buildHistoryMarkdown(provider: string, model: string, entries: RunHistoryEntry[], copy: LlmArenaCopy): string {
  const lines = [
    copy.historyExportTitle,
    '',
    `- Provider: ${provider}`,
    `- Model: ${model}`,
    `- Exported at: ${new Date().toISOString()}`,
    '',
    '| Time | Summary | Latency(ms) | Input Tokens | Output Tokens |',
    '| --- | --- | --- | --- | --- |',
  ];

  if (entries.length === 0) {
    lines.push(`| - | ${copy.historyEmptyRow} | - | - | - |`);
  } else {
  entries.forEach((entry) => {
      const score = entry.overallScore == null ? '-' : String(entry.overallScore);
      const evaluation = entry.evaluationLevel ? `${entry.evaluationLevel}: ${entry.evaluationMessage ?? ''}` : '-';
      const summary = `${evaluation} | score=${score} | ${entry.summary}`.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
      lines.push(
        `| ${new Date(entry.timestamp).toISOString()} | ${summary} | ${entry.latencyMs} | ${entry.inputTokens} | ${entry.outputTokens} |`,
      );
    });
  }
  return lines.join('\n');
}
