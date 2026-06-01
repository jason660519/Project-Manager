export type FeatureStatus = 'todo' | 'in_progress' | 'done' | 'on_hold';
export type AdapterType = 'ide' | 'agent' | 'app';
export type ExecutionTargetKind = 'ide' | 'agent-cli' | 'agent-app';
export type IDEId = 'Cursor' | 'VSCode' | 'Trae' | 'Antigravity' | 'Kiro';

// ── Project-progress phase model (schema v3) ─────────────────────────────────
export type FeaturePhase = 'development' | 'e2e_testing' | 'deployment' | 'operations';
export type TestStatus = 'passed' | 'failed' | 'pending';
export type DeployStatus = 'production' | 'staging' | 'not_deployed';
export type HarnessTaskRole = 'planner' | 'worker' | 'evaluator';

/** Auto-loop prompt config stored per feature (used by task/[rowId] page). */
export interface FeaturePromptConfig {
  /** User-authored prompt body. */
  body?: string;
  /** Which adapter id to dispatch with (matches AdapterConfig.agents[].id). */
  agentId?: string;
  /** LLM provider/company selected for this dispatch. */
  modelProviderId?: string;
  /** Concrete model id selected for this dispatch. */
  modelId?: string;
  /** When true, the runner re-fires the prompt until stopCondition matches. */
  autoLoop?: boolean;
  /** Stop condition for the auto-loop: substring match against the last run output. */
  stopCondition?: string;
  /** Maximum number of iterations the runner will execute before giving up. */
  maxIterations?: number;
  /** Optional working directory override. Defaults to the project root. */
  workingDir?: string;
  /** "providerId/modelId" of the model that actually ran on the last dispatch, e.g. "openai/gpt-5.5". */
  lastDispatchModel?: string;
  /** Optional F35 multi-agent DAG template selected for dispatch, e.g. "software-dev-parallel". */
  workflowTemplateId?: string;
  /** Last initialized WorkflowRun id for a DAG template dispatch. */
  workflowRunId?: string;
}

export interface FeaturePaths {
  /** Canonical feature folder: `.project-manager/features/<ID>/` */
  featureFolder?: string;
  spec?: string;                      // Feature dev spec (.md — source, editable)
  tdd?: string;                       // TDD spec (.md — source, editable)
  tddProgressReport?: string;         // TDD progress data (.md — raw data source)
  tddProgressReportHtml?: string;     // TDD progress report (.html — generated artifact, rich display)
  debugRetro?: string;                // Debug retrospective (.md — reusable root-cause and verification record)
  testScenarios?: string;             // Test scenario map (.md — user paths translated to unit/E2E coverage)
  unitIntegrationTest?: string;       // Unit & integration test path
  e2eAcceptanceTestScriptFolder?: string; // E2E acceptance test script folder
  developmentLogSummaryFolder?: string;   // Dev log folder (raw logs)
  devLogSummaryHtml?: string;         // Dev log summary (.html — generated artifact, rich display)
  test?: string;                      // Test script path
  implementation?: string;            // Implementation code path
}

export type HarnessRoleStatus = 'idle' | 'running' | 'done' | 'error';

export interface FeatureHarnessAssignment {
  engineerRoleId?: string;
  assignedIDE?: IDEId;
  assignedTo?: string;
  assignedAt?: string;
  adapterId?: string;
  lastDispatchModel?: string;
  activePid?: number;
  status?: HarnessRoleStatus;
}

export interface FeatureHarnessAssignments {
  planner?: FeatureHarnessAssignment;
  worker?: FeatureHarnessAssignment;
  evaluator?: FeatureHarnessAssignment;
}

export interface FeatureAcceptanceChecklistItem {
  id: string;
  description: string;
  passes: boolean;
}

export interface Feature {
  id: string;
  name: string;
  category: string;
  status: FeatureStatus;
  progress: number;
  paths: FeaturePaths;
  /** Short human-authored summary or note. File pointers belong in readmePath / paths. */
  notes?: string;
  /** Relative path to the feature overview README (e.g. `.project-manager/features/F01/README.md`). */
  readmePath?: string;
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
  /** Estimated source section / area where the feature lives. */
  locatedSection?: string;
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
  /** Active developer or agent identifier set at dispatch time (e.g. adapter name). */
  assignedTo?: string;
  /** ISO 8601 timestamp when the task was claimed via dispatch. */
  assignedAt?: string;
  /** Optional multi-role assignments for harness-style workflows (Planner / Worker / Evaluator). */
  harnessAssignments?: FeatureHarnessAssignments;
  acceptanceChecklist?: FeatureAcceptanceChecklistItem[];
  // prompt engineer (row-level auto-loop config)
  promptConfig?: FeaturePromptConfig;
}

