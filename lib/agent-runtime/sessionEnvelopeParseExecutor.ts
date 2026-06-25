import type {
  AgentRuntimeRedactedSessionEnvelopeResult,
  AgentRuntimeSessionBoundaryRequest,
} from '../bridge';
import type {
  AgentRuntimeSessionEnvelopeParseAction,
  AgentRuntimeSessionEnvelopeParseActionStatus,
} from './sessionEnvelopeParseAction';
import { buildAgentRuntimeSessionEnvelopeSummary } from './sessionEnvelopeSummary';

export type AgentRuntimeSessionEnvelopeParser = (
  request: AgentRuntimeSessionBoundaryRequest,
) => Promise<AgentRuntimeRedactedSessionEnvelopeResult>;

export interface AgentRuntimeSessionEnvelopeParseExecution {
  toolId: string;
  label: string;
  status: AgentRuntimeSessionEnvelopeParseActionStatus;
  summary: string;
  parserResult: AgentRuntimeRedactedSessionEnvelopeResult | null;
  blockedReasons: string[];
}

const PARSER_FAILED_REASON = 'Envelope parser failed; redacted error recorded.';

function executionSummary(status: AgentRuntimeSessionEnvelopeParseActionStatus, blockedReasons: string[]): string {
  const label = status === 'needs_approval' ? 'needs approval' : status;
  const reason = blockedReasons.length > 0 ? ` ${blockedReasons.join(' ')}` : '';
  return `Session envelope parse execution: ${label}.${reason}`;
}

export async function executeAgentRuntimeSessionEnvelopeParseAction(
  action: AgentRuntimeSessionEnvelopeParseAction,
  parser: AgentRuntimeSessionEnvelopeParser,
): Promise<AgentRuntimeSessionEnvelopeParseExecution> {
  if (action.status !== 'ready' || !action.parseRequest) {
    const blockedReasons = [...action.blockedReasons];
    return {
      toolId: action.toolId,
      label: action.label,
      status: action.status,
      summary: executionSummary(action.status, blockedReasons),
      parserResult: null,
      blockedReasons,
    };
  }

  try {
    const parserResult = await parser(action.parseRequest);
    const blockedReasons = parserResult.status === 'ready' ? [] : [...parserResult.blockedReasons];

    return {
      toolId: action.toolId,
      label: action.label,
      status: parserResult.status,
      summary: buildAgentRuntimeSessionEnvelopeSummary(parserResult) ?? executionSummary('blocked', blockedReasons),
      parserResult,
      blockedReasons,
    };
  } catch {
    const blockedReasons = [PARSER_FAILED_REASON];
    return {
      toolId: action.toolId,
      label: action.label,
      status: 'blocked',
      summary: executionSummary('blocked', blockedReasons),
      parserResult: null,
      blockedReasons,
    };
  }
}
