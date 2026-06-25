import {
  buildAgentRuntimeSessionCostSummary,
  buildAgentRuntimeSessionImportApproval,
  buildAgentRuntimeSessionImportDryRun,
  buildAgentRuntimeSessionImportPreview,
  buildAgentRuntimeSessionEnvelopeSummary,
  buildAgentRuntimeSessionEnvelopeParseAction,
} from '../../agent-runtime';
import type { AgentRuntimeSessionEnvelopeParseAction } from '../../agent-runtime';
import type {
  AgentRuntimeCapability,
  AgentRuntimePathKind,
  AgentRuntimePathObservation,
  AgentRuntimeSessionEnvelopeSummaryInput,
  AgentRuntimeToolRow,
  AgentRuntimeToolStatus,
  AgentRuntimeWarning,
} from '../../agent-runtime';
import type { IntegrationRow } from '../types';

type AgentRuntimeDetailState = 'ready' | 'partial' | 'missing' | 'unsupported';

export interface AgentRuntimeDetailEvidence {
  kind: AgentRuntimePathKind;
  path: string;
  exists: boolean;
  required: boolean;
  secretBearing: boolean;
}

export interface AgentRuntimeDetailMessage {
  code: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  path?: string;
}

export interface AgentRuntimeDetailGroup {
  id: AgentRuntimeCapability;
  label: string;
  state: AgentRuntimeDetailState;
  summary: string;
  evidence: AgentRuntimeDetailEvidence[];
  details: string[];
}

export interface AgentRuntimeDetailModel {
  title: string;
  toolId: string;
  status: AgentRuntimeToolStatus;
  loadedAt: string;
  command: {
    label: string;
    available: boolean;
  };
  groups: AgentRuntimeDetailGroup[];
  warnings: AgentRuntimeDetailMessage[];
  diagnostics: AgentRuntimeDetailMessage[];
}

interface AgentRuntimeDetailPayload {
  rowId?: string;
  toolId?: string;
  label?: string;
  command?: string;
  commandAvailable?: boolean;
  status?: AgentRuntimeToolStatus;
  capabilities?: Partial<Record<AgentRuntimeCapability, boolean>>;
  paths?: AgentRuntimePathObservation[];
  warnings?: AgentRuntimeWarning[];
  sessionEnvelope?: AgentRuntimeSessionEnvelopeSummaryInput | null;
  sessionTargets?: unknown[];
}

export interface AgentRuntimeSessionEnvelopeUiParseActionInput {
  approved: boolean;
  targetPath: string;
  maxBytes?: number;
  approvedBy?: string;
}

export interface AgentRuntimeRedactedSessionTargetOption {
  id: string;
  label: string;
  summary: string;
  targetPath: string;
  rootPath: string;
  byteLength: number | null;
  modifiedAt: string | null;
}

const GROUPS: Array<{
  id: AgentRuntimeCapability;
  label: string;
  pathKinds: AgentRuntimePathKind[];
}> = [
  {
    id: 'runtime',
    label: 'Agent Runtime',
    pathKinds: ['binary', 'config-root', 'config-file', 'secret-file'],
  },
  {
    id: 'mcp',
    label: 'MCP',
    pathKinds: ['mcp-file'],
  },
  {
    id: 'skills',
    label: 'Skills',
    pathKinds: ['skills-root'],
  },
  {
    id: 'sessions',
    label: 'Session',
    pathKinds: ['sessions-root'],
  },
  {
    id: 'cost',
    label: 'Cost',
    pathKinds: [],
  },
];

function agentRuntimePayload(value: unknown): AgentRuntimeDetailPayload | null {
  if (!value || typeof value !== 'object') return null;
  return value as AgentRuntimeDetailPayload;
}

function existingSessionRoots(paths: AgentRuntimePathObservation[]): string[] {
  return paths
    .filter((path) => path.kind === 'sessions-root' && path.exists)
    .map((path) => path.path.replace(/\/+$/, ''))
    .filter(Boolean);
}

function isPathInsideRoot(targetPath: string, rootPath: string): boolean {
  const target = targetPath.trim();
  const root = rootPath.trim().replace(/\/+$/, '');
  return target === root || target.startsWith(`${root}/`);
}

function safeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
}

function safeString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function targetSummary(label: string, byteLength: number | null, modifiedAt: string | null): string {
  const parts = [label];
  if (byteLength !== null) parts.push(`${byteLength} byte(s)`);
  if (modifiedAt) parts.push(`modified ${modifiedAt}`);
  return parts.join(' · ');
}

function messageList(value: unknown): AgentRuntimeDetailMessage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const code = typeof record.code === 'string' ? record.code : '';
    const message = typeof record.message === 'string' ? record.message : '';
    const severity = record.severity === 'error' || record.severity === 'warning' ? record.severity : 'info';
    const path = typeof record.path === 'string' ? record.path : undefined;
    if (!code && !message) return [];
    return [{ code, message, severity, path }];
  });
}

function evidenceFor(
  paths: AgentRuntimePathObservation[],
  pathKinds: AgentRuntimePathKind[],
): AgentRuntimeDetailEvidence[] {
  if (pathKinds.length === 0) return [];
  return paths
    .filter((path) => pathKinds.includes(path.kind))
    .map((path) => ({
      kind: path.kind,
      path: path.path,
      exists: path.exists,
      required: path.required,
      secretBearing: path.secretBearing,
    }));
}

function groupState(
  capabilityEnabled: boolean,
  evidence: AgentRuntimeDetailEvidence[],
  toolStatus: AgentRuntimeToolStatus,
): AgentRuntimeDetailState {
  if (toolStatus === 'unsupported') return 'unsupported';
  if (capabilityEnabled && evidence.some((item) => item.exists)) return 'ready';
  if (capabilityEnabled) return 'partial';
  return 'missing';
}

function groupSummary(state: AgentRuntimeDetailState, evidence: AgentRuntimeDetailEvidence[]): string {
  const existingCount = evidence.filter((item) => item.exists).length;
  if (state === 'ready') return `${existingCount} evidence item(s) detected.`;
  if (state === 'partial') return 'Capability flag is present, but no matching path evidence was detected.';
  if (state === 'unsupported') return 'This runtime is not supported by the current scanner.';
  return 'No matching evidence detected.';
}

function runtimeToolRow(
  payload: AgentRuntimeDetailPayload,
  row: IntegrationRow,
  paths: AgentRuntimePathObservation[],
): AgentRuntimeToolRow {
  return {
    rowId: payload.rowId || row.rowKey,
    toolId: payload.toolId || row.sourceId,
    label: payload.label || row.name,
    command: payload.command,
    commandAvailable: payload.commandAvailable === true,
    status: payload.status ?? 'missing',
    capabilities: {
      runtime: payload.capabilities?.runtime === true,
      mcp: payload.capabilities?.mcp === true,
      skills: payload.capabilities?.skills === true,
      sessions: payload.capabilities?.sessions === true,
      cost: payload.capabilities?.cost === true,
    },
    paths,
    warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
  };
}

function summaryForGroup(
  groupId: AgentRuntimeCapability,
  state: AgentRuntimeDetailState,
  evidence: AgentRuntimeDetailEvidence[],
  sessionCost: ReturnType<typeof buildAgentRuntimeSessionCostSummary>,
): string {
  if (groupId === 'sessions') return sessionCost.session.summary;
  if (groupId === 'cost') return sessionCost.cost.reason;
  return groupSummary(state, evidence);
}

function detailsForGroup(
  groupId: AgentRuntimeCapability,
  sessionPreview: ReturnType<typeof buildAgentRuntimeSessionImportPreview>,
  sessionEnvelope: AgentRuntimeSessionEnvelopeSummaryInput | null | undefined,
): string[] {
  if (groupId !== 'sessions') return [];
  const dryRun = buildAgentRuntimeSessionImportDryRun(sessionPreview);
  const approval = buildAgentRuntimeSessionImportApproval(dryRun);
  const parseAction = buildAgentRuntimeSessionEnvelopeParseAction({
    approval,
    parseConfirmed: false,
    targetPath: '',
    maxBytes: 65536,
  });
  const envelopeSummary = buildAgentRuntimeSessionEnvelopeSummary(sessionEnvelope);
  return [sessionPreview.summary, dryRun.summary, approval.summary, parseAction.summary, envelopeSummary].filter(
    (detail): detail is string => typeof detail === 'string',
  );
}

