import type {
  AIAssistantConfig,
  AIAssistantsConsoleState,
  AssistantAuditEvent,
  AssistantDailyLog,
  AssistantDreamJob,
  AssistantPermissionRule,
  AssistantProfileSource,
  AssistantSkillConfig,
} from './types';

const NOW = '2026-05-26T00:00:00.000Z';

export const PROFILE_SOURCE_LABELS: Record<AssistantProfileSource['kind'], string> = {
  agents: 'AGENTS.md',
  soul: 'soul.md',
  tools: 'tools',
  identity: 'identity.md',
  user: 'user.md',
  heartbeat: 'heartbeat.md',
  memory: 'memory.md',
};

function source(
  kind: AssistantProfileSource['kind'],
  path: string,
  readOnly: boolean,
  liveEffect: AssistantProfileSource['liveEffect'],
  content: string,
): AssistantProfileSource {
  return {
    kind,
    label: PROFILE_SOURCE_LABELS[kind],
    path,
    readOnly,
    version: 1,
    contentHash: `sha256:${kind}-draft`,
    liveEffect,
    content,
    updatedAt: NOW,
  };
}

const skills: AssistantSkillConfig[] = [
  {
    id: 'project-search',
    name: 'Project Search',
    sourcePath: 'lib/chat/tools.ts#search_code',
    version: '1.0.0',
    enabled: true,
    requiredTools: ['rg'],
    requiredEnv: [],
    dependencyStatus: 'ready',
    capabilityMatch: 'matched',
    allowedAssistantIds: ['pm-assistant'],
    risk: 'low',
    lastCheckedAt: NOW,
  },
  {
    id: 'file-reader',
    name: 'File Reader',
    sourcePath: 'lib/chat/tools.ts#read_file',
    version: '1.0.0',
    enabled: true,
    requiredTools: ['fs'],
    requiredEnv: [],
    dependencyStatus: 'ready',
    capabilityMatch: 'matched',
    allowedAssistantIds: ['pm-assistant'],
    risk: 'medium',
    lastCheckedAt: NOW,
  },
  {
    id: 'command-runner',
    name: 'Guarded Command Runner',
    sourcePath: 'lib/chat/tools.ts#run_command',
    version: '0.1.0',
    enabled: false,
    requiredTools: ['shell'],
    requiredEnv: ['PROJECT_MANAGER_AGENT_CONFIRMATION'],
    dependencyStatus: 'degraded',
    capabilityMatch: 'needs-permission',
    allowedAssistantIds: ['pm-assistant'],
    risk: 'high',
    lastCheckedAt: NOW,
  },
  {
    id: 'memory-review',
    name: 'Memory Review',
    sourcePath: '.project-manager/assistants/pm-assistant/profile/memory.md',
    version: '0.1.0',
    enabled: true,
    requiredTools: ['profile-resolver'],
    requiredEnv: [],
    dependencyStatus: 'ready',
    capabilityMatch: 'matched',
    allowedAssistantIds: ['pm-assistant'],
    risk: 'medium',
    lastCheckedAt: NOW,
  },
];

const logs: AssistantDailyLog[] = [
  {
    id: 'log-001',
    date: '2026-05-26',
    timestamp: '2026-05-26T08:29:00.000Z',
    assistantId: 'pm-assistant',
    category: 'chat',
    severity: 'info',
    message: 'Local /help command answered from client-side command registry.',
    relatedSessionId: 'local-session',
  },
  {
    id: 'log-002',
    date: '2026-05-26',
    timestamp: '2026-05-26T08:30:00.000Z',
    assistantId: 'pm-assistant',
    category: 'security',
    severity: 'warning',
    message: 'Command runner skill remains disabled until permission sheet grants guarded execution.',
  },
  {
    id: 'log-003',
    date: '2026-05-26',
    timestamp: '2026-05-26T08:31:00.000Z',
    assistantId: 'pm-assistant',
    category: 'gateway',
    severity: 'info',
    message: 'Gateway token stored as secret reference only; raw token is never rendered.',
  },
];

const dreamJobs: AssistantDreamJob[] = [
  {
    id: 'dream-001',
    name: 'Session Memory Consolidation',
    taskType: 'memory_consolidation',
    status: 'queued',
    progress: 0,
    resourceProfile: 'low',
    concurrencyLimit: 1,
    canMutateMemory: false,
    queuedAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'dream-002',
    name: 'Daily Log Anomaly Cluster',
    taskType: 'log_anomaly_clustering',
    status: 'paused',
    progress: 35,
    resourceProfile: 'balanced',
    concurrencyLimit: 1,
    canMutateMemory: false,
    queuedAt: NOW,
    updatedAt: NOW,
  },
];

