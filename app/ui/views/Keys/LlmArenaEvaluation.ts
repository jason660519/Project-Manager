import type { LlmProviderId } from '../../../../lib/keys/llmProviders';
import type { ArenaResult } from './useArenaChat';

export type LlmArenaEvaluationLevel = 'pending' | 'pass' | 'warning' | 'fail';
export type LlmArenaErrorType =
  | 'none'
  | 'timeout'
  | 'rate_limit'
  | 'schema_violation'
  | 'tool_error'
  | 'empty_output'
  | 'http_error'
  | 'missing_key'
  | 'runtime_error'
  | 'other';

export type LlmArenaScoringProfile = 'quality_first' | 'balanced_default' | 'cost_latency_first';

export interface LlmArenaEvaluationConfig {
  promptTemplateVersion: string;
  defaultSampleCount: number;
  minSampleCount: number;
  maxSampleCount: number;
  defaultTimeoutMs: number;
  minTimeoutMs: number;
  maxTimeoutMs: number;
  defaultMaxTokens: number;
  minMaxTokens: number;
  maxMaxTokens: number;
  defaultTemperature: number;
  minMeaningfulOutputChars: number;
  historyWindow: number;
  maxParallelRuns: number;
  scoreWeights: Record<
    LlmArenaScoringProfile,
    {
      quality_score: number;
      stability_score: number;
      latency_score: number;
      cost_score: number;
      compliance_score: number;
    }
  >;
  thresholds: {
    passSuccessRate: number;
    fallbackSuccessRate: number;
    passComplianceScore: number;
    fallbackComplianceScore: number;
    timeoutPenaltyScore: number;
    warningQualityScore: number;
    failQualityScore: number;
    pendingQualityScore: number;
    maxExpectedTokens: number;
  };
}

export const LLM_ARENA_EVALUATION_CONFIG: LlmArenaEvaluationConfig = {
  promptTemplateVersion: 'llm-identity-v1',
  defaultSampleCount: 1,
  minSampleCount: 1,
  maxSampleCount: 10,
  defaultTimeoutMs: 120_000,
  minTimeoutMs: 5_000,
  maxTimeoutMs: 180_000,
  defaultMaxTokens: 2048,
  minMaxTokens: 64,
  maxMaxTokens: 8192,
  defaultTemperature: 0.2,
  minMeaningfulOutputChars: 8,
  historyWindow: 10,
  maxParallelRuns: 4,
  scoreWeights: {
    quality_first: {
      quality_score: 0.55,
      stability_score: 0.2,
      latency_score: 0.1,
      cost_score: 0.1,
      compliance_score: 0.05,
    },
    balanced_default: {
      quality_score: 0.45,
      stability_score: 0.2,
      latency_score: 0.15,
      cost_score: 0.15,
      compliance_score: 0.05,
    },
    cost_latency_first: {
      quality_score: 0.3,
      stability_score: 0.2,
      latency_score: 0.25,
      cost_score: 0.2,
      compliance_score: 0.05,
    },
  },
  thresholds: {
    passSuccessRate: 0.95,
    fallbackSuccessRate: 0.9,
    passComplianceScore: 98,
    fallbackComplianceScore: 95,
    timeoutPenaltyScore: 0,
    warningQualityScore: 70,
    failQualityScore: 0,
    pendingQualityScore: 50,
    maxExpectedTokens: 4096,
  },
};

export const LLM_ARENA_METRIC_DEFINITIONS = [
  {
    key: 'quality_score',
    label: 'Quality',
    description: 'Model identity, meaningful answer quality, and reference-rule pass level.',
  },
  {
    key: 'stability_score',
    label: 'Stability',
    description: 'Recent success-rate based consistency score over the configured history window.',
  },
  {
    key: 'latency_score',
    label: 'Latency',
    description: 'Normalized from end-to-end latency against the configured timeout budget.',
  },
  {
    key: 'cost_score',
    label: 'Cost',
    description: 'Token-efficiency proxy normalized against the configured token budget.',
  },
  {
    key: 'compliance_score',
    label: 'Compliance',
    description: 'Output/error compliance with the evaluation contract and model identity checks.',
  },
] as const;

