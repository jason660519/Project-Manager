export type FeatureStatus = 'todo' | 'in_progress' | 'done' | 'on_hold';
export type AdapterType = 'ide' | 'agent';
export type IDEId = 'Cursor' | 'VSCode' | 'Trae' | 'Antigravity';

// ── Project-progress phase model (schema v3) ─────────────────────────────────
export type FeaturePhase = 'development' | 'e2e_testing' | 'deployment' | 'operations';
export type TestStatus = 'passed' | 'failed' | 'pending';
export type DeployStatus = 'production' | 'staging' | 'not_deployed';

/** Auto-loop prompt config stored per feature (used by task/[rowId] page). */
export interface FeaturePromptConfig {
  /** User-authored prompt body. */
  body?: string;
  /** Which adapter id to dispatch with (matches AdapterConfig.agents[].id). */
  agentId?: string;
  /** When true, the runner re-fires the prompt until stopCondition matches. */
  autoLoop?: boolean;
  /** Stop condition for the auto-loop: substring match against the last run output. */
  stopCondition?: string;
  /** Maximum number of iterations the runner will execute before giving up. */
  maxIterations?: number;
  /** Optional working directory override. Defaults to the project root. */
  workingDir?: string;
}

export interface FeaturePaths {
  /** Canonical feature folder: `.project-manager/features/<ID>/` */
  featureFolder?: string;
  spec?: string;                      // Feature dev spec (.md — source, editable)
  tdd?: string;                       // TDD spec (.md — source, editable)
  tddProgressReport?: string;         // TDD progress data (.md — raw data source)
  tddProgressReportHtml?: string;     // TDD progress report (.html — generated artifact, rich display)
  unitIntegrationTest?: string;       // Unit & integration test path
  e2eAcceptanceTestScriptFolder?: string; // E2E acceptance test script folder
  developmentLogSummaryFolder?: string;   // Dev log folder (raw logs)
  devLogSummaryHtml?: string;         // Dev log summary (.html — generated artifact, rich display)
  test?: string;                      // Test script path
  implementation?: string;            // Implementation code path
}

export interface Feature {
  id: string;
  name: string;
  category: string;
  status: FeatureStatus;
  progress: number;
  paths: FeaturePaths;
  /** Relative path to the feature's notes document (e.g. `.project-manager/features/F01/README.md`). */
  notes?: string;
  // ── Sync audit fields (schema v2, ADR-006) ─────────────────────────────
  /** ISO 8601 timestamp set when the feature was first created. */
  createdAt?: string;
  /** ISO 8601 timestamp bumped on every modification. */
  updatedAt?: string;
  /** Last editor identifier — e.g. github username or email. */
  updatedBy?: string;
  metadata?: Record<string, any>;
  // ── Project-progress phase fields (schema v3) ──────────────────────────
  /** Lifecycle phase. Defaults to 'development' at read time. */
  phase?: FeaturePhase;
  /** Story-point weight (defaults to 1 in aggregations). */
  points?: number;
  /** Estimated source page / route where the feature lives. */
  locatedPage?: string;
  // e2e_testing
  testCoverage?: number;
  testStatus?: TestStatus;
  // deployment
  deployStatus?: DeployStatus;
  deployEnv?: string;
  deployDate?: string;
  // operations
  uptimePercent?: number;
  errorRate?: number;
  avgResponseTime?: number;
  lastIncident?: string;
  // TDD progress track (separate from overall `progress`).
  tddProgress?: number;
  /** Assigned engineerRole id (references ProjectManagerConfig.engineerRoles[].id). */
  assignedRoleId?: string;
  /** Per-feature IDE override; falls back to project.defaultIDE when unset. */
  assignedIDE?: IDEId;
  // prompt engineer (row-level auto-loop config)
  promptConfig?: FeaturePromptConfig;
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

export interface ProjectManagerConfig {
  /** Increment when making breaking changes to the config structure. Current: 3 */
  schemaVersion: number;
  engineerRoles?: EngineerRole[];
  // ── Sync identity + audit fields (schema v2, ADR-006) ──────────────────
  /** Stable UUID. Required from v2 onward; back-filled by migration. */
  id: string;
  /** ISO 8601 timestamp when the project config was first created. */
  createdAt?: string;
  /** ISO 8601 timestamp bumped on every modification. */
  updatedAt?: string;
  /** Last editor identifier — e.g. github username or email. */
  updatedBy?: string;
  project: ProjectConfig;
  features: Feature[];
  adapters: AdapterConfig;
  cronJobs?: CronJob[];
}

// ── App navigation & run-store types ─────────────────────────────────────────

export interface EngineerRole {
  id: string;
  name: string;
  slug: string;
  skills: string[];
  commands: string[];
  systemPrompt: string;
  referenceFiles: string[];
  defaultAgentId?: string;
  notes?: string;
  /** LLM provider used by the in-page Test panel. Empty = fall back to Settings provider order. */
  testProviderId?: string;
  /** Model id for the chosen test provider. Empty = use that provider's defaultModel. */
  testModel?: string;
  /** User-edited test prompt. Empty = auto-generate from name + skills + systemPrompt. */
  testPrompt?: string;
}

export type ViewId = 'dashboard' | 'features' | 'projects' | 'project-files' | 'plugins' | 'settings' | 'keyboard-shortcuts' | 'engineers' | 'channels' | 'sessions' | 'cron-jobs' | 'logs' | 'keys' | 'documentation';

export type IssueState = 'open' | 'closed';

// ── Sessions ──────────────────────────────────────────────────────────────────

export interface SessionMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface AgentSession {
  id: string;
  title: string;
  projectId?: string;
  featureId?: string;
  agentId?: string;
  model: string;
  messages: SessionMessage[];
  startedAt: string;
  completedAt?: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  status: 'active' | 'completed' | 'error';
  tags?: string[];
}

// ── Cron Jobs ─────────────────────────────────────────────────────────────────

export interface CronSchedule {
  type: 'every';
  value: number;
  unit: 'minutes' | 'hours';
}

export interface CronAction {
  type: 'run-command';
  command: string;
  args: string[];
  workingDir: string;
}

export interface CronJob {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  schedule: CronSchedule;
  action: CronAction;
  lastRun?: string;
  lastStatus?: 'ok' | 'error';
  createdAt: string;
}

export interface CronRun {
  jobId: string;
  jobName: string;
  firedAt: string;
  status: 'ok' | 'error';
  pid?: number;
}

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
  config: ProjectManagerConfig;
  configPath: string;
  /** ISO timestamp of the last successful sync from disk or GitHub. */
  lastSyncedAt?: string;
  /**
   * Folder was imported before `.project-manager/config.json` exists on disk.
   * Scan or Initialize clears this flag after writing the config file.
   */
  configMissing?: boolean;
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
