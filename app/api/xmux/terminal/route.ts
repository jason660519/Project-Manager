import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { NextRequest, NextResponse } from 'next/server';
import {
  evaluateTerminalCommandDetailed,
  normalizeTerminalCommand,
  parseAllowedCommandForExec,
} from '../../../../lib/ai-assistants/terminalBoundaries';
import { validateNpmRunScript } from '../../../../lib/ai-assistants/terminalBoundaries.server';
import { resolveTerminalBoundaries } from '../../../../lib/ai-assistants/terminalBoundariesSidecar.server';

const execFileAsync = promisify(execFile);

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const input = typeof body?.command === 'string' ? body.command.trim() : '';
  const requestedCwd = typeof body?.cwd === 'string' ? body.cwd.trim() : '';
  const assistantId = typeof body?.assistantId === 'string' ? body.assistantId.trim() : 'pm-assistant';
  const cwd = requestedCwd || process.cwd();

  if (!input) {
    return NextResponse.json(
      { success: false, output: 'Missing command' },
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

  const boundaries = resolveTerminalBoundaries(cwd, assistantId);
  const evaluation = evaluateTerminalCommandDetailed(input, boundaries);
  if (evaluation.decision !== 'allowed') {
    return NextResponse.json(
      {
        success: false,
        output: `Terminal command blocked (${evaluation.reason ?? evaluation.decision})${
          evaluation.matchedRuleId ? ` rule=${evaluation.matchedRuleId}` : ''
        }${evaluation.blockedSegment ? ` segment=${evaluation.blockedSegment}` : ''}`,
      },
      { status: 400 },
    );
  }

  const normalized = normalizeTerminalCommand(input);
  const spec = parseAllowedCommandForExec(normalized);
  if (!spec) {
    return NextResponse.json(
      {
        success: false,
        output: `Command allowed by policy but not mapped for safe execFile execution: ${normalized}`,
      },
      { status: 400 },
    );
  }

  if (spec.command === 'npm' && spec.args[0] === 'run') {
    const scriptName = spec.args[1];
    if (!scriptName || !validateNpmRunScript(cwd, scriptName)) {
      return NextResponse.json(
        {
          success: false,
          output: `Terminal command blocked (npm_script_not_in_package_json) segment=${normalized}`,
        },
        { status: 400 },
      );
    }
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