export interface LlmArenaEvaluationInput {
  requestedModel: string;
  effectiveModel: string;
  renderedOutput: string;
  outputLines: string[];
  errorType?: LlmArenaErrorType | string;
  errorMessage?: string | null;
  httpStatus?: number | null;
  latencyMs?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  successRateRecent?: number | null;
  timeoutMs?: number;
  maxTokens?: number;
  profile?: LlmArenaScoringProfile;
}

export interface LlmArenaScoreBreakdown {
  quality_score: number;
  stability_score: number;
  latency_score: number;
  cost_score: number;
  compliance_score: number;
  overall_score: number;
}

export interface LlmArenaEvaluationResult {
  level: LlmArenaEvaluationLevel;
  message: string;
  score: LlmArenaScoreBreakdown;
  selfReportedModel: SelfReportedModel;
  selfReportComparison: SelfReportComparison;
}

export interface LlmArenaResultRow {
  run_id: string;
  arena: 'llm';
  task_id: string;
  task_bucket: string;
  model_id: string;
  provider: LlmProviderId;
  interface: 'raw_api';
  trial_index: number;
  timestamp_utc: string;
  prompt_template_version: string;
  system_prompt_hash: string | null;
  input_hash: string;
  output_hash: string | null;
  temperature: number;
  max_tokens: number;
  retry_count: number;
  timeout_ms: number;
  latency_ms: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  quality_score: number;
  stability_score: number;
  latency_score: number;
  cost_score: number;
  compliance_score: number;
  overall_score: number;
  error_type: LlmArenaErrorType;
  error_message: string | null;
  human_review_required: boolean;
  notes: string | null;
  requested_model: string;
  effective_model: string;
  http_status: number | null;
  evaluation_level: LlmArenaEvaluationLevel;
  evaluation_message: string;
  raw_output: string;
  rendered_output: string;
}

const KNOWN_MODEL_FAMILIES: ReadonlyArray<{ family: string; aliases: ReadonlyArray<string> }> = [
  { family: 'minimax', aliases: ['minimax'] },
  { family: 'kimi', aliases: ['moonshot', 'kimi'] },
  { family: 'glm', aliases: ['chatglm', 'glm', 'z-ai'] },
  { family: 'gpt', aliases: ['chatgpt', 'gpt', 'openai'] },
  { family: 'claude', aliases: ['claude'] },
  { family: 'gemini', aliases: ['gemini'] },
  { family: 'qwen', aliases: ['qwen', 'tongyi', 'qianwen'] },
  { family: 'deepseek', aliases: ['deepseek'] },
  { family: 'llama', aliases: ['llama'] },
  { family: 'mistral', aliases: ['mistral'] },
  { family: 'grok', aliases: ['grok'] },
];

interface FamilyHit {
  family: string;
  alias: string;
  index: number;
}

export interface SelfReportedModel {
  family: string | null;
  versionFingerprint: string | null;
  raw: string | null;
}

export type SelfReportComparison =
  | 'not-detected'
  | 'family-mismatch'
  | 'version-mismatch'
  | 'family-only-match'
  | 'match';

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeModel(value: string): string {
  return value.trim().toLowerCase();
}

function modelIdentityFingerprint(value: string): string {
  const tail = value.includes('/') ? (value.split('/').pop() ?? value) : value;
  return tail.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function modelsMatchForEvaluation(requested: string, effective: string): boolean {
  if (!requested || !effective) return false;
  if (normalizeModel(requested) === normalizeModel(effective)) return true;
  return modelIdentityFingerprint(requested) === modelIdentityFingerprint(effective);
}

function meaningfulCharCount(value: string): number {
  return value.replace(/\s+/g, '').length;
}

function hasRenderableOutput(renderedOutput: string, config = LLM_ARENA_EVALUATION_CONFIG): boolean {
  return meaningfulCharCount(renderedOutput) >= config.minMeaningfulOutputChars;
}

function hasRawOutput(outputLines: string[]): boolean {
  return outputLines.some((line) => meaningfulCharCount(line) > 0);
}

function lastNonEmptyLine(lines: string[]): string {
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const s = lines[i]?.trim() ?? '';
    if (s) return s;
  }
  return '';
}

