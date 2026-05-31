import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

interface E2EReportRequest {
  reportPath?: string;
  report?: unknown;
}

function resolveReportPath(reportPath: string): string {
  const repoRoot = process.cwd();
  const reportsDir = path.resolve(repoRoot, '.project-manager', 'e2e-reports');
  const resolved = path.resolve(reportPath);
  if (!resolved.startsWith(`${reportsDir}${path.sep}`)) {
    throw new Error('E2E report path must stay under .project-manager/e2e-reports.');
  }
  return resolved;
}

export async function POST(request: NextRequest) {
  const body = await request.json() as E2EReportRequest;
  if (!body.reportPath) {
    return NextResponse.json({ error: 'Missing reportPath.' }, { status: 400 });
  }
  const resolved = resolveReportPath(body.reportPath);
  await mkdir(path.dirname(resolved), { recursive: true });
  await writeFile(resolved, `${JSON.stringify(body.report ?? null, null, 2)}\n`);
  return NextResponse.json({ ok: true });
}
