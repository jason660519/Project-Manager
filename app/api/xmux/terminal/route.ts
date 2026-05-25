import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { NextRequest, NextResponse } from 'next/server';

const execFileAsync = promisify(execFile);

const ALLOWED_COMMANDS: Record<string, { command: string; args: string[] }> = {
  'pwd': { command: 'pwd', args: [] },
  'git branch --show-current': { command: 'git', args: ['branch', '--show-current'] },
  'git status --short': { command: 'git', args: ['status', '--short'] },
  'cmux --version': { command: 'cmux', args: ['--version'] },
  'cmux list-workspaces': { command: 'cmux', args: ['list-workspaces'] },
};

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const input = typeof body?.command === 'string' ? body.command.trim().replace(/\s+/g, ' ') : '';
  const requestedCwd = typeof body?.cwd === 'string' ? body.cwd.trim() : '';
  const spec = ALLOWED_COMMANDS[input];
  const cwd = requestedCwd || process.cwd();

  if (!spec) {
    return NextResponse.json(
      {
        success: false,
        output: `Unsupported command: ${input || '(empty)'}\nAllowed: ${Object.keys(ALLOWED_COMMANDS).join(', ')}`,
      },
      { status: 400 },
    );
  }

  if (!path.isAbsolute(cwd)) {
    return NextResponse.json(
      { success: false, output: `Invalid cwd: ${cwd}` },
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

  try {
    const result = await execFileAsync(spec.command, spec.args, {
      cwd,
      timeout: 5000,
      maxBuffer: 64 * 1024,
    });

    return NextResponse.json({
      success: true,
      output: `${result.stdout}${result.stderr}`.trimEnd(),
    });
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    return NextResponse.json(
      {
        success: false,
        output: `${err.stdout ?? ''}${err.stderr ?? ''}${err.message ?? ''}`.trimEnd(),
      },
      { status: 500 },
    );
  }
}
