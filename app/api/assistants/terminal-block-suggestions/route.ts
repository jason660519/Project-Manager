import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { NextRequest, NextResponse } from 'next/server';
import type { TerminalBlockSuggestion } from '../../../../lib/ai-assistants/types';
import { terminalBlockSuggestionsSidecarPath } from '../../../../lib/ai-assistants/terminalBlockSuggestions';

export const dynamic = 'force-static';

export async function GET(request: NextRequest) {
  const projectRoot = request.nextUrl.searchParams.get('projectRoot')?.trim() ?? '';
  const assistantId = request.nextUrl.searchParams.get('assistantId')?.trim() ?? '';
  if (!projectRoot || !assistantId) {
    return NextResponse.json({ error: 'projectRoot and assistantId are required' }, { status: 400 });
  }

  const path = terminalBlockSuggestionsSidecarPath(projectRoot, assistantId);
  if (!existsSync(path)) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const raw = readFileSync(path, 'utf-8');
    const suggestions = JSON.parse(raw) as TerminalBlockSuggestion[];
    return NextResponse.json({ suggestions: Array.isArray(suggestions) ? suggestions : [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to read suggestions' },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const projectRoot = typeof body?.projectRoot === 'string' ? body.projectRoot.trim() : '';
  const assistantId = typeof body?.assistantId === 'string' ? body.assistantId.trim() : '';
  const suggestions = body?.suggestions;

  if (!projectRoot || !assistantId || !Array.isArray(suggestions)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  try {
    mkdirSync(join(projectRoot, '.project-manager', 'assistants', assistantId), { recursive: true });
    writeFileSync(
      terminalBlockSuggestionsSidecarPath(projectRoot, assistantId),
      JSON.stringify(suggestions, null, 2),
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to write suggestions' },
      { status: 500 },
    );
  }
}
