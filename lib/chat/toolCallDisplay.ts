import {
  isGuardedConfirmationResult,
  isTerminalBlockedResult,
  parseGuardedConfirmationMessage,
  parseTerminalBlockedMessage,
} from './toolExecutionCodes';
import type { ToolCallDisplay } from '../../components/chat/ToolCallCard';

export function resolveToolCallStatusFromResult(
  content: string,
  error?: boolean,
): Pick<ToolCallDisplay, 'status' | 'result' | 'error'> {
  if (isGuardedConfirmationResult(content)) {
    const parsed = parseGuardedConfirmationMessage(content);
    return {
      status: 'pending_confirmation',
      result: parsed
        ? `Guarded execution — approve to run: \`${parsed.command}\``
        : 'Guarded execution requires approval.',
      error: false,
    };
  }

  if (error && isTerminalBlockedResult(content)) {
    const parsed = parseTerminalBlockedMessage(content);
    return {
      status: 'error',
      result: parsed
        ? `Terminal blocked (${parsed.reason ?? 'policy'}): \`${parsed.blockedSegment ?? parsed.command}\``
        : content,
      error: true,
    };
  }

  return {
    status: error ? 'error' : 'done',
    result: content,
    error,
  };
}
