import { NextRequest, NextResponse } from 'next/server';
import { executeToolCall, type ToolContext } from '../../../../lib/chat/toolExecutor';
import type { ToolCall } from '../../../../lib/chat/tools';

interface ToolExecuteBody {
  call?: ToolCall;
  context?: ToolContext;
  confirmedToolCallIds?: string[];
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as ToolExecuteBody | null;
  const call = body?.call;
  const context = body?.context;

  if (!call?.id || !call.name || !context?.projectRoot) {
    return NextResponse.json({ error: 'call and context.projectRoot are required' }, { status: 400 });
  }

  const confirmedIds = body?.confirmedToolCallIds ?? [call.id];
  const result = await executeToolCall(call, {
    ...context,
    confirmedToolCallIds: confirmedIds,
  });

  return NextResponse.json(result);
}