export function isExplicitEmptyOrErrorOutcome(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return (
    /無文字輸出/.test(t) ||
    /無輸出[：:]/.test(t) ||
    /成功，但無輸出/.test(t) ||
    /未取得可讀文字/.test(t) ||
    /無法執行\s*(API\s*)?fallback/i.test(t) ||
    /fallback\s*失敗/i.test(t) ||
    /無可用\s+\w+\s*API/i.test(t) ||
    /缺少\s+API\s*key/i.test(t) ||
    /不支援的\s+provider\s+fallback/i.test(t) ||
    /no text output/i.test(t) ||
    /HTTP\s*失敗/i.test(t) ||
    /operation was aborted/i.test(t)
  );
}

export function classifyLlmArenaError(error: unknown): LlmArenaErrorType {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (!message.trim()) return 'other';
  if (/timeout|timed out|aborted/i.test(message)) return 'timeout';
  if (/429|rate.?limit/i.test(message)) return 'rate_limit';
  if (/schema|json|parse/i.test(message)) return 'schema_violation';
  if (/tool/i.test(message)) return 'tool_error';
  if (/api key|key saved|missing key|no api key/i.test(message)) return 'missing_key';
  if (/http\s+\d+/i.test(message)) return 'http_error';
  return 'runtime_error';
}

function humanizeErrorType(errorType: string): string {
  switch (errorType) {
    case 'empty_output':
      return 'HTTP 無可讀模型輸出';
    case 'timeout':
      return '請求逾時或逾時中止';
    case 'rate_limit':
      return '速率限制';
    case 'http_error':
      return 'HTTP 請求錯誤';
    case 'missing_key':
      return '缺少 API key';
    case 'schema_violation':
      return '回應格式異常';
    case 'tool_error':
      return '工具呼叫錯誤';
    case 'runtime_error':
      return '執行錯誤';
    default:
      return errorType;
  }
}

function httpStatusIndicatesFailure(status: number): boolean {
  return status < 200 || status > 299;
}

function detectFamilyHit(text: string): FamilyHit | null {
  const lower = text.toLowerCase();
  let best: FamilyHit | null = null;
  for (const { family, aliases } of KNOWN_MODEL_FAMILIES) {
    for (const alias of aliases) {
      const idx = lower.indexOf(alias);
      if (idx === -1) continue;
      if (!best || idx < best.index || (idx === best.index && alias.length > best.alias.length)) {
        best = { family, alias, index: idx };
      }
    }
  }
  return best;
}

function extractVersionFingerprint(text: string, anchorAlias?: string): string | null {
  const lower = text.toLowerCase();
  let scope = lower;
  if (anchorAlias) {
    const idx = lower.indexOf(anchorAlias);
    if (idx !== -1) {
      const start = idx + anchorAlias.length;
      scope = lower.slice(start, start + 40);
    }
  }
  const match = scope.match(/[a-z]?\d+(?:[.\-]\d+)+[a-z]?|\d+[a-z]/);
  if (!match) return null;
  return match[0].replace(/[^a-z0-9]/g, '');
}

export function parseSelfReportedModel(text: string): SelfReportedModel {
  if (!text.trim()) return { family: null, versionFingerprint: null, raw: null };
  const hit = detectFamilyHit(text);
  if (!hit) return { family: null, versionFingerprint: null, raw: null };
  const version = extractVersionFingerprint(text, hit.alias);
  const rawWindow = text.slice(hit.index, Math.min(text.length, hit.index + 40));
  return {
    family: hit.family,
    versionFingerprint: version,
    raw: rawWindow.trim() || text.toLowerCase().slice(hit.index, hit.index + 40),
  };
}