export interface ProjectConfig {
  name: string;
  root: string;
  defaultIDE: IDEId;
  /** GitHub repository URL, e.g. https://github.com/owner/repo */
  githubUrl?: string;
}

export interface AdapterDescriptor {
  id: string;
  name: string;
  type: AdapterType;
  /** UI/behavior class for dispatch targets. Defaults from `type` when omitted. */
  targetKind?: ExecutionTargetKind;
  /** Declared capability kinds this adapter can drive (schema v7). Technical ceiling — actual dispatch is further gated by candidate state. */
  supports?: CapabilityKind[];
  /** Adapter trait flags that bend capability dependency rules (schema v7). */
  traits?: AdapterTrait[];
}

export interface IDEAdapterConfig extends AdapterDescriptor {
  type: 'ide';
  command: string;
}

export interface AgentAdapterConfig extends AdapterDescriptor {
  type: 'agent';
  targetKind?: 'agent-cli';
  command: string;
  argsTemplate: string[];
}

export interface AgentAppAdapterConfig extends AdapterDescriptor {
  type: 'app';
  targetKind?: 'agent-app';
  command: string;
  argsTemplate: string[];
}

export interface AdapterConfig {
  ides: IDEAdapterConfig[];
  agents: AgentAdapterConfig[];
  apps?: AgentAppAdapterConfig[];
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

export type AnyAdapterConfig = IDEAdapterConfig | AgentAdapterConfig | AgentAppAdapterConfig;

export interface ProjectManagerConfig {
  /** Increment when making breaking changes to the config structure. Current: 8 */
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
  /** Qualification candidates surfaced in Integrations Hub sheets (schema v7). */
  capabilityCandidates?: CapabilityCandidate[];
}

// ── App navigation & run-store types ─────────────────────────────────────────

export interface WorkingScope {
  /** Directory paths this engineer is allowed to modify (e.g. "src/feature-x/"). */
  allowedPaths: string[];
  /**
   * soft  — scope is injected into the AI prompt as a constraint only.
   * strict — dispatch modal shows a red warning when the feature path is outside scope.
   */
  mode: 'soft' | 'strict';
}

/** One entry in an engineer role's primary model or ordered fallback chain. */
export interface ModelFallbackEntry {
  /** LLM provider id — matches LlmProviderId from llmProviders.ts. */
  providerId: string;
  /** Exact model identifier passed to the provider API, e.g. "gpt-5.5". */
  modelId: string;
}

// ── Engineer Capabilities (schema v7, F23) ───────────────────────────────────

/** Top-level capability kinds an engineer role may request. */
export type CapabilityKind = 'eyes' | 'voice-tts' | 'voice-stt' | 'hands' | 'recording';

/** Optional adapter trait flags that bend capability dependency rules. */
export type AdapterTrait = 'direct-access';

/** Which Integrations Hub sheet a capability candidate lives in. */
export type CandidateSheet = 'vla' | 'tts' | 'stt' | 'hands' | 'tools';

/**
 * Lifecycle state of a single candidate row in the Integrations Hub.
 * Only `passed` candidates appear in engineer-role dropdowns.
 */
export type CandidateState =
  | 'not_tested'
  | 'testing'
  | 'passed'
  | 'passed_disabled'
  | 'failed';

export interface CandidateRef {
  sheet: CandidateSheet;
  id: string;
}

export interface CandidateTestResult {
  ok: boolean;
  durationMs: number;
  /** Success summary or failure reason — surfaced to the user. */
  message: string;
}

export interface CapabilityCandidate {
  /** Unique within the candidate registry, e.g. "anthropic:claude-sonnet-4-6", "macos:say". */
  id: string;
  sheet: CandidateSheet;
  /** Human-readable label shown in the sheet and in role dropdowns. */
  label: string;
  /** Set for model-backed sheets (VLA / TTS / STT). */
  providerId?: string;
  modelId?: string;
  state: CandidateState;
  /** ISO 8601 timestamp of the most recent test run. */
  lastTestedAt?: string;
  lastTestResult?: CandidateTestResult;
  /** Cross-sheet dependencies blocking this candidate from `testing` until refs are `passed`. */
  requires?: CandidateRef[];
  /** Free-form per-candidate config (e.g. STT model preset, microphone device id). */
  config?: Record<string, unknown>;
}

export interface RoleCapabilityConfig {
  ttsVoice?: string;
  /** Candidate id (from VLA sheet) used as a second-pass transcript cleaner for STT. */
  sttCorrectionModelId?: string;
  handsConfirmMode?: 'per-action' | 'session-trust';
  /** Defaults to true; auto-relaxed when the active adapter has the `direct-access` trait. */
  handsRequiresEyes?: boolean;
  recordingDir?: string;
}

export interface RoleCapability {
  kind: CapabilityKind;
  /** Must reference a candidate from the matching sheet whose state is `passed`. */
  candidateId: string;
  config?: RoleCapabilityConfig;
}

export interface EngineerRole {
  id: string;
  name: string;
  slug: string;
  skills: string[];
  /** Relative paths from project root to SKILL.md (e.g. `.agents/skills/workflow/ship/SKILL.md`). */
  skillRefs?: string[];
  commands: string[];
  systemPrompt: string;
  referenceFiles: string[];
  defaultAgentId?: string;
  notes?: string;
  workingScope?: WorkingScope;
  /** Primary LLM model used when dispatching to this engineer. Stored on the role so dispatch modal stays simple. */
  primaryModel?: ModelFallbackEntry;
  /** Ordered fallback chain tried when primaryModel API call fails. Applies to direct LLM calls only, not CLI agent spawns. */
  modelFallbacks?: ModelFallbackEntry[];
  /** LLM provider used by the in-page Test panel. Empty = fall back to Settings provider order. */
  testProviderId?: string;
  /** Model id for the chosen test provider. Empty = use that provider's defaultModel. */
  testModel?: string;
  /** User-edited test prompt. Empty = auto-generate from name + skills + systemPrompt. */
  testPrompt?: string;
  /** Capability assignments (schema v7). Each references a `passed` candidate from the matching sheet. */
  capabilities?: RoleCapability[];
}

export type ViewId = 'dashboard' | 'features' | 'integrations-hub' | 'xmux' | 'settings' | 'engineers' | 'channels' | 'sessions' | 'cron-jobs' | 'logs' | 'keys' | 'ai-sdks' | 'documentation' | 'company-standards' | 'chat' | 'keyboard-shortcuts';

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

export interface RunCommandAction {
  type: 'run-command';
  command: string;
  args: string[];
  workingDir: string;
}

/**
 * Dispatch an engineer role with an assembled prompt (schema v8, ADR-012).
 * Prompt assembly stays in TS (ADR-003); the call routes through Rust
 * call_anthropic (ADR-004).
 */
export interface DispatchEngineerAction {
  type: 'dispatch-engineer';
  /** References ProjectManagerConfig.engineerRoles[].id on the same project. */
  roleId: string;
  /** Raw prompt text. Variable substitution (e.g. {{branch}}, {{date}}) deferred. */
  promptTemplate: string;
  /** Optional model override; falls back to role.primaryModel when absent. */
  modelOverride?: ModelFallbackEntry;
}

export type CronAction = RunCommandAction | DispatchEngineerAction;

/** Classified cron failure (schema v8). `reason` is set by the scheduler. */
export interface CronError {
  reason:
    | 'no_api_key'
    | 'role_missing'
    | 'provider_error'
    | 'invalid_response'
    | 'rate_limited'
    | 'spawn_failed'
    | 'unknown';
  message: string;
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
  /** Populated when lastStatus === 'error' (schema v8). */
  lastError?: CronError;
  createdAt: string;
}

export interface CronRun {
  jobId: string;
  jobName: string;
  firedAt: string;
  status: 'ok' | 'error';
  pid?: number;
  /** Set when status === 'error' (schema v8). */
  error?: CronError;
  /** First ~200 chars of dispatch-engineer LLM output for run-history display (schema v8). */
  outputSnippet?: string;
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
  phase: 'pending' | 'running' | 'done' | 'error';
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
  content: string | any;
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
