import { describe, expect, it } from 'vitest';
import {
  formatGuardedConfirmationMessage,
  formatTerminalBlockedMessage,
  isGuardedConfirmationResult,
  parseGuardedConfirmationMessage,
  parseTerminalBlockedMessage,
} from '../lib/chat/toolExecutionCodes';
import { resolveToolCallStatusFromResult } from '../lib/chat/toolCallDisplay';

describe('toolExecutionCodes', () => {
  it('round-trips guarded confirmation payload', () => {
    const message = formatGuardedConfirmationMessage('npm run typecheck');
    expect(isGuardedConfirmationResult(message)).toBe(true);
    expect(parseGuardedConfirmationMessage(message)?.command).toBe('npm run typecheck');
  });

  it('round-trips terminal blocked payload', () => {
    const message = formatTerminalBlockedMessage({
      command: 'sudo ls',
      reason: 'blacklist',
      matchedRuleId: 'bl-sudo',
    });
    const parsed = parseTerminalBlockedMessage(message);
    expect(parsed?.reason).toBe('blacklist');
    expect(parsed?.matchedRuleId).toBe('bl-sudo');
  });
});

describe('toolCallDisplay', () => {
  it('maps guarded confirmation to pending_confirmation status', () => {
    const message = formatGuardedConfirmationMessage('pwd');
    const resolved = resolveToolCallStatusFromResult(message, true);
    expect(resolved.status).toBe('pending_confirmation');
    expect(resolved.error).toBe(false);
  });
});
