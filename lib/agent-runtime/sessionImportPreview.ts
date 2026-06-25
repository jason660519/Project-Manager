import type { AgentRuntimePathObservation, AgentRuntimeToolRow } from './types';

export type AgentRuntimeSessionImportPreviewState = 'ready' | 'blocked' | 'unsupported';

export interface AgentRuntimeSessionImportRootCandidate {
  path: string;
  exists: boolean;
  importMode: 'metadata_only';
  childCount?: number;
}

export interface AgentRuntimeSessionImportPreview {
  toolId: string;
  label: string;
  state: AgentRuntimeSessionImportPreviewState;
  summary: string;
  rootCandidates: AgentRuntimeSessionImportRootCandidate[];
  importableRootCount: number;
  blockedReasons: string[];
  nextAction: string;
}

function sessionRootCandidates(paths: AgentRuntimePathObservation[]): AgentRuntimeSessionImportRootCandidate[] {
  return paths
    .filter((path) => path.kind === 'sessions-root')
    .map((path) => ({
      path: path.path,
      exists: path.exists,
      importMode: 'metadata_only' as const,
      ...(typeof path.childCount === 'number' ? { childCount: path.childCount } : {}),
    }));
}

function nextActionFor(state: AgentRuntimeSessionImportPreviewState): string {
  if (state === 'ready') return 'Review metadata-only import candidates.';
  if (state === 'unsupported') return 'No session import action is available for this runtime.';
  return 'Configure or run the agent once so a session root exists.';
}

function aggregateKnownChildCount(rootCandidates: AgentRuntimeSessionImportRootCandidate[]): number | null {
  const importableWithCounts = rootCandidates.filter(
    (root) => root.exists && typeof root.childCount === 'number' && Number.isFinite(root.childCount),
  );
  if (importableWithCounts.length === 0) return null;
  return importableWithCounts.reduce((sum, root) => sum + (root.childCount ?? 0), 0);
}

function summaryFor(
  state: AgentRuntimeSessionImportPreviewState,
  importableRootCount: number,
  rootCandidates: AgentRuntimeSessionImportRootCandidate[],
  blockedReasons: string[],
): string {
  if (state === 'ready') {
    const childCount = aggregateKnownChildCount(rootCandidates);
    if (childCount !== null) {
      return `Session import preview: ${importableRootCount} metadata-only root(s) ready with ${childCount} artifact candidate(s).`;
    }
    return `Session import preview: ${importableRootCount} metadata-only root(s) ready.`;
  }
  const reason = blockedReasons.length > 0 ? ` ${blockedReasons.join(' ')}` : '';
  return `Session import preview: ${state}.${reason}`;
}

export function buildAgentRuntimeSessionImportPreview(
  row: AgentRuntimeToolRow,
): AgentRuntimeSessionImportPreview {
  const rootCandidates = sessionRootCandidates(row.paths);
  const importableRootCount = rootCandidates.filter((root) => root.exists).length;
  const blockedReasons: string[] = [];

  let state: AgentRuntimeSessionImportPreviewState = 'ready';
  if (row.capabilities.sessions !== true) {
    state = 'unsupported';
    blockedReasons.push('Runtime does not advertise session import support.');
  } else if (rootCandidates.length === 0) {
    state = 'blocked';
    blockedReasons.push('No session root candidates are registered.');
  } else if (importableRootCount === 0) {
    state = 'blocked';
    blockedReasons.push('No existing session root was detected.');
  }

  return {
    toolId: row.toolId,
    label: row.label,
    state,
    summary: summaryFor(state, importableRootCount, rootCandidates, blockedReasons),
    rootCandidates,
    importableRootCount,
    blockedReasons,
    nextAction: nextActionFor(state),
  };
}
