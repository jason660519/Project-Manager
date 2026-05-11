export type FeatureStatus = 'todo' | 'in_progress' | 'done' | 'on_hold';
export type AdapterType = 'ide' | 'agent';
export type IDEId = 'Cursor' | 'VSCode' | 'Trae' | 'Antigravity';

export interface FeaturePaths {
  spec?: string;          // 功能規格書路徑
  tdd?: string;           // TDD 規格書路徑
  tddProgressReport?: string; // TDD 進度報告路徑
  unitIntegrationTest?: string; // 單元與整合測試路徑
  e2eAcceptanceTestScriptFolder?: string; // E2E 驗收測試腳本資料夾
  developmentLogSummaryFolder?: string; // 開發日誌摘要資料夾
  test?: string;          // 測試腳本路徑
  implementation?: string; // 實作代碼路徑
}

export interface Feature {
  id: string;
  name: string;
  category: string;
  status: FeatureStatus;
  progress: number;
  paths: FeaturePaths;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface ProjectConfig {
  name: string;
  root: string;
  defaultIDE: IDEId;
}

export interface AdapterDescriptor {
  id: string;
  name: string;
  type: AdapterType;
}

export interface IDEAdapterConfig extends AdapterDescriptor {
  type: 'ide';
  command: string;
}

export interface AgentAdapterConfig extends AdapterDescriptor {
  type: 'agent';
  command: string;
  argsTemplate: string[];
}

export interface AdapterConfig {
  ides: IDEAdapterConfig[];
  agents: AgentAdapterConfig[];
}

export interface RuntimeAdapter extends AdapterDescriptor {
  execute: (context: ExecutionContext) => Promise<ExecutionResult>;
}

export interface ExecutionContext {
  feature: Feature;
  prompt?: string;
  projectRoot: string;
}

export interface ExecutionResult {
  success: boolean;
  message?: string;
  logs?: string;
  externalUrl?: string;
  command?: string;
  args?: string[];
  dryRun?: boolean;
  pid?: number;
}

export type AnyAdapterConfig = IDEAdapterConfig | AgentAdapterConfig;

export interface DevPilotConfig {
  /** Increment when making breaking changes to the config structure. Current: 1 */
  schemaVersion: number;
  project: ProjectConfig;
  features: Feature[];
  adapters: AdapterConfig;
}

// ── App navigation & run-store types ─────────────────────────────────────────

export type ViewId = 'dashboard' | 'features' | 'projects' | 'settings';

export type IssueState = 'open' | 'closed';

export interface GithubIssue {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: IssueState;
  labels: string[];
  createdAt: string;
  updatedAt: string;
  url: string;
  user?: string;
}

export interface ActiveRun {
  pid: number;
  featureId: string;
  featureName: string;
  command: string;
  args: string[];
  startedAt: number;
  logs: string[];
  phase: 'running' | 'done' | 'error';
}

export interface CompletedRun {
  pid: number;
  featureId: string;
  featureName: string;
  command: string;
  args: string[];
  startedAt: number;
  completedAt: number;
  exitCode: number;
  success: boolean;
  logs: string[];
}

export interface ProjectEntry {
  id: string;
  config: DevPilotConfig;
  configPath: string;
}

// ── AI API types ──────────────────────────────────────────────────────────────

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AnthropicRequest {
  apiKey: string;
  model: string;
  maxTokens: number;
  messages: AnthropicMessage[];
}

export interface AnthropicResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
}