export function compareSelfReportToRequested(
  self: SelfReportedModel,
  requestedModel: string,
): SelfReportComparison {
  if (!self.family) return 'not-detected';
  const requestedHit = detectFamilyHit(requestedModel);
  if (!requestedHit) return 'not-detected';
  if (requestedHit.family !== self.family) return 'family-mismatch';
  const requestedVersion = extractVersionFingerprint(requestedModel, requestedHit.alias);
  if (!requestedVersion || !self.versionFingerprint) return 'family-only-match';
  return requestedVersion === self.versionFingerprint ? 'match' : 'version-mismatch';
}

function isGpt5RequestedButReplyClaimsGpt4Line(requestedModel: string, renderedOutput: string): boolean {
  if (!/^gpt-5/i.test(requestedModel.trim())) return false;
  if (/\bgpt-5|GPT-5|gpt5\b/i.test(renderedOutput)) return false;
  return /GPT[-\s]?4|gpt[-\s]?4/i.test(renderedOutput);
}

function isMinimaxM25RequestButM21SelfReport(requestedModel: string, renderedOutput: string): boolean {
  if (!/minimax-m2\.5|minimax\/minimax-m2\.5/i.test(requestedModel)) return false;
  return /MiniMax-M2\.1|minimax-m2\.1|\bM2\.1\b/i.test(renderedOutput);
}

function hasNoActualModelReply(renderedOutput: string, outputLines: string[]): boolean {
  if (isExplicitEmptyOrErrorOutcome(renderedOutput)) return true;
  if (!renderedOutput.trim() && isExplicitEmptyOrErrorOutcome(lastNonEmptyLine(outputLines))) return true;
  return false;
}

function baseQualityForLevel(level: LlmArenaEvaluationLevel): number {
  const thresholds = LLM_ARENA_EVALUATION_CONFIG.thresholds;
  if (level === 'pass') return 100;
  if (level === 'warning') return thresholds.warningQualityScore;
  if (level === 'pending') return thresholds.pendingQualityScore;
  return thresholds.failQualityScore;
}

function computeScore(args: {
  level: LlmArenaEvaluationLevel;
  complianceScore: number;
  latencyMs: number | null | undefined;
  inputTokens: number | null | undefined;
  outputTokens: number | null | undefined;
  successRateRecent: number | null | undefined;
  timeoutMs: number;
  maxTokens: number;
  profile: LlmArenaScoringProfile;
}): LlmArenaScoreBreakdown {
  const quality = baseQualityForLevel(args.level);
  const successRate = args.successRateRecent ?? (args.level === 'fail' ? 0 : 1);
  const stability = clamp(successRate * 100);
  const latency =
    args.level === 'fail' && args.latencyMs == null
      ? LLM_ARENA_EVALUATION_CONFIG.thresholds.timeoutPenaltyScore
      : clamp(100 - ((args.latencyMs ?? args.timeoutMs) / Math.max(1, args.timeoutMs)) * 100);
  const totalTokens = Math.max(0, Number(args.inputTokens ?? 0) + Number(args.outputTokens ?? 0));
  const tokenBudget = Math.max(1, args.maxTokens || LLM_ARENA_EVALUATION_CONFIG.thresholds.maxExpectedTokens);
  const cost = clamp(100 - (totalTokens / tokenBudget) * 100);
  const weights = LLM_ARENA_EVALUATION_CONFIG.scoreWeights[args.profile];
  const overall =
    weights.quality_score * quality +
    weights.stability_score * stability +
    weights.latency_score * latency +
    weights.cost_score * cost +
    weights.compliance_score * args.complianceScore;

  return {
    quality_score: Number(quality.toFixed(4)),
    stability_score: Number(stability.toFixed(4)),
    latency_score: Number(latency.toFixed(4)),
    cost_score: Number(cost.toFixed(4)),
    compliance_score: Number(args.complianceScore.toFixed(4)),
    overall_score: Number(overall.toFixed(4)),
  };
}

