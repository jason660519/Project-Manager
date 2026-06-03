import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { NextRequest, NextResponse } from 'next/server';
import type { TerminalBlockSuggestion } from '../../../../lib/ai-assistants/types';
import { terminalBlockSuggestionsSidecarPath } from '../../../../lib/ai-assistants/terminalBlockSuggestions';

export const dynamic = 'force-static';

function isSafeAssistantId(value: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(value);
}

// Absolute on POSIX (`/repo`) or Windows (`C:\repo` / `C:/repo`). The dev flow
// runs on the host OS, so a POSIX-only check 400s legitimate Windows roots.
function isAbsoluteProjectRoot(value: string): boolean {
  return value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value);
}

export async function GET(request: NextRequest) {
  const searchParams = new URL(request.url).searchParams;
  const projectRoot =
    searchParams.get('projectRoot')?.trim() ??
    request.headers.get('x-project-root')?.trim() ??
    '';
  const assistantId =
    searchParams.get('assistantId')?.trim() ??
    request.headers.get('x-assistant-id')?.trim() ??
    '';
  if (!projectRoot || !assistantId) {
    return NextResponse.json({ error: 'projectRoot and assistantId are required' }, { status: 400 });
  }
  if (!isAbsoluteProjectRoot(projectRoot)) {
    return NextResponse.json({ error: 'projectRoot must be an absolute path' }, { status: 400 });
  }
  if (!isSafeAssistantId(assistantId)) {
    return NextResponse.json({ error: 'assistantId contains invalid characters' }, { status: 400 });
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

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const projectRoot = typeof body?.projectRoot === 'string' ? body.projectRoot.trim() : '';
  const assistantId = typeof body?.assistantId === 'string' ? body.assistantId.trim() : '';
  if (!projectRoot || !assistantId) {
    return NextResponse.json({ error: 'projectRoot and assistantId are required' }, { status: 400 });
  }
  if (!isAbsoluteProjectRoot(projectRoot)) {
    return NextResponse.json({ error: 'projectRoot must be an absolute path' }, { status: 400 });
  }
  if (!isSafeAssistantId(assistantId)) {
    return NextResponse.json({ error: 'assistantId contains invalid characters' }, { status: 400 });
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
  if (!isAbsoluteProjectRoot(projectRoot)) {
    return NextResponse.json({ error: 'projectRoot must be an absolute path' }, { status: 400 });
  }
  if (!isSafeAssistantId(assistantId)) {
    return NextResponse.json({ error: 'assistantId contains invalid characters' }, { status: 400 });
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