const permissions: AssistantPermissionRule[] = [
  {
    id: 'perm-read-profile',
    scope: 'profile:read',
    description: 'Read assistant profile sources and resolved prompt metadata.',
    risk: 'low',
    state: 'granted',
    requiresConfirmation: false,
    appliesTo: ['profile', 'chat'],
  },
  {
    id: 'perm-write-profile',
    scope: 'profile:write',
    description: 'Edit assistant-owned profile files under .project-manager/assistants.',
    risk: 'medium',
    state: 'guarded',
    requiresConfirmation: true,
    appliesTo: ['profile'],
  },
  {
    id: 'perm-run-command',
    scope: 'tool:run_command',
    description: 'Allow shell command execution in the selected project root.',
    risk: 'high',
    state: 'blocked',
    requiresConfirmation: true,
    appliesTo: ['skills', 'chat'],
  },
  {
    id: 'perm-web-search',
    scope: 'network:web_search',
    description: 'Allow outbound web searches from assistant tool calls.',
    risk: 'medium',
    state: 'guarded',
    requiresConfirmation: true,
    appliesTo: ['skills', 'chat'],
  },
  {
    id: 'perm-dream-mutate-memory',
    scope: 'dreaming:memory_write',
    description: 'Allow offline jobs to write memory updates without manual merge.',
    risk: 'high',
    state: 'blocked',
    requiresConfirmation: true,
    appliesTo: ['dreaming', 'profile'],
  },
];

const auditEvents: AssistantAuditEvent[] = [
  {
    id: 'audit-001',
    timestamp: NOW,
    actor: 'system',
    action: 'Initialized assistant control surface defaults',
    target: 'pm-assistant',
    risk: 'low',
    outcome: 'recorded',
  },
  {
    id: 'audit-002',
    timestamp: NOW,
    actor: 'policy',
    action: 'Blocked command execution until guarded permission is granted',
    target: 'tool:run_command',
    risk: 'high',
    outcome: 'blocked',
  },
];

export function createDefaultAssistant(): AIAssistantConfig {
  return {
    id: 'pm-assistant',
    name: 'Project Manager Assistant',
    status: 'untested',
    owner: 'Project Manager',
    instance: {
      id: 'pm-local',
      label: 'Local Project Manager Gateway',
      runtimeMode: 'browser-dry-run',
      gatewayAccess: 'http://localhost:43187/api/chat/agent',
      websocketUrl: 'ws://localhost:43187/assistant-events',
      gatewayTokenSecretRef: 'pm.assistant.pm-assistant.gatewayToken',
      gatewayTokenStatus: 'missing',
      connectionStatus: 'untested',
      permissionScope: ['profile:read', 'chat:send', 'tool:search_code', 'tool:read_file'],
      validationNotes: [
        'Localhost HTTP/WS is allowed only for browser development mode.',
        'Gateway token must be stored as a secret reference, not localStorage plaintext.',
      ],
    },
    profileSources: [
      source('agents', 'AGENTS.md', true, 'next-message', 'Repo-level AI engineer workflow rules. Read-only in this console.'),
      source('soul', '.project-manager/assistants/pm-assistant/profile/soul.md', false, 'next-message', 'Calm operational assistant. Use concise Traditional Chinese by default.'),
      source('tools', '.project-manager/assistants/pm-assistant/profile/tools.md', false, 'runtime-reload', 'Search and read-file tools are enabled. Command execution requires guarded approval.'),
      source('identity', '.project-manager/assistants/pm-assistant/profile/identity.md', false, 'runtime-reload', 'Name: Project Manager Assistant. Scope: engineering operations and agent control.'),
      source('user', '.project-manager/assistants/pm-assistant/profile/user.md', false, 'next-message', 'Prefer evidence-backed verification and concise Traditional Chinese summaries.'),
      source('heartbeat', '.project-manager/assistants/pm-assistant/profile/heartbeat.md', false, 'runtime-reload', 'Heartbeat jobs are disabled until an explicit automation is configured.'),
      source('memory', '.project-manager/assistants/pm-assistant/profile/memory.md', false, 'manual-review', 'Memory updates require review before merge.'),
    ],
    skills,
    dailyLogs: logs,
    dreamJobs,
    permissions,
    auditEvents,
    updatedAt: NOW,
  };
}

export function createDefaultConsoleState(): AIAssistantsConsoleState {
  const assistant = createDefaultAssistant();
  return {
    selectedAssistantId: assistant.id,
    assistants: [assistant],
  };
}
