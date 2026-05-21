import type { ArenaResult } from './useArenaChat';

export type EvaluationLevel = 'pending' | 'pass' | 'warning' | 'fail';
export type InvocationPath = 'cli' | 'http';
export type ExecutionPlane = 'vendor_saas' | 'on_prem' | 'unknown';

export interface RunHistoryEntry {
  timestamp: number;
  summary: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  error?: string;
}

export const LLM_METHOD_ROWS: Array<{ dimension: string; observe: string; passRule: string }> = [
  {
    dimension: '指令遵循',
    observe: '檢查是否完整遵循 system + user prompt（格式、語氣、輸出結構）',
    passRule: '關鍵指令命中率 >= 90%，且無明顯違反限制條件',
  },
  {
    dimension: '事實正確性',
    observe: '比對關鍵敘述是否可被驗證、是否出現幻覺資訊',
    passRule: '核心結論無重大錯誤；不確定資訊需明確標註',
  },
  {
    dimension: '推理與完整度',
    observe: '觀察答案是否有邏輯步驟、覆蓋主要問題子項',
    passRule: '回答具可追溯推理，且主要子題皆有覆蓋',
  },
  {
    dimension: '可執行性',
    observe: '輸出是否可直接用於後續工作（需求拆解、規格、程式碼）',
    passRule: '輸出可直接採用或僅需輕微編修',
  },
  {
    dimension: '延遲與成本',
    observe: '觀察 latency + token 使用（input/output）',
    passRule: '延遲與 token 控制在可接受範圍（依任務等級）',
  },
];

export function invocationPathLabel(v: InvocationPath): string {
  return v === 'cli' ? 'CLI 程序' : 'HTTP 直連';
}

export function executionPlaneLabel(v: ExecutionPlane): string {
  if (v === 'vendor_saas') return '公有雲 API';
  if (v === 'on_prem') return '地端 / 內網';
  return '未知';
}

export function inferExecutionPlane(providerId: string): ExecutionPlane {
  if (!providerId) return 'unknown';
  if (providerId === 'ollama_local') return 'on_prem';
  return 'vendor_saas';
}

export function evaluationMeta(level: EvaluationLevel): { text: string; className: string } {
  if (level === 'pass') return { text: '通過', className: 'border-emerald-300 bg-emerald-100 text-emerald-800' };
  if (level === 'warning') return { text: '需觀察', className: 'border-amber-300 bg-amber-100 text-amber-800' };
  if (level === 'fail') return { text: '不通過', className: 'border-rose-300 bg-rose-100 text-rose-800' };
  return { text: '待評估', className: 'border-slate-300 bg-slate-100 text-slate-700' };
}

export function formatResultSummary(result: ArenaResult | undefined): string {
  if (!result) return '尚未執行';
  if (result.error) return `失敗：${result.error}`;
  const content = (result.content ?? '').trim();
  if (!content) return '完成：無內容';
  return content.length > 180 ? `${content.slice(0, 180)}…` : content;
}

export function statusMeta(result: ArenaResult | undefined): { text: string; className: string } {
  if (!result) return { text: '待測', className: 'bg-stone-500/15 text-stone-400' };
  if (result.error) return { text: '失敗', className: 'bg-red-500/15 text-red-400' };
  return { text: '完成', className: 'bg-emerald-500/15 text-emerald-400' };
}

export function buildHistoryMarkdown(provider: string, model: string, entries: RunHistoryEntry[]): string {
  const lines = [
    '# LLM Arena 測試紀錄匯出',
    '',
    `- Provider: ${provider}`,
    `- Model: ${model}`,
    `- Exported at: ${new Date().toISOString()}`,
    '',
    '| Time | Summary | Latency(ms) | Input Tokens | Output Tokens |',
    '| --- | --- | --- | --- | --- |',
  ];

  if (entries.length === 0) {
    lines.push('| - | 尚無紀錄 | - | - | - |');
  } else {
    entries.forEach((entry) => {
      const summary = entry.summary.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
      lines.push(
        `| ${new Date(entry.timestamp).toISOString()} | ${summary} | ${entry.latencyMs} | ${entry.inputTokens} | ${entry.outputTokens} |`,
      );
    });
  }
  return lines.join('\n');
}
