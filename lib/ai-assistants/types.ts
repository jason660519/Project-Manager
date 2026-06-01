export type AIAssistantSheetId =
  | 'chat'
  | 'engineers'
  | 'overview'
  | 'profile'
  | 'skills'
  | 'workflow-runs'
  | 'daily-logs'
  | 'dreaming'
  | 'permissions'
  | 'audit';

export type AssistantRuntimeMode = 'browser-dry-run' | 'tauri-live' | 'gateway';
export type AssistantConnectionStatus = 'connected' | 'degraded' | 'offline' | 'untested';
export type AssistantSecretStatus = 'configured' | 'missing' | 'rotating';
export type ProfileSourceKind =
  | 'agents'
  | 'soul'
  | 'tools'
  | 'identity'
  | 'user'
  | 'heartbeat'
  | 'memory';
export type PermissionRisk = 'low' | 'medium' | 'high';
export type PermissionState = 'granted' | 'guarded' | 'blocked';
export type SkillDependencyStatus = 'ready' | 'missing' | 'degraded';
export type DailyLogCategory =
  | 'chat'
  | 'tool_call'
  | 'gateway'
  | 'websocket'
  | 'heartbeat'
  | 'skill'
  | 'dream_job'
  | 'security'
  | 'error';
export type DailyLogSeverity = 'info' | 'warning' | 'error';
export type DreamJobStatus = 'queued' | 'running' | 'paused' | 'completed' | 'failed';

export interface AssistantInstanceConfig {
  id: string;
  label: string;
  runtimeMode: AssistantRuntimeMode;
  gatewayAccess: string;
  websocketUrl: string;
  gatewayTokenSecretRef: string;
  gatewayTokenStatus: AssistantSecretStatus;
  connectionStatus: AssistantConnectionStatus;
  permissionScope: string[];
  lastValidatedAt?: string;
  validationNotes: string[];
}

export interface AssistantProfileSource {
  kind: ProfileSourceKind;
  label: string;
  path: string;
  readOnly: boolean;
  version: number;
  contentHash: string;
  liveEffect: 'next-message' | 'runtime-reload' | 'manual-review';
  content: string;
  updatedAt: string;
}

export interface AssistantSkillConfig {
  id: string;
  name: string;
  sourcePath: string;
  version: string;
  enabled: boolean;
  requiredTools: string[];
  requiredEnv: string[];
  dependencyStatus: SkillDependencyStatus;
  capabilityMatch: 'matched' | 'needs-permission' | 'incompatible';
  allowedAssistantIds: string[];
  risk: PermissionRisk;
  lastCheckedAt?: string;
}

export interface AssistantDailyLog {
  id: string;
  date: string;
  timestamp: string;
  assistantId: string;
  category: DailyLogCategory;
  severity: DailyLogSeverity;
  message: string;
  relatedSessionId?: string;
}

export interface AssistantDreamJob {
  id: string;
  name: string;
  taskType: string;
  status: DreamJobStatus;
  progress: number;
  resourceProfile: 'low' | 'balanced' | 'aggressive';
  concurrencyLimit: number;
  canMutateMemory: boolean;
  queuedAt: string;
  updatedAt: string;
}

export interface AssistantPermissionRule {
  id: string;
  scope: string;
  description: string;
  risk: PermissionRisk;
  state: PermissionState;
  requiresConfirmation: boolean;
  appliesTo: string[];
}

export interface AssistantAuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  risk: PermissionRisk;
  outcome: 'recorded' | 'blocked' | 'requires-review';
}

export type TerminalCommandListKind = 'whitelist' | 'blacklist';
export type TerminalPolicyMode = 'default-deny' | 'default-allow';

export interface TerminalCommandRule {
  id: string;
  pattern: string;
  description: string;
  category: string;
  listKind: TerminalCommandListKind;
}

export interface TerminalOperationalBoundaries {
  policyMode: TerminalPolicyMode;
  whitelist: TerminalCommandRule[];
  blacklist: TerminalCommandRule[];
  updatedAt: string;
}

export type TerminalBlockSuggestionStatus = 'pending' | 'accepted' | 'dismissed';

export interface TerminalBlockSuggestion {
  id: string;
  command: string;
  normalizedCommand: string;
  reason: string;
  matchedRuleId?: string;
  blockedSegment?: string;
  status: TerminalBlockSuggestionStatus;
  createdAt: string;
  reviewedAt?: string;
  source: 'tool_executor' | 'xmux_terminal' | 'manual';
}

export interface AIAssistantConfig {
  id: string;
  name: string;
  status: AssistantConnectionStatus;
  owner: string;
  instance: AssistantInstanceConfig;
  profileSources: AssistantProfileSource[];
  skills: AssistantSkillConfig[];
  dailyLogs: AssistantDailyLog[];
  dreamJobs: AssistantDreamJob[];
  permissions: AssistantPermissionRule[];
  terminalBoundaries: TerminalOperationalBoundaries;
  terminalBlockSuggestions: TerminalBlockSuggestion[];
  auditEvents: AssistantAuditEvent[];
  updatedAt: string;
}

export interface AIAssistantsConsoleState {
  selectedAssistantId: string;
  assistants: AIAssistantConfig[];
}