export function buildAgentRuntimeDetailModel(row: IntegrationRow): AgentRuntimeDetailModel | null {
  if (row.sourceKind !== 'agent-runtime') return null;

  const payload = agentRuntimePayload(row.payload.agentRuntime);
  if (!payload) return null;

  const paths = Array.isArray(payload.paths) ? payload.paths : [];
  const capabilities = payload.capabilities ?? {};
  const status = payload.status ?? 'missing';
  const toolRow = runtimeToolRow(payload, row, paths);
  const sessionCost = buildAgentRuntimeSessionCostSummary(toolRow);
  const sessionPreview = buildAgentRuntimeSessionImportPreview(toolRow);

  return {
    title: payload.label || row.name,
    toolId: payload.toolId || row.sourceId,
    status,
    loadedAt: typeof row.payload.loadedAt === 'string' ? row.payload.loadedAt : row.lastUpdated,
    command: {
      label: payload.command || '',
      available: payload.commandAvailable === true,
    },
    groups: GROUPS.map((group) => {
      const evidence = evidenceFor(paths, group.pathKinds);
      const state = groupState(capabilities[group.id] === true, evidence, status);
      return {
        id: group.id,
        label: group.label,
        state,
        summary: summaryForGroup(group.id, state, evidence, sessionCost),
        evidence,
        details: detailsForGroup(group.id, sessionPreview, payload.sessionEnvelope),
      };
    }),
    warnings: messageList(payload.warnings),
    diagnostics: messageList(row.payload.diagnostics),
  };
}

export function buildAgentRuntimeRedactedSessionTargetOptions(
  row: IntegrationRow,
): AgentRuntimeRedactedSessionTargetOption[] {
  if (row.sourceKind !== 'agent-runtime') return [];

  const payload = agentRuntimePayload(row.payload.agentRuntime);
  if (!payload) return [];

  const paths = Array.isArray(payload.paths) ? payload.paths : [];
  const roots = existingSessionRoots(paths);
  if (roots.length === 0 || !Array.isArray(payload.sessionTargets)) return [];

  const options: AgentRuntimeRedactedSessionTargetOption[] = [];

  for (const candidate of payload.sessionTargets) {
    if (!candidate || typeof candidate !== 'object') continue;
    const record = candidate as Record<string, unknown>;
    const targetPath = safeString(record.targetPath);
    if (!targetPath) continue;

    const matchingRoot = roots.find((root) => isPathInsideRoot(targetPath, root));
    if (!matchingRoot) continue;

    const byteLength = safeNumber(record.byteLength);
    const modifiedAt = safeString(record.modifiedAt);
    const index = options.length + 1;
    const label = `Session target ${index}`;

    options.push({
      id: `session-target-${index}`,
      label,
      summary: targetSummary(label, byteLength, modifiedAt),
      targetPath,
      rootPath: matchingRoot,
      byteLength,
      modifiedAt,
    });
  }

  return options;
}

export function buildAgentRuntimeSessionEnvelopeUiParseAction(
  row: IntegrationRow,
  input: AgentRuntimeSessionEnvelopeUiParseActionInput,
): AgentRuntimeSessionEnvelopeParseAction | null {
  if (row.sourceKind !== 'agent-runtime') return null;

  const payload = agentRuntimePayload(row.payload.agentRuntime);
  if (!payload) return null;

  const paths = Array.isArray(payload.paths) ? payload.paths : [];
  const toolRow = runtimeToolRow(payload, row, paths);
  const preview = buildAgentRuntimeSessionImportPreview(toolRow);
  const dryRun = buildAgentRuntimeSessionImportDryRun(preview);
  const approval = buildAgentRuntimeSessionImportApproval(dryRun, {
    approved: input.approved,
    ...(input.approvedBy ? { approvedBy: input.approvedBy } : {}),
  });

  return buildAgentRuntimeSessionEnvelopeParseAction({
    approval,
    parseConfirmed: input.approved,
    targetPath: input.targetPath,
    maxBytes: input.maxBytes ?? 65536,
  });
}
