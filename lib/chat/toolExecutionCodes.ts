/** Structured prefixes for tool executor responses consumed by the chat UI. */
export const GUARDED_CONFIRMATION_PREFIX = '__GUARDED_CONFIRMATION__';
export const TERMINAL_BLOCKED_PREFIX = '__TERMINAL_BLOCKED__';

export function formatGuardedConfirmationMessage(command: string): string {
  return `${GUARDED_CONFIRMATION_PREFIX}${JSON.stringify({ command })}`;
}

export function parseGuardedConfirmationMessage(content: string): { command: string } | null {
  if (!content.startsWith(GUARDED_CONFIRMATION_PREFIX)) return null;
  try {
    const parsed = JSON.parse(content.slice(GUARDED_CONFIRMATION_PREFIX.length)) as { command?: string };
    if (typeof parsed.command !== 'string' || !parsed.command.trim()) return null;
    return { command: parsed.command };
  } catch {
    return null;
  }
}

export function formatTerminalBlockedMessage(payload: {
  command: string;
  reason?: string;
  matchedRuleId?: string;
  blockedSegment?: string;
}): string {
  return `${TERMINAL_BLOCKED_PREFIX}${JSON.stringify(payload)}`;
}

export function parseTerminalBlockedMessage(content: string): {
  command: string;
  reason?: string;
  matchedRuleId?: string;
  blockedSegment?: string;
} | null {
  if (!content.startsWith(TERMINAL_BLOCKED_PREFIX)) return null;
  try {
    const parsed = JSON.parse(content.slice(TERMINAL_BLOCKED_PREFIX.length)) as {
      command?: string;
      reason?: string;
      matchedRuleId?: string;
      blockedSegment?: string;
    };
    if (typeof parsed.command !== 'string') return null;
    return {
      command: parsed.command,
      reason: parsed.reason,
      matchedRuleId: parsed.matchedRuleId,
      blockedSegment: parsed.blockedSegment,
    };
  } catch {
    return null;
  }
}

export function isGuardedConfirmationResult(content: string): boolean {
  return content.startsWith(GUARDED_CONFIRMATION_PREFIX);
}

export function isTerminalBlockedResult(content: string): boolean {
  return content.startsWith(TERMINAL_BLOCKED_PREFIX);
}