export function evaluateLlmArenaRun(input: LlmArenaEvaluationInput): LlmArenaEvaluationResult {
  const requestedModel = input.requestedModel.trim();
  const effectiveModel = input.effectiveModel.trim();
  const renderedOutput = input.renderedOutput.trim();
  const errType = (input.errorType ?? '').trim();
  const httpSt = input.httpStatus;
  const profile = input.profile ?? 'balanced_default';
  const timeoutMs = input.timeoutMs ?? LLM_ARENA_EVALUATION_CONFIG.defaultTimeoutMs;
  const maxTokens = input.maxTokens ?? LLM_ARENA_EVALUATION_CONFIG.defaultMaxTokens;
  const selfReportedModel = parseSelfReportedModel(renderedOutput);
  const selfReportComparison = compareSelfReportToRequested(selfReportedModel, requestedModel);

  let level: LlmArenaEvaluationLevel = 'pass';
  let message = 'LLM測試成功且model型號正確（及格）';
  let complianceScore = 100;

  if (errType && errType !== 'none') {
    level = 'fail';
    message = `不及格（${humanizeErrorType(errType)}）`;
    complianceScore = 0;
  } else if (httpSt != null && httpStatusIndicatesFailure(httpSt)) {
    level = 'fail';
    message = `不及格（HTTP ${httpSt}）`;
    complianceScore = 0;
  } else if (!hasRenderableOutput(renderedOutput)) {
    level = 'fail';
    message = '不及格（rendered output 過短或空白）';
    complianceScore = 0;
  } else if (hasNoActualModelReply(renderedOutput, input.outputLines)) {
    level = 'fail';
    message = '不及格（API／fallback 無可讀模型輸出）';
    complianceScore = 0;
  } else if (!effectiveModel) {
    level = 'pending';
    message = '待判定（尚未取得實際模型）';
    complianceScore = 80;
  } else if (!modelsMatchForEvaluation(requestedModel, effectiveModel)) {
    level = 'warning';
    message = `模型不正確，暫時回退到 ${effectiveModel}`;
    complianceScore = 90;
  } else if (!hasRawOutput(input.outputLines)) {
    level = 'pending';
    message = '待判定（raw output 不足）';
    complianceScore = 80;
  } else if (selfReportComparison === 'version-mismatch') {
    if (isMinimaxM25RequestButM21SelfReport(requestedModel, renderedOutput)) {
      level = 'warning';
      message =
        '注意：請求為 minimax-m2.5，但自介為 M2.1；OpenRouter 對 minimax 路由有時仍會落到 M2.1。此非設定表錯誤。';
      complianceScore = 90;
    } else {
      level = 'fail';
      message = `不及格（模型自報為 ${
        selfReportedModel.raw ?? selfReportedModel.family
      }，與請求的 ${requestedModel} 不一致，provider 可能未誠實回傳實際版本）`;
      complianceScore = 0;
    }
  } else if (isGpt5RequestedButReplyClaimsGpt4Line(requestedModel, renderedOutput)) {
    level = 'warning';
    message =
      '注意：請求為 gpt-5 系，但回覆文字自稱 GPT-4 系列；可能是官方顯示用語，請勿僅依自介判斷代號。';
    complianceScore = 90;
  }

  return {
    level,
    message,
    selfReportedModel,
    selfReportComparison,
    score: computeScore({
      level,
      complianceScore,
      latencyMs: input.latencyMs,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      successRateRecent: input.successRateRecent,
      timeoutMs,
      maxTokens,
      profile,
    }),
  };
}

