import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { NextRequest, NextResponse } from 'next/server';

const execFileAsync = promisify(execFile);

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}

export async function POST(request: NextRequest) {
  if (process.platform !== 'darwin') {
    return NextResponse.json(
      { success: false, output: 'open-terminal is only supported on macOS in dev mode' },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => null);
  const cwd = typeof body?.cwd === 'string' ? body.cwd.trim() : '';
  if (!cwd || !path.isAbsolute(cwd)) {
    return NextResponse.json(
      { success: false, output: `Invalid cwd: ${cwd || '(empty)'}` },
      { status: 400 },
    );
  }

  try {
    await access(cwd);
  } catch {
    return NextResponse.json(
      { success: false, output: `Workspace not found: ${cwd}` },
      { status: 400 },
    );
  }

  const shellLine = `cd ${shellQuote(cwd)} && exec $SHELL`;
  const escaped = shellLine
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
  const script = `tell application "Terminal"\nactivate\ndo script "${escaped}"\nend tell`;

  try {
    await execFileAsync('osascript', ['-e', script], { timeout: 8000 });
    return NextResponse.json({ success: true, output: 'Terminal opened' });
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    return NextResponse.json(
      {
        success: false,
        output: `${err.stderr ?? ''}${err.message ?? ''}`.trimEnd() || 'osascript failed',
      },
      { status: 500 },
    );
  }
}
