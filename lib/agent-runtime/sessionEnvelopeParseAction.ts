import type { AgentRuntimeSessionBoundaryRequest } from '../bridge';
import type {
  AgentRuntimeSessionImportApproval,
  AgentRuntimeSessionImportApprovalStatus,
} from './sessionImportApproval';

export type AgentRuntimeSessionEnvelopeParseActionStatus =
  | 'ready'
  | 'needs_approval'
  | 'blocked'
  | 'unsupported';

export interface AgentRuntimeSessionEnvelopeParseActionInput {
  approval: AgentRuntimeSessionImportApproval;
  parseConfirmed: boolean;
  targetPath: string;
  maxBytes: number;
}

export interface AgentRuntimeSessionEnvelopeParseAction {
  toolId: string;
  label: string;
  status: AgentRuntimeSessionEnvelopeParseActionStatus;
  summary: string;
  parseRequest: AgentRuntimeSessionBoundaryRequest | null;
  blockedReasons: string[];
}

const PARSE_CONFIRMATION_REQUIRED =
  'Confirm envelope parsing after reviewing the approved reader boundary.';
const TARGET_REQUIRED = 'Select one session target before parsing its envelope.';
const MAX_BYTES_REQUIRED = 'Set a positive finite max byte limit before parsing.';

function blockedSummary(status: AgentRuntimeSessionEnvelopeParseActionStatus, reasons: string[]): string {
  const label = status === 'needs_approval' ? 'needs approval' : status;
  const reason = reasons.length > 0 ? ` ${reasons.join(' ')}` : '';
  return `Session envelope parse action: ${label}.${reason}`;
}

function statusFromApproval(
  status: AgentRuntimeSessionImportApprovalStatus,
): Exclude<AgentRuntimeSessionEnvelopeParseActionStatus, 'ready'> {
  if (status === 'unsupported') return 'unsupported';
  if (status === 'needs_approval') return 'needs_approval';
  return 'blocked';
}

function readySummary(rootCount: number, maxBytes: number): string {
  return `Session envelope parse action: ready for one selected target across ${rootCount} approved root(s); max ${maxBytes} byte(s). Target name redacted.`;
}

function positiveFiniteByteLimit(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export function buildAgentRuntimeSessionEnvelopeParseAction(
  input: AgentRuntimeSessionEnvelopeParseActionInput,
): AgentRuntimeSessionEnvelopeParseAction {
  const approval = input.approval;

  if (approval.status !== 'approved' || !approval.readerRequest) {
    const status = statusFromApproval(approval.status);
    const blockedReasons = [...approval.blockedReasons];
    return {
      toolId: approval.toolId,
      label: approval.label,
      status,
      summary: blockedSummary(status, blockedReasons),
      parseRequest: null,
      blockedReasons,
    };
  }

  if (input.parseConfirmed !== true) {
    const blockedReasons = [PARSE_CONFIRMATION_REQUIRED];
    return {
      toolId: approval.toolId,
      label: approval.label,
      status: 'needs_approval',
      summary: blockedSummary('needs_approval', blockedReasons),
      parseRequest: null,
      blockedReasons,
    };
  }

  const targetPath = input.targetPath.trim();
  if (!targetPath) {
    const blockedReasons = [TARGET_REQUIRED];
    return {
      toolId: approval.toolId,
      label: approval.label,
      status: 'blocked',
      summary: blockedSummary('blocked', blockedReasons),
      parseRequest: null,
      blockedReasons,
    };
  }

  if (!positiveFiniteByteLimit(input.maxBytes)) {
    const blockedReasons = [MAX_BYTES_REQUIRED];
    return {
      toolId: approval.toolId,
      label: approval.label,
      status: 'blocked',
      summary: blockedSummary('blocked', blockedReasons),
      parseRequest: null,
      blockedReasons,
    };
  }

  const maxBytes = Math.floor(input.maxBytes);
  const rootPaths = [...approval.readerRequest.rootPaths];

  return {
    toolId: approval.toolId,
    label: approval.label,
    status: 'ready',
    summary: readySummary(rootPaths.length, maxBytes),
    parseRequest: {
      approved: true,
      rootPaths,
      targetPath,
      maxBytes,
    },
    blockedReasons: [],
  };
}
