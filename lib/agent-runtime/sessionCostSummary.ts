import type { AgentRuntimePathObservation, AgentRuntimeToolRow } from './types';

export type AgentRuntimeSessionEvidenceState = 'ready' | 'missing' | 'unsupported';
export type AgentRuntimeCostEvidenceState =
  | 'evidence_available'
  | 'missing_session_evidence'
  | 'unsupported';

export interface AgentRuntimeSessionRootSummary {
  path: string;
  exists: boolean;
  required: boolean;
}

export interface AgentRuntimeSessionCostSummary {
  toolId: string;
  label: string;
  session: {
    state: AgentRuntimeSessionEvidenceState;
    candidateRootCount: number;
    existingRootCount: number;
    roots: AgentRuntimeSessionRootSummary[];
    summary: string;
  };
  cost: {
    state: AgentRuntimeCostEvidenceState;
    source: 'session-root' | 'none';
    reason: string;
  };
}

function sessionRoots(paths: AgentRuntimePathObservation[]): AgentRuntimeSessionRootSummary[] {
  return paths
    .filter((path) => path.kind === 'sessions-root')
    .map((path) => ({
      path: path.path,
      exists: path.exists,
      required: path.required,
    }));
}

function sessionSummary(
  roots: AgentRuntimeSessionRootSummary[],
  sessionsSupported: boolean,
): AgentRuntimeSessionCostSummary['session'] {
  const existingRootCount = roots.filter((root) => root.exists).length;
  const candidateRootCount = roots.length;

  if (!sessionsSupported) {
    return {
      state: 'unsupported',
      candidateRootCount,
      existingRootCount,
      roots,
      summary: 'This runtime does not advertise session import evidence.',
    };
  }

  if (existingRootCount > 0) {
    return {
      state: 'ready',
      candidateRootCount,
      existingRootCount,
      roots,
      summary: `${existingRootCount} of ${candidateRootCount} session root(s) detected.`,
    };
  }

  return {
    state: 'missing',
    candidateRootCount,
    existingRootCount,
    roots,
    summary: candidateRootCount > 0
      ? `0 of ${candidateRootCount} session root(s) detected.`
      : 'No session root candidates are registered for this runtime.',
  };
}

function costSummary(
  costSupported: boolean,
  session: AgentRuntimeSessionCostSummary['session'],
): AgentRuntimeSessionCostSummary['cost'] {
  if (!costSupported) {
    return {
      state: 'unsupported',
      source: 'none',
      reason: 'This runtime does not advertise cost evidence in the current catalog.',
    };
  }

  if (session.state === 'ready') {
    return {
      state: 'evidence_available',
      source: 'session-root',
      reason: 'Session evidence is available for future cost import.',
    };
  }

  return {
    state: 'missing_session_evidence',
    source: 'none',
    reason: 'No existing session root was detected for future cost import.',
  };
}

export function buildAgentRuntimeSessionCostSummary(
  row: AgentRuntimeToolRow,
): AgentRuntimeSessionCostSummary {
  const roots = sessionRoots(row.paths);
  const session = sessionSummary(roots, row.capabilities.sessions === true);
  return {
    toolId: row.toolId,
    label: row.label,
    session,
    cost: costSummary(row.capabilities.cost === true, session),
  };
}
