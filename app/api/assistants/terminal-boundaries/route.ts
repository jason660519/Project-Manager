import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { NextRequest, NextResponse } from 'next/server';
import type { TerminalOperationalBoundaries } from '../../../../lib/ai-assistants/types';
import { terminalBoundariesSidecarPath } from '../../../../lib/ai-assistants/terminalBoundariesSidecar';

export const dynamic = 'force-static';

function isValidBoundaries(value: unknown): value is TerminalOperationalBoundaries {
  if (!value || typeof value !== 'object') return false;
  const b = value as TerminalOperationalBoundaries;
  return (
    (b.policyMode === 'default-deny' || b.policyMode === 'default-allow') &&
    Array.isArray(b.whitelist) &&
    Array.isArray(b.blacklist)
  );
}

export async function GET(request: NextRequest) {
  const projectRoot = request.nextUrl.searchParams.get('projectRoot')?.trim() ?? '';
  const assistantId = request.nextUrl.searchParams.get('assistantId')?.trim() ?? '';
  if (!projectRoot || !assistantId) {
    return NextResponse.json({ error: 'projectRoot and assistantId are required' }, { status: 400 });
  }
  if (!projectRoot.startsWith('/')) {
    return NextResponse.json({ error: 'projectRoot must be an absolute path' }, { status: 400 });
  }

  const path = terminalBoundariesSidecarPath(projectRoot, assistantId);
  if (!existsSync(path)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  try {
    const raw = readFileSync(path, 'utf-8');
    const boundaries = JSON.parse(raw) as TerminalOperationalBoundaries;
    if (!isValidBoundaries(boundaries)) {
      return NextResponse.json({ error: 'Invalid sidecar shape' }, { status: 500 });
    }
    return NextResponse.json({ boundaries });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to read sidecar' },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const projectRoot = typeof body?.projectRoot === 'string' ? body.projectRoot.trim() : '';
  const assistantId = typeof body?.assistantId === 'string' ? body.assistantId.trim() : '';
  const boundaries = body?.boundaries;

  if (!projectRoot || !assistantId) {
    return NextResponse.json({ error: 'projectRoot and assistantId are required' }, { status: 400 });
  }
  if (!projectRoot.startsWith('/')) {
    return NextResponse.json({ error: 'projectRoot must be an absolute path' }, { status: 400 });
  }
  if (!isValidBoundaries(boundaries)) {
    return NextResponse.json({ error: 'Invalid boundaries payload' }, { status: 400 });
  }

  const path = terminalBoundariesSidecarPath(projectRoot, assistantId);
  try {
    mkdirSync(join(projectRoot, '.project-manager', 'assistants', assistantId), { recursive: true });
    writeFileSync(path, JSON.stringify({ ...boundaries, updatedAt: new Date().toISOString() }, null, 2));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to write sidecar' },
      { status: 500 },
    );
  }
}