export function sanitizeLlmArenaNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function stableHash(value: string): string {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function buildLlmArenaResultRow(args: {
  runId: string;
  provider: LlmProviderId;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  result: ArenaResult;
  trialIndex?: number;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  profile: LlmArenaScoringProfile;
  successRateRecent?: number | null;
  note?: string | null;
}): LlmArenaResultRow {
  const outputLines = args.result.outputLines?.length
    ? args.result.outputLines
    : (args.result.error ?? args.result.content ?? '').split(/\r?\n/).filter(Boolean);
  const renderedOutput = args.result.content ?? '';
  const evaluation = evaluateLlmArenaRun({
    requestedModel: args.result.requestedModel ?? args.model,
    effectiveModel: args.result.effectiveModel ?? args.result.model ?? args.model,
    renderedOutput,
    outputLines,
    errorType: args.result.errorType ?? (args.result.error ? classifyLlmArenaError(args.result.error) : 'none'),
    errorMessage: args.result.error ?? null,
    httpStatus: args.result.httpStatus ?? null,
    latencyMs: args.result.latencyMs,
    inputTokens: args.result.inputTokens,
    outputTokens: args.result.outputTokens,
    successRateRecent: args.successRateRecent,
    timeoutMs: args.timeoutMs,
    maxTokens: args.maxTokens,
    profile: args.profile,
  });
  const promptTokens = args.result.inputTokens ?? 0;
  const completionTokens = args.result.outputTokens ?? 0;
  const rawOutput = outputLines.join('\n');
  const timestamp = new Date(args.result.timestamp || Date.now()).toISOString();

  return {
    run_id: args.runId,
    arena: 'llm',
    task_id: 'identity_self_report',
    task_bucket: 'llm_reasoning',
    model_id: args.model,
    provider: args.provider,
    interface: 'raw_api',
    trial_index: args.trialIndex ?? 1,
    timestamp_utc: timestamp,
    prompt_template_version: LLM_ARENA_EVALUATION_CONFIG.promptTemplateVersion,
    system_prompt_hash: args.systemPrompt ? stableHash(args.systemPrompt) : null,
    input_hash: stableHash(args.userPrompt),
    output_hash: renderedOutput ? stableHash(renderedOutput) : null,
    temperature: args.temperature,
    max_tokens: args.maxTokens,
    retry_count: args.result.retryCount ?? 0,
    timeout_ms: args.timeoutMs,
    latency_ms: args.result.latencyMs,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: promptTokens + completionTokens,
    cost_usd: 0,
    quality_score: evaluation.score.quality_score,
    stability_score: evaluation.score.stability_score,
    latency_score: evaluation.score.latency_score,
    cost_score: evaluation.score.cost_score,
    compliance_score: evaluation.score.compliance_score,
    overall_score: evaluation.score.overall_score,
    error_type: (args.result.errorType ?? (args.result.error ? classifyLlmArenaError(args.result.error) : 'none')) as LlmArenaErrorType,
    error_message: args.result.error ?? null,
    human_review_required: evaluation.level === 'warning' || evaluation.level === 'pending',
    notes: args.note ?? null,
    requested_model: args.result.requestedModel ?? args.model,
    effective_model: args.result.effectiveModel ?? args.result.model ?? args.model,
    http_status: args.result.httpStatus ?? null,
    evaluation_level: evaluation.level,
    evaluation_message: evaluation.message,
    raw_output: rawOutput,
    rendered_output: renderedOutput,
  };
}

export function buildLlmArenaHistoryMarkdown(row: LlmArenaResultRow): string {
  return [
    '# LLM Arena 評測紀錄（匯出）',
    '',
    `- Provider: ${row.provider}`,
    `- Model: ${row.model_id}`,
    `- Interface: ${row.interface}`,
    `- Requested model: ${row.requested_model}`,
    `- Effective model: ${row.effective_model || '—'}`,
    `- Evaluation: ${row.evaluation_level} / ${row.evaluation_message}`,
    `- Overall score: ${row.overall_score}`,
    `- Generated at: ${new Date().toISOString()}`,
    '',
    '| Metric | Score |',
    '| --- | ---: |',
    `| quality_score | ${row.quality_score} |`,
    `| stability_score | ${row.stability_score} |`,
    `| latency_score | ${row.latency_score} |`,
    `| cost_score | ${row.cost_score} |`,
    `| compliance_score | ${row.compliance_score} |`,
    '',
    '## Result Row',
    '',
    '```json',
    JSON.stringify(row, null, 2),
    '```',
  ].join('\n');
}
