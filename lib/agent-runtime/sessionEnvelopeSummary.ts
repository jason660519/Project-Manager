export interface AgentRuntimeSessionEnvelopeCounts {
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  toolMessageCount: number;
  otherMessageCount: number;
  toolCallCount: number;
}

export interface AgentRuntimeSessionEnvelopeSummaryInput {
  status: string;
  byteLength?: number;
  maxBytes: number;
  contentRedacted: boolean;
  targetNameRedacted: boolean;
  envelope: AgentRuntimeSessionEnvelopeCounts | null;
  blockedReasons: string[];
}

function safeCount(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function blockedSummary(status: string, blockedReasons: string[]): string {
  const label = status === 'ready' ? 'unavailable' : status;
  const reason = blockedReasons.length > 0 ? ` ${blockedReasons.join(' ')}` : '';
  return `Session envelope: ${label}.${reason}`;
}

export function buildAgentRuntimeSessionEnvelopeSummary(
  result: AgentRuntimeSessionEnvelopeSummaryInput | null | undefined,
): string | null {
  if (!result) return null;

  if (result.status !== 'ready' || !result.envelope) {
    return blockedSummary(result.status, result.blockedReasons);
  }

  const envelope = result.envelope;
  const redactionNote =
    result.contentRedacted && result.targetNameRedacted
      ? ' Content and target names redacted.'
      : ' Content redaction state unavailable.';

  return [
    `Session envelope: ${safeCount(envelope.messageCount)} message(s) parsed`,
    ` (user ${safeCount(envelope.userMessageCount)}, assistant ${safeCount(envelope.assistantMessageCount)}, tool ${safeCount(envelope.toolMessageCount)}, other ${safeCount(envelope.otherMessageCount)})`,
    `; ${safeCount(envelope.toolCallCount)} tool call(s).`,
    redactionNote,
  ].join('');
}
