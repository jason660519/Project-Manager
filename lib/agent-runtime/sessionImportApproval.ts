import type { AgentRuntimeSessionImportDryRun } from './sessionImportDryRun';

export type AgentRuntimeSessionImportApprovalStatus =
  | 'approved'
  | 'needs_approval'
  | 'blocked'
  | 'unsupported';

export interface AgentRuntimeSessionImportApprovalDecision {
  approved: boolean;
  approvedBy?: string;
}

export interface AgentRuntimeSessionImportReaderRequest {
  toolId: string;
  label: string;
  mode: 'transcript_reader_pending';
  rootPaths: string[];
  artifactCandidateCount: number | null;
  approvedBy?: string;
}

export interface AgentRuntimeSessionImportApproval {
  toolId: string;
  label: string;
  status: AgentRuntimeSessionImportApprovalStatus;
  summary: string;
  readerRequest: AgentRuntimeSessionImportReaderRequest | null;
  blockedReasons: string[];
}

const APPROVAL_REQUIRED_REASON =
  'Review and explicitly approve the metadata-only dry run before reading transcripts.';

function summaryForApproved(rootCount: number, artifactCandidateCount: number | null): string {
  if (artifactCandidateCount !== null) {
    return `Session import approval: approved for ${rootCount} root(s) with ${artifactCandidateCount} artifact candidate(s).`;
  }
  return `Session import approval: approved for ${rootCount} root(s).`;
}

function summaryForBlocked(status: Exclude<AgentRuntimeSessionImportApprovalStatus, 'approved'>, reasons: string[]): string {
  const label = status === 'needs_approval' ? 'needs approval' : status;
  const reason = reasons.length > 0 ? ` ${reasons.join(' ')}` : '';
  return `Session import approval: ${label}.${reason}`;
}

function blockedStatusFor(
  dryRun: AgentRuntimeSessionImportDryRun,
): Exclude<AgentRuntimeSessionImportApprovalStatus, 'approved' | 'needs_approval'> {
  if (dryRun.status === 'unsupported') return 'unsupported';
  return 'blocked';
}

export function buildAgentRuntimeSessionImportApproval(
  dryRun: AgentRuntimeSessionImportDryRun,
  decision: AgentRuntimeSessionImportApprovalDecision = { approved: false },
): AgentRuntimeSessionImportApproval {
  if (dryRun.status !== 'ready') {
    const status = blockedStatusFor(dryRun);
    const blockedReasons = [...dryRun.blockedReasons];
    return {
      toolId: dryRun.toolId,
      label: dryRun.label,
      status,
      summary: summaryForBlocked(status, blockedReasons),
      readerRequest: null,
      blockedReasons,
    };
  }

  if (decision.approved !== true) {
    const blockedReasons = [APPROVAL_REQUIRED_REASON];
    return {
      toolId: dryRun.toolId,
      label: dryRun.label,
      status: 'needs_approval',
      summary: summaryForBlocked('needs_approval', blockedReasons),
      readerRequest: null,
      blockedReasons,
    };
  }

  const rootPaths = dryRun.planItems.map((item) => item.rootPath);
  const readerRequest: AgentRuntimeSessionImportReaderRequest = {
    toolId: dryRun.toolId,
    label: dryRun.label,
    mode: 'transcript_reader_pending',
    rootPaths,
    artifactCandidateCount: dryRun.artifactCandidateCount,
    ...(decision.approvedBy ? { approvedBy: decision.approvedBy } : {}),
  };

  return {
    toolId: dryRun.toolId,
    label: dryRun.label,
    status: 'approved',
    summary: summaryForApproved(rootPaths.length, dryRun.artifactCandidateCount),
    readerRequest,
    blockedReasons: [],
  };
}
