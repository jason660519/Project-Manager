'use client';

import type { ArenaResult } from './useArenaChat';
import type { LlmProviderId } from '../../../../lib/keys/llmProviders';

export type ScenarioId = 'space_read' | 'ad_copy' | 'design_advice' | 'error_tolerance' | 'render_2d_3d';
export type RowScore = 'unrated' | 'pass' | 'good' | 'great' | 'fail';

export interface RunHistoryEntry {
  timestamp: number;
  scenario: ScenarioId;
  prompt: string;
  result: ArenaResult;
}

export interface ProviderLike {
  id: LlmProviderId;
  label: string;
  availableModels: string[];
}

export const VLM_SCENARIOS: Array<{ id: ScenarioId; label: string; instruction: string }> = [
  {
    id: 'space_read',
    label: '空間辨識',
    instruction: '先判斷房型與空間配置，再列出客廳、臥室、廚房、衛浴、陽台和主要動線，避免猜測未出現在圖中的資訊。',
  },
  {
    id: 'ad_copy',
    label: '房源文案',
    instruction: '根據圖面資訊生成 80~120 字房源文案，語氣專業、避免誇大，需描述格局與使用情境。',
  },
  {
    id: 'design_advice',
    label: '改造建議',
    instruction: '提出 3 點可執行的空間優化建議，每點需包含原因與預期效果，且不得改變原始隔間。',
  },
  {
    id: 'error_tolerance',
    label: '不確定性揭露',
    instruction: '若圖面資訊不足，明確標示不確定區域並提供保守判讀，不可虛構房間用途或尺寸。',
  },
  {
    id: 'render_2d_3d',
    label: '2D+3D裝潢示意圖',
    instruction: '請同時提供 2D 平面配置重點與 3D 裝潢示意描述，需保留原始格局邊界與動線，不可任意改動房間配置。',
  },
];

export const METHOD_ROWS = [
  { dimension: '圖面理解正確率', observe: '檢查空間名稱、相對位置與動線是否一致', passRule: '主要空間描述正確，無明顯幻覺內容' },
  { dimension: '文案可用性', observe: '是否輸出可直接給業務使用的文案格式', passRule: '語意清楚、無過度誇大、長度合理' },
  { dimension: '改造建議可執行性', observe: '建議是否具體、可落地、與原圖相容', passRule: '至少 2 點具體可做，且不違反圖面限制' },
  { dimension: '失敗可觀測性', observe: 'API 錯誤、延遲、token 和訊息是否可追蹤', passRule: '失敗有明確錯誤訊息，成功有延遲/Token 數據' },
];

export const SCORE_LABELS: Record<RowScore, string> = {
  unrated: '未評分',
  pass: 'Pass',
  good: 'Good',
  great: 'Great',
  fail: 'Fail',
};
