import type { ToolContext } from './toolExecutor';
import type { ToolCall, ToolResult } from './tools';

export async function executeConfirmedToolCall(
  call: ToolCall,
  context: ToolContext,
): Promise<ToolResult> {
  const res = await fetch('/api/chat/tool-execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      call,
      context,
      confirmedToolCallIds: [call.id],
    }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { content?: string; error?: string };
    return {
      tool_call_id: call.id,
      content: body.content ?? body.error ?? `Tool execution failed (${res.status})`,
      error: true,
    };
  }

  return (await res.json()) as ToolResult;
}

export function buildToolContextForExecution(context: {
  projectRoot: string;
  assistantId?: string;
  terminalBoundaries?: ToolContext['terminalBoundaries'];
  runCommandPermission?: ToolContext['runCommandPermission'];
}): ToolContext {
  return {
    projectRoot: context.projectRoot,
    assistantId: context.assistantId ?? 'pm-assistant',
    terminalBoundaries: context.terminalBoundaries,
    runCommandPermission: context.runCommandPermission,
  };
}
